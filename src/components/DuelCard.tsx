import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image, AppState, Modal, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from './GlassSurface';
import { Duel, loadDuels, leaderLabel, proposeDuel } from '../lib/duel';
import { loadCircleRhythm, FriendRhythm } from '../lib/rhythm';
import { GUTTER } from '../constants';
import { F } from '../styles';

// ============================================================
// Défi duo : la carte du profil d'un ami (proposer, répondre, suivre, revanche)
// et le bandeau du fil (duels en cours, invitations reçues).
// ============================================================

const label = { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 } as const;
const bodyText = { color: '#fff', fontSize: 15, lineHeight: 22, fontFamily: F.regular, marginTop: 10 } as const;

function Btn({ text, onPress, busy, secondary }: { text: string; onPress: () => void; busy?: boolean; secondary?: boolean }) {
  return (
    <TouchableOpacity
      onPress={busy ? undefined : onPress}
      activeOpacity={0.85}
      style={{ flex: 1, backgroundColor: secondary ? 'rgba(255,255,255,0.14)' : '#fff', borderRadius: 16, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' }}
    >
      {busy
        ? <ActivityIndicator color={secondary ? '#fff' : '#000'} size="small" />
        : <Text style={{ color: secondary ? '#fff' : '#000', fontSize: 14, fontFamily: F.extrabold }}>{text}</Text>}
    </TouchableOpacity>
  );
}

/** 7 pastilles, une par jour d'entraînement. */
function DayPills({ score }: { score: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, flex: 1 }}>
      {Array.from({ length: 7 }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < score ? '#fff' : 'rgba(255,255,255,0.14)' }} />
      ))}
    </View>
  );
}

function ScoreRow({ name, score }: { name: string; score: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
      <Text style={{ width: 64, color: '#fff', fontSize: 13, fontFamily: F.semibold }} numberOfLines={1}>{name}</Text>
      <DayPills score={score} />
      <Text style={{ width: 24, textAlign: 'right', color: '#fff', fontSize: 15, fontFamily: F.black }}>{score}</Text>
    </View>
  );
}

/** Carte « Duel de la semaine » du profil d'un ami. `duel` = le défi le plus récent avec lui, ou null. */
export function DuelCard({ name, duel, busy, onPropose, onAnswer, onWithdraw }: {
  name: string;
  duel: Duel | null;
  busy: boolean;
  onPropose: () => void;
  onAnswer: (accept: boolean) => void;
  onWithdraw: () => void;
}) {
  const state = !duel ? 'none' : duel.status === 'pending' ? (duel.sentByMe ? 'sent' : 'received') : duel.status;
  const title = state === 'sent' ? 'DÉFI ENVOYÉ' : state === 'received' ? 'DÉFI REÇU' : state === 'active' ? 'DUEL DE LA SEMAINE' : state === 'finished' ? 'DUEL TERMINÉ' : 'DUEL DE LA SEMAINE';

  return (
    <GlassSurface radius={28} style={{ marginHorizontal: GUTTER, marginTop: 14 }}>
      <View style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={label}>⚔️  {title}</Text>
          {state === 'active' && duel && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 12, paddingHorizontal: 10, height: 26, justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 12, fontFamily: F.bold }}>{duel.daysLeft <= 1 ? 'Dernier jour' : `${duel.daysLeft} jours restants`}</Text>
            </View>
          )}
        </View>

        {state === 'none' && (
          <>
            <Text style={bodyText}>
              Défie {name} pendant 7 jours : celui qui s'entraîne sur le plus de jours gagne. Un post par jour suffit, seuls les objectifs visibles par ton cercle comptent.
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 14 }}><Btn text={`Défier ${name}`} onPress={onPropose} busy={busy} /></View>
          </>
        )}

        {state === 'sent' && (
          <>
            <Text style={bodyText}>En attente de la réponse de {name}. Sans réponse sous 3 jours, le défi s'efface tout seul.</Text>
            <View style={{ flexDirection: 'row', marginTop: 14 }}><Btn text="Retirer le défi" secondary onPress={onWithdraw} busy={busy} /></View>
          </>
        )}

        {state === 'received' && (
          <>
            <Text style={{ color: '#fff', fontSize: 22, fontFamily: F.black, letterSpacing: -0.5, marginTop: 8 }}>{name} te défie</Text>
            <Text style={[bodyText, { marginTop: 6 }]}>7 jours, le plus de jours d'entraînement gagne. Tu relèves le défi ?</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Btn text="Accepter" onPress={() => onAnswer(true)} busy={busy} />
              <Btn text="Refuser" secondary onPress={() => onAnswer(false)} />
            </View>
          </>
        )}

        {state === 'active' && duel && (
          <>
            <Text style={{ color: '#fff', fontSize: 26, fontFamily: F.black, letterSpacing: -0.8, marginTop: 8 }}>
              {leaderLabel(duel)} {Math.max(duel.myScore, duel.theirScore)} à {Math.min(duel.myScore, duel.theirScore)}
            </Text>
            <ScoreRow name="Toi" score={duel.myScore} />
            <ScoreRow name={name} score={duel.theirScore} />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F.regular, marginTop: 12 }}>
              Une pastille par jour où tu postes une séance.
            </Text>
          </>
        )}

        {state === 'finished' && duel && (
          <>
            <Text style={{ color: '#fff', fontSize: 26, fontFamily: F.black, letterSpacing: -0.8, marginTop: 8 }}>
              {duel.outcome === 'win' ? '🏆 Victoire' : duel.outcome === 'lose' ? '💪 Défaite' : '🤝 Égalité'} {duel.myScore} à {duel.theirScore}
            </Text>
            <Text style={[bodyText, { marginTop: 6 }]}>
              {duel.outcome === 'win' ? `Tu as battu ${name}. À lui de prendre sa revanche.` : duel.outcome === 'lose' ? `${name} l'emporte cette fois. Prends ta revanche.` : `Impossible de vous départager. On remet ça ?`}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 14 }}><Btn text="Revanche" onPress={onPropose} busy={busy} /></View>
          </>
        )}
      </View>
    </GlassSurface>
  );
}

/**
 * Bandeau du fil : un duel en cours ou une invitation reçue = une ligne de verre qui ouvre le
 * profil de l'ami. Invisible s'il n'y a rien (ou si la fonction n'existe pas encore côté serveur).
 * `reloadKey` change à chaque tirage pour rafraîchir.
 */
export function DuelBanner({ onOpenProfile, reloadKey }: { onOpenProfile: (id: string) => void; reloadKey?: unknown }) {
  const [duels, setDuels] = useState<Duel[]>([]);
  const refresh = useCallback(() => {
    loadDuels().then(list => setDuels((list || []).filter(d => d.status === 'active' || (d.status === 'pending' && !d.sentByMe)))).catch(() => setDuels([]));
  }, []);

  useEffect(refresh, [refresh, reloadKey]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  if (duels.length === 0) return null;
  return (
    <View>
      {duels.map(d => {
        const first = d.otherName.split(' ')[0];
        const invite = d.status === 'pending';
        return (
          <TouchableOpacity key={d.id} onPress={() => onOpenProfile(d.otherId)} activeOpacity={0.85} style={{ marginBottom: 10 }} accessibilityLabel={invite ? `${first} te défie` : `Duel contre ${first}`}>
            <GlassSurface radius={22}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 12 }}>
                {d.otherAvatar
                  ? <Image source={{ uri: d.otherAvatar }} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#222' }} />
                  : <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: F.bold }}>{first.charAt(0).toUpperCase()}</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }} numberOfLines={1}>{invite ? `${first} te défie` : `Duel contre ${first}`}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: F.regular, marginTop: 1 }} numberOfLines={1}>
                    {invite ? 'Touche pour répondre' : `${leaderLabel(d)} ${Math.max(d.myScore, d.theirScore)} à ${Math.min(d.myScore, d.theirScore)}, ${d.daysLeft <= 1 ? 'dernier jour' : `${d.daysLeft} jours restants`}`}
                  </Text>
                </View>
                <Text style={{ fontSize: 18 }}>⚔️</Text>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
              </View>
            </GlassSurface>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * « Défier un ami » : choisir un ami dans la liste et lui lancer un duel d'une semaine, sans passer par son profil.
 * Les amis déjà en duel avec toi (en cours ou en attente) sont grisés.
 */
export function ChallengeFriendButton({ onSent }: { onSent?: () => void }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<FriendRhythm[] | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [taken, setTaken] = useState<Set<string>>(new Set());

  const show = async () => {
    Haptics.selectionAsync().catch(() => {});
    setOpen(true);
    const [rh, duels] = await Promise.all([loadCircleRhythm().catch(() => null), loadDuels().catch(() => null)]);
    setFriends(rh?.friends || []);
    setTaken(new Set((duels || []).filter(d => d.status !== 'finished').map(d => d.otherId)));
  };

  const challenge = (f: FriendRhythm) => {
    const first = f.full_name.split(' ')[0];
    Alert.alert(`Défier ${first} ?`, `${first} recevra une notification. Le duel dure 7 jours dès qu'il accepte : celui qui s'entraîne sur le plus de jours gagne.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Défier',
        onPress: async () => {
          setBusyIds(prev => new Set(prev).add(f.id));
          const err = await proposeDuel(f.id);
          setBusyIds(prev => { const n = new Set(prev); n.delete(f.id); return n; });
          if (err) { Alert.alert('Défi', err); return; }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setTaken(prev => new Set(prev).add(f.id));
          onSent?.();
        },
      },
    ]);
  };

  return (
    <>
      <TouchableOpacity onPress={show} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Défier un ami" style={{ marginBottom: 10 }}>
        <GlassSurface radius={22}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 17 }}>⚔️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }}>Défier un ami</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: F.regular, marginTop: 1 }}>Un duel d'une semaine, le plus régulier gagne</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
          </View>
        </GlassSurface>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
            <Text style={{ color: '#fff', fontSize: 24, fontFamily: F.black, letterSpacing: -0.6 }}>Défier un ami</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}><Text style={{ color: '#aaa', fontSize: 14, fontFamily: F.semibold }}>Fermer</Text></TouchableOpacity>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 20, fontFamily: F.regular, paddingHorizontal: 20, marginBottom: 8 }}>
            7 jours. Chaque jour où tu postes une séance compte. Celui qui s'entraîne sur le plus de jours gagne.
          </Text>
          {friends === null ? <ActivityIndicator color="#fff" style={{ marginTop: 30 }} /> : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }}>
              {friends.length === 0 && <Text style={{ color: '#888', fontSize: 14, textAlign: 'center', marginTop: 30 }}>Ajoute des amis pour les défier.</Text>}
              {friends.map(f => {
                const busy = busyIds.has(f.id);
                const already = taken.has(f.id);
                return (
                  <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                    {f.avatar_url
                      ? <Image source={{ uri: f.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#222' }} />
                      : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: F.bold }}>{f.full_name.charAt(0).toUpperCase()}</Text></View>}
                    <Text style={{ flex: 1, color: '#fff', fontSize: 16, fontFamily: F.bold }} numberOfLines={1}>{f.full_name}</Text>
                    <TouchableOpacity
                      onPress={() => challenge(f)}
                      disabled={busy || already}
                      activeOpacity={0.85}
                      style={{ height: 36, borderRadius: 18, paddingHorizontal: 16, backgroundColor: already ? 'transparent' : '#fff', borderWidth: already ? 1 : 0, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', minWidth: 86 }}
                    >
                      {busy ? <ActivityIndicator color="#000" size="small" /> : <Text style={{ color: already ? 'rgba(255,255,255,0.6)' : '#000', fontSize: 13, fontFamily: F.extrabold }}>{already ? 'En duel' : 'Défier'}</Text>}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </>
  );
}
