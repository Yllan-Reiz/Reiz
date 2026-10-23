import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

/** Lance la carte du duo sur l'iPhone de l'ami identifié. true = Apple l'a acceptée (pas besoin de la notification classique). */
async function startDuoActivity(recipientId: string, actorId: string, name: string, objLabel: string, postedAt: string): Promise<boolean> {
  try {
    const { data } = await supabase.from('live_activity_tokens').select('token').eq('user_id', recipientId).maybeSingle();
    if (!data?.token) return false;
    const deadline = new Date(postedAt).getTime() + DUO_WINDOW_MS;
    if (!Number.isFinite(deadline) || deadline - Date.now() < 2 * 60 * 1000) return false; // moins de 2 min : pas de carte
    const jwt = await apnsToken();
    if (!jwt) return false;
    const first = name.split(' ')[0];
    const payload = {
      aps: {
        timestamp: Math.floor(Date.now() / 1000),
        event: 'start',
        'stale-date': Math.floor(deadline / 1000),
        'content-state': {
          title: `${first} t'attend 🤝`,
          // Court : la carte n'affiche qu'une ligne de sous-titre.
          subtitle: 'Poste ta séance pour valider le duo',
          timerEndDateInMilliseconds: deadline,
          imageName: 'reiz_logo',
          dynamicIslandImageName: 'reiz_logo',
        },
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
        },
        alert: {
          title: `${first} t'a identifié dans sa séance 🤝`,
          body: objLabel ? `${objLabel}. Tu as une heure pour poster la tienne et valider le duo.` : "Tu as une heure pour poster la tienne et valider le duo.",
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
    if (res.ok) return true;
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
    supabase.from('users').select('push_token').eq('id', n.recipient_id).single(),
    n.actor_id
      ? supabase.from('users').select('full_name').eq('id', n.actor_id).single()
      : Promise.resolve({ data: null }),
    n.update_id
      ? supabase.from('updates').select('caption, progress_value, created_at, objectives(emoji, title, unit, target_value)').eq('id', n.update_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const token = recipientRes.data?.push_token;
  // Le duo peut passer par l'Activité en direct même sans jeton de notification classique.
  if (!token && n.type !== 'duo_tag') return new Response('no token');

  // Pastille rouge de l'icône : le nombre de notifications non lues, celle-ci comprise (elle est déjà écrite en base).
  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', n.recipient_id)
    .is('read_at', null);

  const name = (actorRes.data as any)?.full_name || "Quelqu'un";
  const upd = updateRes.data as any;
  const obj = upd?.objectives;
  const objLabel = obj ? `${obj.emoji || ''} ${obj.title}`.trim() : '';
  const onPost = objLabel ? `ton post ${objLabel}` : 'ton post';

  // Progression lisible : « 3 / 4 séances » plutôt qu'un pourcentage abstrait.
  let progress = '';
  if (upd && obj) {
    const pct = Math.min(Number(upd.progress_value) || 0, 100);
    progress = obj.unit && obj.unit !== '%' && obj.target_value
      ? `${Math.round((pct / 100) * obj.target_value * 10) / 10} / ${obj.target_value} ${obj.unit}`
      : `${pct} %`;
  }

  let title = '';
  let body = '';
  // Un commentaire GIF est enregistré comme « [GIF] lien » : la notification dit juste « GIF ».
  const said = (p?: string | null) => (/^\[GIF\] https:\/\//.test(p || '') ? 'GIF' : `« ${clip(p, 90)} »`);
  switch (n.type) {
    case 'reaction':
      title = `${name} a réagi ${n.emoji || ''}`.trim();
      body = upd?.caption ? `Sur ${onPost} : « ${clip(upd.caption, 50)} »` : `Sur ${onPost}`;
      break;
    case 'comment':
      title = `${name} a commenté ${onPost}`;
      body = said(n.preview);
      break;
    case 'reply':
      title = `${name} t'a répondu`;
      body = said(n.preview);
      break;
    case 'comment_like':
      title = `${name} a aimé ton commentaire ❤️`;
      body = said(n.preview);
      break;
    case 'nudge':
      // Un ami te relance (fonction nudge_friend, une fois par jour au plus).
      title = `${name} te relance 💪`;
      body = "Ça fait quelques jours sans séance. Poste la prochaine, ton cercle t'attend.";
      break;
    case 'friend_post':
      title = objLabel ? `${name} a posté : ${objLabel}` : `${name} vient de publier`;
      body = [progress, upd?.caption ? `« ${clip(upd.caption, 60)} »` : ''].filter(Boolean).join('  ') || 'Viens voir sa progression et réagis.';
      break;
    case 'duo_tag':
      title = `${name} t'a identifié dans sa séance 🤝`;
      body = objLabel ? `${objLabel}. Poste la tienne dans l'heure pour valider le duo.` : "Poste la tienne dans l'heure pour valider le duo.";
      break;
    case 'at_gym':
      // n.preview = nom du lieu choisi par la personne (« Basic-Fit »). Jamais de coordonnées.
      title = n.preview ? `${name} est à ${clip(n.preview, 40)} 💪` : `${name} est à la salle 💪`;
      body = `Viens t'entraîner avec ${name.split(' ')[0]}.`;
      break;
    case 'tag_endorse':
      title = `${name} a validé ton tag`;
      body = n.preview ? `« ${clip(n.preview, 40)} » sur ton profil` : 'Va voir ton profil.';
      break;
    case 'friend_request':
      title = `${name} veut rejoindre ton cercle`;
      body = 'Accepte pour suivre ses progrès, et lui les tiens.';
      break;
    case 'friend_accept':
      title = `${name} a accepté ta demande`;
      body = 'Vous êtes dans le même cercle. Va voir ses objectifs.';
      break;
    case 'challenge_invite':
      title = `${name} te défie 🔥`;
      body = "Un duel d'une semaine : qui s'entraîne sur le plus de jours ? Réponds dans l'appli.";
      break;
    case 'challenge_accept':
      title = `${name} relève ton défi 💪`;
      body = "C'est parti pour 7 jours. Chaque jour où tu postes une séance compte.";
      break;
    case 'challenge_result': {
      // n.preview = « Victoire 5 à 3 », « Défaite 3 à 5 » ou « Égalité 4 à 4 », déjà écrit du point de vue du destinataire.
      const res = n.preview || '';
      const icon = res.startsWith('Victoire') ? '🏆' : res.startsWith('Égalité') ? '🤝' : '💪';
      title = `${icon} Défi terminé contre ${name}`;
      body = res || 'Va voir le résultat.';
      break;
    }
    default:
      return new Response('unknown type');
  }

  // Duo : la carte avec compte à rebours remplace la notification classique (elle a sa propre alerte).
  if (n.type === 'duo_tag' && n.actor_id && upd?.created_at
      && await startDuoActivity(n.recipient_id, n.actor_id, name, objLabel, upd.created_at)) {
    return new Response('live activity');
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
