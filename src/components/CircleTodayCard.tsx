import { useCallback, useEffect, useState } from 'react';
import { View, Text, AppState } from 'react-native';
import { supabase, currentUser } from '../lib/supabase';
import { signOne } from '../lib/storage';
import { loadCircleRhythm, FriendRhythm } from '../lib/rhythm';
import { loadCloseCircle } from '../lib/closeCircle';
import { GlassSurface } from './GlassSurface';
import { F } from '../styles';
import { t, tp } from '../i18n';
import { andList } from '../lib/helpers';

// Le cercle du jour (moment Reiz, phase 29, 30/10/2026) : à la place du flou de BeReal, on montre qui de ton cercle
// a posté aujourd'hui. Chaque post allume un visage ; quand tout le monde a posté, « 🔥 Cercle complet ».
// Le cercle = ton cercle proche (étoiles) s'il a au moins 2 amis, sinon tes 6 amis les plus réguliers cette semaine.
// Calculé avec ce que tu as le droit de voir (loadCircleRhythm : posts des amis hors objectifs privés).

type Face = { id: string; name: string; avatar: string | null; posted: boolean; me?: boolean };
const MAX = 7;

export function CircleTodayCard({ reloadKey }: { reloadKey?: number; onOpenProfile?: (id: string) => void }) {
  const [faces, setFaces] = useState<Face[] | null>(null);
  const [fullDays, setFullDays] = useState(0);

  // `force` : à l'arrivée et après un post, on relit tout ; au simple retour dans l'app, la lecture d'il y a moins de
  // 5 minutes suffit (c'était 30 jours de posts du cercle rechargés à chaque changement d'application).
  const load = useCallback(async (force = true) => {
    const user = await currentUser();
    if (!user) return;
    const [rhythm, close, me] = await Promise.all([
      loadCircleRhythm(force),
      loadCloseCircle().catch(() => []),
      supabase.from('users').select('full_name, avatar_url').eq('id', user.id).maybeSingle(),
    ]);
    if (!rhythm || rhythm.friends.length === 0) { setFaces([]); return; }
    const closeIds = new Set(close.map(c => c.id));
    const inClose = rhythm.friends.filter(f => closeIds.has(f.id));
    const members: FriendRhythm[] = inClose.length >= 2
      ? inClose.slice(0, MAX - 1)
      : [...rhythm.friends].sort((a, b) => b.posted.filter(Boolean).length - a.posted.filter(Boolean).length || (a.daysAgo ?? 99) - (b.daysAgo ?? 99)).slice(0, 6);

    // Mes jours postés cette semaine (lundi = 0), pour « Cercle complet » et les jours complets.
    const today = (new Date().getDay() + 6) % 7;
    const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - today);
    const { data: mine } = await supabase.from('updates').select('created_at').eq('user_id', user.id).gte('created_at', monday.toISOString());
    const myDays = Array.from({ length: 7 }, () => false);
    (mine || []).forEach((u: any) => { myDays[(new Date(u.created_at).getDay() + 6) % 7] = true; });
    let full = 0;
    for (let d = 0; d <= today; d++) if (myDays[d] && members.every(m => m.posted[d])) full++;

    const myAvatar = me.data?.avatar_url ? await signOne(me.data.avatar_url).catch(() => null) : null;
    setFaces([
      { id: user.id, name: me.data?.full_name || '', avatar: myAvatar, posted: myDays[today], me: true },
      ...members.map(m => ({ id: m.id, name: m.full_name, avatar: m.avatar_url, posted: m.posted[today] })),
    ]);
    setFullDays(full);
  }, []);

  useEffect(() => { load(true); }, [load, reloadKey]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') load(false); });
    return () => sub.remove();
  }, [load]);

  if (!faces || faces.length < 2) return null;
  const done = faces.filter(f => f.posted).length;
  const complete = done === faces.length;
  const missing = faces.filter(f => !f.posted && !f.me).map(f => f.name.split(' ')[0]);
  const meMissing = faces.some(f => f.me && !f.posted);

  return (
    <GlassSurface radius={28} style={{ marginBottom: 14 }}>
      <View style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>{t('circleToday.label')}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: F.bold }}>{t('circleToday.count', { done, total: faces.length })}</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 20, fontFamily: F.black, letterSpacing: -0.5, marginTop: 8 }}>
          {/* Toi seul manquant, un seul ami manquant, sinon combien manquent (toi compris). */}
          {complete ? t('circleToday.complete')
            : meMissing && missing.length === 0 ? t('circleToday.youMissing')
            : !meMissing && missing.length === 1 ? t('circleToday.oneLeft', { name: missing[0] })
            : tp('circleToday.left', faces.length - done)}
        </Text>
        {/* Une jauge, un segment par membre (31/10/2026) : les visages ne tenaient pas sur une ligne sur les iPhone étroits et
            n'apportaient rien, la carte dit déjà qui manque. */}
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 14 }}>
          {faces.map(f => (
            <View key={f.id} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: f.posted ? '#fff' : 'rgba(255,255,255,0.14)' }} />
          ))}
        </View>
        {/* Qui manque, quand le titre ne le dit pas déjà (il nomme un seul manquant). */}
        {!complete && (missing.length >= 2 || (missing.length === 1 && meMissing)) && (
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, fontFamily: F.semibold, marginTop: 10 }} numberOfLines={2}>
            {t(meMissing ? 'circleToday.missingYou' : 'circleToday.missing', { names: andList(missing) })}
          </Text>
        )}
        {fullDays > 0 && (
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, fontFamily: F.semibold, marginTop: 12 }}>{tp('circleToday.fullDays', fullDays)}</Text>
        )}
      </View>
    </GlassSurface>
  );
}
