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
      ? supabase.from('updates').select('caption, progress_value, objectives(emoji, title, unit, target_value)').eq('id', n.update_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const token = recipientRes.data?.push_token;
  if (!token) return new Response('no token');

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
  switch (n.type) {
    case 'reaction':
      title = `${name} a réagi ${n.emoji || ''}`.trim();
      body = upd?.caption ? `Sur ${onPost} : « ${clip(upd.caption, 50)} »` : `Sur ${onPost}`;
      break;
    case 'comment':
      title = `${name} a commenté ${onPost}`;
      body = `« ${clip(n.preview, 90)} »`;
      break;
    case 'reply':
      title = `${name} t'a répondu`;
      body = `« ${clip(n.preview, 90)} »`;
      break;
    case 'comment_like':
      title = `${name} a aimé ton commentaire ❤️`;
      body = `« ${clip(n.preview, 90)} »`;
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
