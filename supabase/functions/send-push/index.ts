import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { T, asLang, fill, num, unit, locale, isDefaultPlace, duelResult, type Lang } from './texts.ts';

// Point d'envoi unique des notifications push.
// Chaque événement social (réaction, commentaire, post d'un ami...) est d'abord
// écrit dans la table `notifications` par un trigger SQL. Le webhook de cette
// table appelle ensuite cette fonction, qui rédige le texte et envoie le push.
// L'anti-doublon est fait en base (dedupe_key unique) : liker, enlever puis
// reliker le même post ne crée pas de nouvelle ligne, donc pas de nouveau push.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SERVICE_KEY')!
);

// Délai pendant lequel on ne renvoie pas de push pour la même personne sur le
// même post (plusieurs emojis d'affilée = une seule alerte).
const THROTTLE_MIN = 10;

// Moins de notifications, et des meilleures (chantier 4 du 30/10/2026, d'après le back-office : 4 par jour en
// moyenne, un record à 36, 1 sur 5 la nuit, près d'un « X a posté » sur 3 moins d'une heure après le précédent).
// La ligne reste toujours dans l'Activité et compte dans la pastille : seule la sonnerie est retenue.
//   heures calmes  22 h 30 à 7 h 30 à l'heure de celui qui reçoit (users.timezone), sauf le duo (une heure pour poster)
//   regroupement   un post d'ami moins de 45 min après un autre ne sonne pas ; le suivant dit « et 2 autres posts »
//   plafond        au-delà de 8 notifications dans sa journée, posts d'amis, réactions et « à la salle » ne sonnent plus
//                  (commentaires, réponses, demandes d'ami, défis et duos sonnent toujours)
const QUIET_FROM = 22 * 60 + 30;
const QUIET_TO = 7 * 60 + 30;
const FRIEND_POST_GAP_MIN = 45;
const DAILY_CAP = 8;
const CAPPED_TYPES = ['friend_post', 'reaction', 'comment_like', 'at_gym', 'tag_endorse', 'friend_accept'];

/** Minutes depuis minuit et minuit en UTC, à l'heure de `tz` (Paris si le fuseau est absent ou inconnu). */
function localClock(tz?: string | null) {
  const now = new Date();
  for (const zone of [tz || 'Europe/Paris', 'Europe/Paris']) {
    try {
      const local = new Date(now.toLocaleString('en-US', { timeZone: zone }));
      const offset = local.getTime() - now.getTime();
      const midnight = new Date(local); midnight.setHours(0, 0, 0, 0);
      return { minutes: local.getHours() * 60 + local.getMinutes(), midnightISO: new Date(midnight.getTime() - offset).toISOString() };
    } catch { /* fuseau inconnu : Paris */ }
  }
  return { minutes: 12 * 60, midnightISO: now.toISOString() };
}

const clip = (t: string | null | undefined, n = 60) => {
  if (!t) return '';
  const one = t.replace(/\s+/g, ' ').trim();
  return one.length > n ? one.substring(0, n - 1) + '…' : one;
};

// ---------- Activité en direct du duo (iOS 17.2 et plus) ----------
// Quand un ami t'identifie dans sa séance, Apple affiche sur ton écran verrouillé et dans la Dynamic Island une carte
// « Hugo t'attend 🤝 » avec le compte à rebours de l'heure du duo. Le serveur l'envoie directement à Apple (APNs),
// avec le jeton « push-to-start » de l'iPhone (table live_activity_tokens) et la clé APNs du compte développeur
// (secrets APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID). Sans clé ou sans jeton : la notification classique, comme avant.
const BUNDLE_ID = 'com.yllan.reiz';
const DUO_WINDOW_MS = 60 * 60 * 1000;
let apnsJwt: { token: string; at: number } | null = null;

const b64url = (bytes: Uint8Array | string) =>
  btoa(typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function apnsToken(): Promise<string | null> {
  const pem = Deno.env.get('APNS_KEY'), kid = Deno.env.get('APNS_KEY_ID'), iss = Deno.env.get('APNS_TEAM_ID');
  if (!pem || !kid || !iss) return null;
  // Apple accepte un même jeton pendant une heure : on le refait toutes les 50 minutes.
  if (apnsJwt && Date.now() - apnsJwt.at < 50 * 60 * 1000) return apnsJwt.token;
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64url(JSON.stringify({ alg: 'ES256', kid }));
  const claims = b64url(JSON.stringify({ iss, iat: Math.floor(Date.now() / 1000) }));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${claims}`)));
  apnsJwt = { token: `${head}.${claims}.${b64url(sig)}`, at: Date.now() };
  return apnsJwt.token;
}

type DuoExtras = { updateId: string; countLabel?: string; initials: string[]; moreCount: number };

/** Lance la carte du duo sur l'iPhone de l'ami identifié. true = Apple l'a acceptée (pas besoin de la notification classique). */
async function startDuoActivity(lang: Lang, timeZone: string, recipientId: string, actorId: string, name: string, objLabel: string, postedAt: string, extras: DuoExtras): Promise<boolean> {
  try {
    const { data } = await supabase.from('live_activity_tokens').select('token').eq('user_id', recipientId).maybeSingle();
    if (!data?.token) return false;
    const deadline = new Date(postedAt).getTime() + DUO_WINDOW_MS;
    if (!Number.isFinite(deadline) || deadline - Date.now() < 2 * 60 * 1000) return false; // moins de 2 min : pas de carte
    const jwt = await apnsToken();
    if (!jwt) return false;
    const first = name.split(' ')[0];
    const t = T[lang];
    const contentState = {
      title: fill(t.cardTitle, { first }),
      subtitle: objLabel || t.cardSubtitle,
      timerEndDateInMilliseconds: deadline,
      imageName: 'reiz_logo',
      dynamicIslandImageName: 'reiz_logo',
    };
    // L'heure du post (« 18:42 »), à l'heure de celui qui reçoit la carte, en haut à droite.
    const timeLabel = new Intl.DateTimeFormat(locale(lang), { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(postedAt));
    const payload = {
      aps: {
        timestamp: Math.floor(Date.now() / 1000),
        event: 'start',
        'stale-date': Math.floor(deadline / 1000),
        'content-state': contentState,
        'attributes-type': 'LiveActivityAttributes',
        attributes: {
          name: 'duo',
          backgroundColor: '0A0A0A',
          titleColor: 'FFFFFF',
          subtitleColor: 'FFFFFFB3',
          progressViewTint: 'FFFFFF',
          progressViewLabelColor: 'FFFFFF',
          deepLinkUrl: `duo/${actorId}`,
          timerType: 'digital',
          imagePosition: 'right',
          // Ajouts Reiz, lus par la carte (plugins/live-activity/LiveActivityWidget.swift).
          startDateInMilliseconds: new Date(postedAt).getTime(),
          countLabel: extras.countLabel,
          initials: extras.initials,
          moreCount: extras.moreCount,
          timeLabel,
          // « restant » à côté du compte à rebours, dans la langue de celui qui reçoit (carte de la version 1.1).
          remainingLabel: t.cardRemaining,
        },
        alert: {
          title: fill(t.duoTagTitle, { name: first }),
          body: objLabel ? fill(t.cardAlertBodyObj, { obj: objLabel }) : t.cardAlertBody,
          sound: 'default',
        },
      },
    };
    const res = await fetch(`https://api.push.apple.com/3/device/${data.token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': `${BUNDLE_ID}.push-type.liveactivity`,
        'apns-push-type': 'liveactivity',
        'apns-priority': '10',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      // Suivi de la carte : live-activity-tick la fera passer à l'orange puis au rouge, et la fermera.
      await supabase.from('live_activity_runs').upsert({
        update_id: extras.updateId, user_id: recipientId, deadline: new Date(deadline).toISOString(),
        content: contentState, author_name: name, phase: 'vert', update_token: null, lang,
      }, { onConflict: 'update_id,user_id' });
      return true;
    }
    const reason = (await res.json().catch(() => ({})))?.reason || res.status;
    console.error('live activity refusée', reason);
    // Jeton périmé (app supprimée, autre iPhone) : on l'oublie.
    if (res.status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered') {
      await supabase.from('live_activity_tokens').delete().eq('user_id', recipientId);
    }
    return false;
  } catch (e) {
    console.error('live activity', e);
    return false;
  }
}

Deno.serve(async (req) => {
  const expected = Deno.env.get('WEBHOOK_SECRET');
  if (expected && req.headers.get('x-webhook-secret') !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await req.json();
  const n = payload.record;
  if (!n?.recipient_id) return new Response('ok');

  // Les nouveaux objectifs vont dans le fil d'activité seulement : un push à
  // chaque objectif créé ferait trop de bruit.
  if (n.type === 'new_objective') return new Response('skip');

  // Anti-rafale : une personne qui réagit avec 5 emojis en 10 secondes = 1 push.
  if (['reaction', 'comment_like', 'comment', 'reply'].includes(n.type)) {
    const since = new Date(Date.now() - THROTTLE_MIN * 60 * 1000).toISOString();
    let q = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', n.recipient_id)
      .eq('actor_id', n.actor_id)
      .eq('type', n.type)
      // Seulement les lignes ANTÉRIEURES : deux réactions quasi simultanées ne
      // doivent pas s'annuler mutuellement (sinon zéro push au lieu d'un).
      .lt('created_at', n.created_at)
      .gte('created_at', since);
    q = n.update_id ? q.eq('update_id', n.update_id) : q;
    const { count } = await q;
    if ((count || 0) > 0) return new Response('throttled');
  }

  const [recipientRes, actorRes, updateRes] = await Promise.all([
    supabase.from('users').select('push_token, language, timezone').eq('id', n.recipient_id).single(),
    n.actor_id
      ? supabase.from('users').select('full_name').eq('id', n.actor_id).single()
      : Promise.resolve({ data: null }),
    n.update_id
      ? supabase.from('updates').select('caption, progress_value, created_at, with_user_ids, objective_id, objectives(emoji, title, unit, target_value)').eq('id', n.update_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const token = recipientRes.data?.push_token;
  // Le duo peut passer par l'Activité en direct même sans jeton de notification classique.
  if (!token && n.type !== 'duo_tag') return new Response('no token');

  // Heures calmes, regroupement des posts d'amis, plafond du jour (voir en haut du fichier).
  const clock = localClock((recipientRes.data as any)?.timezone);
  if (n.type !== 'duo_tag' && (clock.minutes >= QUIET_FROM || clock.minutes < QUIET_TO)) return new Response('quiet');
  let morePosts = 0;
  if (n.type === 'friend_post') {
    const gapSince = new Date(new Date(n.created_at).getTime() - FRIEND_POST_GAP_MIN * 60 * 1000).toISOString();
    const { count: recentPosts } = await supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('recipient_id', n.recipient_id).eq('type', 'friend_post').lt('created_at', n.created_at).gte('created_at', gapSince);
    if ((recentPosts || 0) > 0) return new Response('grouped');
    // Les posts d'amis restés sans sonnerie (et non lus) depuis 3 h : annoncés avec celui-ci.
    const { count: waiting } = await supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('recipient_id', n.recipient_id).eq('type', 'friend_post').is('read_at', null).lt('created_at', n.created_at)
      .gte('created_at', new Date(new Date(n.created_at).getTime() - 3 * 3600 * 1000).toISOString());
    morePosts = waiting || 0;
  }
  if (CAPPED_TYPES.includes(n.type)) {
    // Les lignes du jour (sonnées ou non) : le plafond est donc atteint un peu plus tôt, jamais plus tard.
    const { count: today } = await supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('recipient_id', n.recipient_id).neq('type', 'new_objective').lt('created_at', n.created_at).gte('created_at', clock.midnightISO);
    if ((today || 0) >= DAILY_CAP) return new Response('capped');
  }

  // Pastille rouge de l'icône : le nombre de notifications non lues, celle-ci comprise (elle est déjà écrite en base).
  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', n.recipient_id)
    .is('read_at', null);

  // Langue de celui qui reçoit (vide = français, comptes d'avant la version 1.1).
  const lang = asLang((recipientRes.data as any)?.language);
  const t = T[lang];
  const name = (actorRes.data as any)?.full_name || t.someone;
  const upd = updateRes.data as any;
  const obj = upd?.objectives;
  const objLabel = obj ? `${obj.emoji || ''} ${obj.title}`.trim() : '';
  const onPost = objLabel ? fill(t.onPostObj, { obj: objLabel }) : t.onPost;

  // Progression lisible : « 3 / 4 séances » plutôt qu'un pourcentage abstrait.
  let progress = '';
  if (upd && obj) {
    const pct = Math.min(Number(upd.progress_value) || 0, 100);
    progress = obj.unit && obj.unit !== '%' && obj.target_value
      ? `${num(lang, (pct / 100) * obj.target_value)} / ${num(lang, obj.target_value)} ${unit(lang, obj.unit)}`
      : `${pct} %`;
  }

  let title = '';
  let body = '';
  // Un commentaire GIF est enregistré comme « [GIF] lien » : la notification dit juste « GIF ».
  const said = (p?: string | null) => (/^\[GIF\] https:\/\//.test(p || '') ? t.gif : fill(t.quote, { text: clip(p, 90) }));
  switch (n.type) {
    case 'reaction':
      title = fill(t.reactionTitle, { name, emoji: n.emoji || '' }).trim();
      body = upd?.caption ? fill(t.reactionBodyCaption, { post: onPost, caption: clip(upd.caption, 50) }) : fill(t.reactionBody, { post: onPost });
      break;
    case 'comment':
      title = fill(t.commentTitle, { name, post: onPost });
      body = said(n.preview);
      break;
    case 'reply':
      title = fill(t.replyTitle, { name });
      body = said(n.preview);
      break;
    case 'comment_like':
      title = fill(t.commentLikeTitle, { name });
      body = said(n.preview);
      break;
    case 'nudge':
      // Un ami te relance (fonction nudge_friend, une fois par jour au plus).
      title = fill(t.nudgeTitle, { name });
      body = t.nudgeBody;
      break;
    case 'friend_post': {
      // Le post qui fait franchir la cible (100 %, alors que le post d'avant sur cet objectif était en dessous) :
      // « 🏆 Léa a atteint son objectif ». Même type friend_post : les versions installées l'affichent comme avant.
      let reached = false;
      if (upd?.objective_id && Number(upd.progress_value) >= 100) {
        const { data: prev } = await supabase.from('updates').select('progress_value')
          .eq('objective_id', upd.objective_id).lt('created_at', upd.created_at)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        reached = !prev || Number((prev as any).progress_value) < 100;
      }
      if (reached) {
        title = fill(t.objectiveDoneTitle, { name });
        body = objLabel ? fill(t.objectiveDoneBody, { obj: objLabel }) : t.objectiveDoneBodyNoObj;
        break;
      }
      title = objLabel ? fill(t.friendPostTitleObj, { name, obj: objLabel }) : fill(t.friendPostTitle, { name });
      body = [progress, upd?.caption ? fill(t.quote, { text: clip(upd.caption, 60) }) : ''].filter(Boolean).join('  ') || t.friendPostBody;
      if (morePosts > 0) body = `${body} ${morePosts === 1 ? t.friendPostMoreOne : fill(t.friendPostMore, { n: morePosts })}`;
      break;
    }
    case 'duo_tag':
      title = fill(t.duoTagTitle, { name });
      body = objLabel ? fill(t.duoTagBodyObj, { obj: objLabel }) : t.duoTagBody;
      break;
    case 'at_gym':
      // n.preview = nom du lieu choisi par la personne (« Basic-Fit »). Jamais de coordonnées.
      // Lieu par défaut (« la salle ») écrit dans la langue de celui qui prévient : réécrit dans celle de celui qui reçoit.
      title = n.preview && !isDefaultPlace(n.preview) ? fill(t.atGymTitlePlace, { name, place: clip(n.preview, 40) }) : fill(t.atGymTitle, { name });
      body = fill(t.atGymBody, { first: name.split(' ')[0] });
      break;
    case 'tag_endorse':
      title = fill(t.tagEndorseTitle, { name });
      body = n.preview ? fill(t.tagEndorseBodyTag, { tag: clip(n.preview, 40) }) : t.tagEndorseBody;
      break;
    case 'friend_request':
      title = fill(t.friendRequestTitle, { name });
      body = t.friendRequestBody;
      break;
    case 'friend_accept':
      title = fill(t.friendAcceptTitle, { name });
      body = t.friendAcceptBody;
      break;
    case 'challenge_invite':
      title = fill(t.challengeInviteTitle, { name });
      body = t.challengeInviteBody;
      break;
    case 'challenge_accept':
      title = fill(t.challengeAcceptTitle, { name });
      body = t.challengeAcceptBody;
      break;
    case 'challenge_result': {
      // n.preview = « Victoire 5 à 3 », « Défaite 3 à 5 » ou « Égalité 4 à 4 », déjà écrit du point de vue du destinataire.
      const res = duelResult(lang, n.preview);
      const icon = res?.kind === 'win' ? '🏆' : res?.kind === 'draw' ? '🤝' : '💪';
      title = fill(t.challengeResultTitle, { icon, name });
      body = res?.text || n.preview || t.challengeResultBody;
      break;
    }
    default:
      return new Response('unknown type');
  }

  // Duo : la carte avec compte à rebours remplace la notification classique (elle a sa propre alerte).
  if (n.type === 'duo_tag' && n.actor_id && upd?.created_at) {
    // Les visages de la séance : l'auteur, puis les autres amis identifiés (sans toi). Initiales, pas de photos :
    // une carte d'Activité en direct ne peut pas télécharger d'image.
    const others = ((upd.with_user_ids || []) as string[]).filter(id => id !== n.recipient_id);
    const { data: people } = others.length
      ? await supabase.from('users').select('id, full_name').in('id', others)
      : { data: [] as { id: string; full_name: string }[] };
    const names = [name, ...others.map(id => (people || []).find(p => p.id === id)?.full_name).filter(Boolean) as string[]];
    const initials = names.slice(0, 3).map(x => (x.trim()[0] || '?').toUpperCase());
    // « 3/4 » : la progression de l'auteur sur cet objectif.
    let countLabel: string | undefined;
    if (obj) {
      const pct = Math.min(Number(upd.progress_value) || 0, 100);
      countLabel = obj.unit && obj.unit !== '%' && obj.target_value
        ? `${num(lang, (pct / 100) * obj.target_value)}/${num(lang, obj.target_value)}`
        : `${pct}%`;
    }
    if (await startDuoActivity(lang, (recipientRes.data as any)?.timezone || 'Europe/Paris', n.recipient_id, n.actor_id, name, objLabel, upd.created_at,
        { updateId: n.update_id, countLabel, initials, moreCount: Math.max(0, names.length - 3) })) {
      return new Response('live activity');
    }
  }
  if (!token) return new Response('no token');

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title,
      body,
      sound: 'default',
      badge: unread || 1,
      // `type` garde la compatibilité avec le deep link des builds déjà installés.
      data: { type: n.type === 'friend_request' ? 'friend_request' : 'activity', notificationId: n.id },
    }),
  });

  return new Response('sent');
});
