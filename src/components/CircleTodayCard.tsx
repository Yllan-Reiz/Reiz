import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, AppState } from 'react-native';
import { supabase, currentUser } from '../lib/supabase';
import { loadCircleRhythm, FriendRhythm } from '../lib/rhythm';
import { loadCloseCircle } from '../lib/closeCircle';
import { GlassSurface } from './GlassSurface';
import { F } from '../styles';
import { t, tp } from '../i18n';

// Le cercle du jour (moment Reiz, phase 29, 30/10/2026) : à la place du flou de BeReal, on montre qui de ton cercle
// a posté aujourd'hui. Chaque post allume un visage ; quand tout le monde a posté, « 🔥 Cercle complet ».
// Le cercle = ton cercle proche (étoiles) s'il a au moins 2 amis, sinon tes 6 amis les plus réguliers cette semaine.
// Calculé avec ce que tu as le droit de voir (loadCircleRhythm : posts des amis hors objectifs privés).

type Face = { id: string; name: string; avatar: string | null; posted: boolean };
// Ton cercle proche en entier (jusqu'à 15), sinon tes 8 amis les plus réguliers. Toi, tu n'es pas dans la rangée
// (demande de Yllan, 31/10/2026) : ton état n'apparaît que dans le titre (« Il ne manque plus que toi »).
const MAX = 15;
const FALLBACK = 8;
const GAP = 8;
const FACE = 40;
const FACE_MIN = 34;

export function CircleTodayCard({ reloadKey, onOpenProfile }: { reloadKey?: number; onOpenProfile?: (id: string) => void }) {
  const [faces, setFaces] = useState<Face[] | null>(null);
  const [myPosted, setMyPosted] = useState(false);
  const [fullDays, setFullDays] = useState(0);
  // Largeur disponible : les visages se calibrent dessus (31/10/2026 : à 40 points fixes sur une seule ligne, le 6e
  // visage était coupé sur l'iPhone de Yllan).
  const [rowW, setRowW] = useState(0);

  // `force` : à l'arrivée et après un post, on relit tout ; au simple retour dans l'app, la lecture d'il y a moins de
  // 5 minutes suffit (c'était 30 jours de posts du cercle rechargés à chaque changement d'application).
  const load = useCallback(async (force = true) => {
    const user = await currentUser();
    if (!user) return;
    const [rhythm, close] = await Promise.all([
      loadCircleRhythm(force),
      loadCloseCircle().catch(() => []),
    ]);
    if (!rhythm || rhythm.friends.length === 0) { setFaces([]); return; }
    const closeIds = new Set(close.map(c => c.id));
    const inClose = rhythm.friends.filter(f => closeIds.has(f.id));
    const members: FriendRhythm[] = inClose.length >= 2
      ? inClose.slice(0, MAX)
      : [...rhythm.friends].sort((a, b) => b.posted.filter(Boolean).length - a.posted.filter(Boolean).length || (a.daysAgo ?? 99) - (b.daysAgo ?? 99)).slice(0, FALLBACK);

    // Mes jours postés cette semaine (lundi = 0), pour « Cercle complet » et les jours complets.
    const today = (new Date().getDay() + 6) % 7;
    const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - today);
    const { data: mine } = await supabase.from('updates').select('created_at').eq('user_id', user.id).gte('created_at', monday.toISOString());
    const myDays = Array.from({ length: 7 }, () => false);
    (mine || []).forEach((u: any) => { myDays[(new Date(u.created_at).getDay() + 6) % 7] = true; });
    let full = 0;
    for (let d = 0; d <= today; d++) if (myDays[d] && members.every(m => m.posted[d])) full++;

    setMyPosted(myDays[today]);
    setFaces(members.map(m => ({ id: m.id, name: m.full_name, avatar: m.avatar_url, posted: m.posted[today] })));
    setFullDays(full);
  }, []);

  useEffect(() => { load(true); }, [load, reloadKey]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') load(false); });
    return () => sub.remove();
  }, [load]);

  if (!faces || faces.length < 1) return null;
  const done = faces.filter(f => f.posted).length;
  const allFriends = done === faces.length;
  const complete = allFriends && myPosted;
  const missing = faces.filter(f => !f.posted).map(f => f.name.split(' ')[0]);
  // Visages de 40 points s'ils tiennent sur une ligne, sinon 34 ; au-delà, plusieurs lignes équilibrées et centrées
  // (15 amis : trois lignes de cinq). Chaque ligne est centrée, donc 4 ou 5 visages aussi.
  const fitsOne = (n: number, sz: number) => n * sz + (n - 1) * GAP <= rowW;
  const size = fitsOne(faces.length, FACE) ? FACE : FACE_MIN;
  const inner = size - 8;
  const perRowMax = Math.max(1, Math.floor((rowW + GAP) / (size + GAP)));
  const nRows = Math.ceil(faces.length / perRowMax);
  const perRow = Math.ceil(faces.length / nRows);
  const rows = Array.from({ length: nRows }, (_, i) => faces.slice(i * perRow, (i + 1) * perRow));

  return (
    <GlassSurface radius={28} style={{ marginBottom: 14 }}>
      {/* Léger voile : sur iOS 26, le verre natif posé sur le noir du fil devenait invisible, la carte flottait sans cadre. */}
      <View style={{ padding: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>{t('circleToday.label')}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: F.bold }}>{t('circleToday.count', { done, total: faces.length })}</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 20, fontFamily: F.black, letterSpacing: -0.5, marginTop: 8 }}>
          {/* Toi seul manquant, un seul ami manquant, sinon combien manquent (toi compris). */}
          {complete ? t('circleToday.complete')
            : allFriends ? t('circleToday.youMissing')
            : missing.length === 1 && myPosted ? t('circleToday.oneLeft', { name: missing[0] })
            : tp('circleToday.left', missing.length)}
        </Text>
        <View style={{ marginTop: 14 }} onLayout={e => setRowW(e.nativeEvent.layout.width)}>
          {rowW > 0 && rows.map((row, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'center', gap: GAP, marginTop: i === 0 ? 0 : GAP }}>
          {row.map(f => (
            <TouchableOpacity key={f.id} disabled={!onOpenProfile} onPress={() => onOpenProfile?.(f.id)} accessibilityLabel={f.name}
              style={{ width: size, height: size, borderRadius: size / 2, padding: 2, borderWidth: 2, borderColor: f.posted ? '#fff' : 'rgba(255,255,255,0.14)', opacity: f.posted ? 1 : 0.45 }}>
              {f.avatar
                ? <Image source={{ uri: f.avatar }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
                : <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: F.bold, fontSize: Math.round(inner * 0.4) }}>{(f.name || '?').charAt(0).toUpperCase()}</Text></View>}
            </TouchableOpacity>
          ))}
          </View>
          ))}
        </View>
        {fullDays > 0 && (
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, fontFamily: F.semibold, marginTop: 12 }}>{tp('circleToday.fullDays', fullDays)}</Text>
        )}
      </View>
    </GlassSurface>
  );
}
