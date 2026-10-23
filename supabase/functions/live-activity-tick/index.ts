import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Carte du duo (Activité en direct) : appelée toutes les minutes par pg_cron.
// La carte ne se redessine que quand elle reçoit une mise à jour : on lui en envoie une quand elle passe
// à l'orange (20 minutes restantes) puis au rouge (5 minutes), avec une alerte « ⏳ » qui remplace les rappels
// classiques du duo. Quand l'heure est passée, on la ferme. Il faut le jeton de mise à jour que l'iPhone a donné
// pour cette carte (live_activity_runs.update_token) : sans lui, rien à faire ici (les rappels classiques s'en chargent).
//
// Test sans rien envoyer : ?dry=1.

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SERVICE_KEY')!);
const BUNDLE_ID = 'com.yllan.reiz';
const MIN = 60 * 1000;
let apnsJwt: { token: string; at: number } | null = null;

const b64url = (bytes: Uint8Array | string) =>
  btoa(typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function apnsToken(): Promise<string | null> {
  const pem = Deno.env.get('APNS_KEY'), kid = Deno.env.get('APNS_KEY_ID'), iss = Deno.env.get('APNS_TEAM_ID');
  if (!pem || !kid || !iss) return null;
  if (apnsJwt && Date.now() - apnsJwt.at < 50 * MIN) return apnsJwt.token;
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64url(JSON.stringify({ alg: 'ES256', kid }));
  const claims = b64url(JSON.stringify({ iss, iat: Math.floor(Date.now() / 1000) }));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${claims}`)));
  apnsJwt = { token: `${head}.${claims}.${b64url(sig)}`, at: Date.now() };
  return apnsJwt.token;
}

type Phase = 'vert' | 'orange' | 'rouge' | 'fin';
const phaseAt = (deadline: number, now: number): Phase => {
  const left = deadline - now;
  if (left <= 0) return 'fin';
  if (left <= 5 * MIN) return 'rouge';
  if (left <= 20 * MIN) return 'orange';
  return 'vert';
};

Deno.serve(async (req) => {
  const expected = Deno.env.get('CRON_SECRET');
  if (expected && req.headers.get('x-cron-secret') !== expected) return new Response('Unauthorized', { status: 401 });
  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const now = Date.now();

  // Les cartes sans jeton dont l'heure est passée depuis 10 minutes : plus rien à en faire.
  if (!dry) await supabase.from('live_activity_runs').delete().is('update_token', null).lt('deadline', new Date(now - 10 * MIN).toISOString());

  const { data: runs } = await supabase.from('live_activity_runs').select('*').not('update_token', 'is', null);
  if (!runs || runs.length === 0) return new Response(dry ? '[]' : 'Aucune carte en cours');

  const jwt = dry ? 'dry' : await apnsToken();
  if (!jwt) return new Response('Clé APNs absente');

  const report: unknown[] = [];
  for (const r of runs) {
    const deadline = new Date(r.deadline).getTime();
    const phase = phaseAt(deadline, now);
    if (phase !== 'fin' && phase === r.phase) continue;
    const who = (r.author_name || '').split(' ')[0] || 'Ton ami';
    const aps: Record<string, unknown> = {
      timestamp: Math.floor(now / 1000),
      event: phase === 'fin' ? 'end' : 'update',
      'content-state': r.content,
    };
    if (phase === 'fin') aps['dismissal-date'] = Math.floor(now / 1000);
    if (phase === 'orange') aps.alert = { title: `⏳ Plus que 20 min pour ton duo avec ${who}`, body: 'Poste ta séance pour valider le duo.', sound: 'default' };
    if (phase === 'rouge') aps.alert = { title: `⏳ Dernières minutes pour ton duo avec ${who}`, body: 'Poste ta séance maintenant pour valider le duo.', sound: 'default' };
    report.push({ update: r.update_id, phase });
    if (dry) continue;

    const res = await fetch(`https://api.push.apple.com/3/device/${r.update_token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': `${BUNDLE_ID}.push-type.liveactivity`,
        'apns-push-type': 'liveactivity',
        'apns-priority': phase === 'vert' ? '5' : '10',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ aps }),
    });
    const reason = res.ok ? null : (await res.json().catch(() => ({})))?.reason || res.status;
    if (reason) console.error('mise à jour de carte refusée', reason);
    // Fin du duo, ou carte disparue (fermée, app supprimée) : on oublie cette carte.
    if (phase === 'fin' || res.status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered') {
      await supabase.from('live_activity_runs').delete().eq('update_id', r.update_id).eq('user_id', r.user_id);
    } else {
      await supabase.from('live_activity_runs').update({ phase }).eq('update_id', r.update_id).eq('user_id', r.user_id);
    }
  }
  return new Response(dry ? JSON.stringify(report, null, 2) : `Cartes mises à jour : ${report.length}`);
});
