import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from './GlassSurface';
import { SectionHeader } from './ProfileSections';
import { Friend, PendingRequest } from '../lib/types';
import { GUTTER } from '../constants';
import { F } from '../styles';

// L'onglet Amis = découvrir et ajouter des gens (comme sur les réseaux sociaux) : recherche par nom, tag ou sport,
// invitation, demandes reçues, amis recommandés, nouveaux sur Reiz. Tes amis et ton cercle proche sont sur ton
// profil (bulle « Mes amis »), pas ici : avec 45 amis, cet onglet se remplirait de gens que tu connais déjà.
// Le fond (ta photo floutée) est posé par Main derrière tout l'écran.
// Retour à l'ancien design : GLASS_FRIENDS = false dans constants.ts (l'ancien code est resté dans FriendsTab).

type Person = { id: string; full_name: string; username: string; avatar_url?: string | null };

function Avatar({ url, name, size = 52, ring }: { url?: string | null; name: string; size?: number; ring?: boolean }) {
  const border = ring ? { borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' } : { borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' };
  return url
    ? <Image source={{ uri: url }} style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#222' }, border]} />
    : (
      <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }, border]}>
        <Text style={{ color: '#fff', fontSize: size * 0.4, fontFamily: F.bold }}>{name.charAt(0).toUpperCase()}</Text>
      </View>
    );
}

/** Rond d'action : blanc plein (principal) ou verre (secondaire). */
function RoundBtn({ icon, onPress, label, primary, filled }: { icon: any; onPress: () => void; label: string; primary?: boolean; filled?: boolean }) {
  const white = primary || filled;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: white ? '#fff' : 'rgba(255,255,255,0.14)' }}
    >
      <Ionicons name={icon} size={18} color={white ? '#000' : '#ddd'} />
    </TouchableOpacity>
  );
}

function Row({ person, onPress, onLongPress, ring, right }: { person: Person; onPress: () => void; onLongPress?: () => void; ring?: boolean; right?: React.ReactNode }) {
  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} activeOpacity={0.8} style={{ marginBottom: 10 }}>
      <GlassCard radius={26}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, paddingRight: 14 }}>
          <Avatar url={person.avatar_url} name={person.full_name} ring={ring} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontFamily: F.bold }} numberOfLines={1}>{person.full_name}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontFamily: F.regular, marginTop: 1 }} numberOfLines={1}>@{person.username}</Text>
          </View>
          {right}
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

// Les sports de l'accueil, avec les mots qu'on cherche dans les tags et les objectifs publics.
const SPORT_SEARCH: { id: string; label: string; terms: string[] }[] = [
  { id: 'musculation', label: 'Musculation', terms: ['muscu', 'salle', 'bench', 'squat', 'soulevé', 'terre', 'développé', 'powerlift', 'bodybuild'] },
  { id: 'street', label: 'Street Workout', terms: ['street', 'calisthenics', 'traction', 'dips', 'muscle up', 'planche'] },
  { id: 'hyrox', label: 'HYROX', terms: ['hyrox', 'crossfit', 'wod'] },
  { id: 'running', label: 'Running', terms: ['course', 'courir', 'running', 'run', 'marathon', 'semi', '10 km', 'trail'] },
  { id: 'cyclisme', label: 'Cyclisme', terms: ['vélo', 'velo', 'cyclisme', 'bike', 'gravel'] },
  { id: 'boxe', label: 'Boxe', terms: ['boxe', 'box', 'mma', 'muay', 'kick'] },
  { id: 'natation', label: 'Natation', terms: ['nage', 'natation', 'nager', 'piscine', 'swim'] },
];

export function FriendsGlassView(p: {
  friends: Friend[];
  pending: PendingRequest[];
  suggestions: any[];
  searchResults: any[];
  searchQuery: string;
  searching: boolean;
  loading: boolean;
  closeIds: Set<string>;
  refreshing: boolean;
  onRefresh: () => void;
  onSearch: (q: string) => void;
  onClearSearch: () => void;
  onViewProfile: (id: string) => void;
  onToggleClose: (id: string) => void;
  onInvite: () => void;
  /** Lien affiché sur la carte d'invitation (sans https://). */
  inviteLink: string;
  myAvatar: string | null;
  myName: string;
  onHideSuggestion: (id: string) => void;
  onAddSuggested: (id: string) => void;
  sentIds: Set<string>;
  /** Tes amis qui correspondent à la recherche (pour ouvrir leur profil). */
  matchingFriends: Friend[];
  newMembers: any[];
  activeSport: string | null;
  onSport: (id: string, label: string, terms: string[]) => void;
  /** undefined = fonction cachée (build sans le module des contacts). */
  onOpenContacts?: () => void;
  onAccept: (friendshipId: string) => void;
  onDecline: (friendshipId: string) => void;
  onRemove: (friendshipId: string, name: string) => void;
  onAddFriend: (userId: string) => void;
  isFriend: (userId: string) => boolean;
  bottomPad: number;
}) {
  const close = p.friends.filter(f => p.closeIds.has(f.id));
  const others = p.friends.filter(f => !p.closeIds.has(f.id));
  const star = (f: Friend) => <RoundBtn icon={p.closeIds.has(f.id) ? 'star' : 'star-outline'} filled={p.closeIds.has(f.id)} label={p.closeIds.has(f.id) ? `Retirer ${f.full_name} du cercle proche` : `Ajouter ${f.full_name} au cercle proche`} onPress={() => p.onToggleClose(f.id)} />;
  const friendRow = (f: Friend) => (
    <Row key={f.friendship_id} person={f} ring={p.closeIds.has(f.id)} onPress={() => p.onViewProfile(f.id)} onLongPress={() => p.onRemove(f.friendship_id, f.full_name)} right={star(f)} />
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: p.bottomPad + 24 }}
      refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} tintColor="#fff" colors={['#fff']} progressBackgroundColor="#1a1a1a" />}
    >
      {/* Recherche en premier, comme BeReal. */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 8 }}>
        <GlassCard radius={26}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, height: 52 }}>
            <Ionicons name="search" size={19} color="rgba(255,255,255,0.6)" />
            <TextInput
              style={{ flex: 1, color: '#fff', fontSize: 16, fontFamily: F.regular }}
              placeholder="Ajouter ou rechercher des amis"
              placeholderTextColor="rgba(255,255,255,0.45)"
              value={p.searchQuery}
              onChangeText={p.onSearch}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={40}
            />
            {p.searchQuery.length > 0 && (
              <TouchableOpacity onPress={p.onClearSearch} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Effacer la recherche">
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>
        </GlassCard>
      </View>

      {/* Invitation : ta photo, ton lien, et la carte de partage (QR code) au toucher. */}
      <TouchableOpacity onPress={p.onInvite} activeOpacity={0.85} style={{ paddingHorizontal: GUTTER, marginTop: 14 }} accessibilityRole="button" accessibilityLabel="Inviter tes amis sur Reiz">
        <GlassCard radius={26}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingRight: 18 }}>
            <Avatar url={p.myAvatar} name={p.myName || 'R'} size={50} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontFamily: F.bold }} numberOfLines={1}>Invite tes amis sur Reiz</Text>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontFamily: F.regular, marginTop: 2 }} numberOfLines={1}>{p.inviteLink}</Text>
            </View>
            <Ionicons name="share-outline" size={24} color="#fff" />
          </View>
        </GlassCard>
      </TouchableOpacity>

      {p.onOpenContacts && (
        <TouchableOpacity onPress={p.onOpenContacts} activeOpacity={0.85} style={{ paddingHorizontal: GUTTER, marginTop: 10 }} accessibilityLabel="Retrouver mes contacts sur Reiz">
          <GlassCard radius={22}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, height: 52 }}>
              <Ionicons name="person-circle-outline" size={22} color="#fff" />
              <Text style={{ flex: 1, color: '#fff', fontSize: 15, fontFamily: F.semibold }}>Retrouver mes contacts</Text>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
            </View>
          </GlassCard>
        </TouchableOpacity>
      )}

      {/* Chercher par sport : les gens dont les tags ou les objectifs publics parlent de ce sport. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 14 }} contentContainerStyle={{ gap: 8, paddingHorizontal: GUTTER }}>
        {SPORT_SEARCH.map(sp => {
          const on = p.activeSport === sp.id;
          return (
            <TouchableOpacity key={sp.id} onPress={() => p.onSport(sp.id, sp.label, sp.terms)} activeOpacity={0.85} accessibilityState={{ selected: on }}
              style={{ height: 36, borderRadius: 18, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: on ? '#fff' : 'rgba(255,255,255,0.14)' }}>
              <Text style={{ color: on ? '#000' : '#fff', fontSize: 13, fontFamily: F.bold }}>{sp.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {p.searchQuery.trim().length >= 2 && p.searchResults.length === 0 && p.matchingFriends.length === 0 && (
        <View style={{ paddingVertical: 20, alignItems: 'center', gap: 4 }}>
          {p.searching ? <ActivityIndicator color="#fff" /> : (
            <>
              <Text style={{ color: '#ddd', fontSize: 15, fontFamily: F.bold }}>Personne de nouveau pour l'instant</Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', paddingHorizontal: 30 }}>Essaie un autre mot, ou invite tes amis avec ton lien</Text>
            </>
          )}
        </View>
      )}

      {/* Tes amis qui correspondent : un tap ouvre leur profil. */}
      {p.matchingFriends.length > 0 && (
        <View style={{ paddingHorizontal: GUTTER, marginTop: 22 }}>
          <Text style={label}>TES AMIS</Text>
          {p.matchingFriends.map(f => (
            <TouchableOpacity key={f.id} onPress={() => p.onViewProfile(f.id)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 }}>
              <Avatar url={f.avatar_url} name={f.full_name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }} numberOfLines={1}>{f.full_name}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontFamily: F.regular }} numberOfLines={1}>@{f.username}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {p.searchResults.length > 0 && (
        <View style={{ paddingHorizontal: GUTTER, marginTop: 22 }}>
          <Text style={label}>{p.activeSport ? 'ILS FONT LE MÊME SPORT' : 'NOUVELLES PERSONNES'}</Text>
          {p.searchResults.map(u => <DiscoverRow key={u.id} u={u} sent={p.sentIds.has(u.id)} onOpen={() => p.onViewProfile(u.id)} onAdd={() => p.onAddSuggested(u.id)} />)}
        </View>
      )}

      {/* Demandes reçues */}
      {p.pending.length > 0 && (
        <View style={{ paddingHorizontal: GUTTER, marginTop: 26 }}>
          <SectionHeader title="Demandes reçues" count={p.pending.length} />
          {p.pending.map(r => (
            <Row key={r.friendship_id} person={r} ring onPress={() => p.onViewProfile(r.id)} right={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <RoundBtn icon="checkmark" primary label={`Accepter ${r.full_name}`} onPress={() => p.onAccept(r.friendship_id)} />
                <RoundBtn icon="close" label={`Refuser ${r.full_name}`} onPress={() => p.onDecline(r.friendship_id)} />
              </View>
            } />
          ))}
        </View>
      )}

      {/* Amis recommandés : contacts, amis en commun, même objectif. Ajouter, ou ✕ pour ne plus le voir. */}
      {p.suggestions.length > 0 && p.searchQuery.trim().length < 2 && (
        <View style={{ paddingHorizontal: GUTTER, marginTop: 26 }}>
          <Text style={label}>AMIS RECOMMANDÉS</Text>
          {p.suggestions.map(u => (
            <DiscoverRow key={u.id} u={u} sent={p.sentIds.has(u.id)} onOpen={() => p.onViewProfile(u.id)} onAdd={() => p.onAddSuggested(u.id)} onHide={() => p.onHideSuggestion(u.id)} />
          ))}
        </View>
      )}

      {/* Nouveaux sur Reiz : inscrits depuis 30 jours, ceux qui ont des amis en commun avec toi d'abord. */}
      {p.newMembers.filter(u => !p.suggestions.some(sg => sg.id === u.id)).length > 0 && p.searchQuery.trim().length < 2 && (
        <View style={{ marginTop: 26 }}>
          <Text style={[label, { paddingHorizontal: GUTTER }]}>NOUVEAUX SUR REIZ</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: GUTTER, paddingTop: 4 }}>
            {p.newMembers.filter(u => !p.suggestions.some(sg => sg.id === u.id)).map(u => {
              const sent = p.sentIds.has(u.id);
              return (
                <TouchableOpacity key={u.id} onPress={() => p.onViewProfile(u.id)} activeOpacity={0.85} style={{ width: 140 }}>
                  <GlassCard radius={24}>
                    <View style={{ padding: 14, alignItems: 'center' }}>
                      <Avatar url={u.avatar_url} name={u.full_name} size={60} />
                      <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold, marginTop: 8 }} numberOfLines={1}>{u.full_name}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: F.regular, marginTop: 1 }} numberOfLines={1}>
                        {u.mutual > 0 ? `${u.mutual} ami${u.mutual > 1 ? 's' : ''} en commun` : 'Nouveau'}
                      </Text>
                      <TouchableOpacity onPress={() => p.onAddSuggested(u.id)} disabled={sent} activeOpacity={0.85}
                        style={{ height: 34, borderRadius: 17, paddingHorizontal: 18, marginTop: 10, backgroundColor: sent ? 'transparent' : '#fff', borderWidth: sent ? 1 : 0, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: sent ? 'rgba(255,255,255,0.6)' : '#000', fontSize: 13, fontFamily: F.extrabold }}>{sent ? 'Envoyé' : 'Ajouter'}</Text>
                      </TouchableOpacity>
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Rien à proposer : on invite à faire venir ses amis. */}
      {!p.loading && p.suggestions.length === 0 && p.newMembers.length === 0 && p.pending.length === 0 && p.searchQuery.trim().length < 2 && (
        <View style={{ paddingHorizontal: GUTTER, marginTop: 26 }}>
          <GlassCard radius={28}>
            <View style={{ padding: 22, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 18, fontFamily: F.black }}>Personne à te proposer</Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center', marginTop: 6 }}>Cherche par sport ou invite tes amis avec ton lien.</Text>
            </View>
          </GlassCard>
        </View>
      )}
    </ScrollView>
  );
}

const label = { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: F.bold, letterSpacing: 1.5, marginBottom: 6 } as const;

/** Une personne à découvrir : photo, nom, @pseudo, la raison (contact, amis en commun, tag, objectif), Ajouter et ✕. */
function DiscoverRow({ u, sent, onOpen, onAdd, onHide }: { u: any; sent: boolean; onOpen: () => void; onAdd: () => void; onHide?: () => void }) {
  const icon = u.kind === 'contact' ? 'person-circle-outline' : u.kind === 'mutual' ? 'people-outline' : u.kind === 'tag' ? 'pricetag-outline' : u.kind === 'objective' ? 'flag-outline' : 'at-outline';
  return (
    <TouchableOpacity onPress={onOpen} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}>
      <Avatar url={u.avatar_url} name={u.full_name} size={56} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 16, fontFamily: F.bold }} numberOfLines={1}>{u.full_name}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontFamily: F.regular, marginTop: 1 }} numberOfLines={1}>@{u.username}</Text>
        {!!u.reason && u.reason !== `@${u.username}` && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
            <Ionicons name={icon} size={13} color="rgba(255,255,255,0.5)" />
            <Text style={{ flex: 1, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F.regular }} numberOfLines={1}>{u.reason}</Text>
          </View>
        )}
      </View>
      <TouchableOpacity
        onPress={onAdd}
        disabled={sent}
        activeOpacity={0.85}
        accessibilityLabel={sent ? 'Demande envoyée' : `Ajouter ${u.full_name}`}
        style={{ height: 38, borderRadius: 19, paddingHorizontal: 16, backgroundColor: sent ? 'transparent' : 'rgba(255,255,255,0.14)', borderWidth: sent ? 1 : 0, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: sent ? 'rgba(255,255,255,0.6)' : '#fff', fontSize: 14, fontFamily: F.bold }}>{sent ? 'Envoyé' : 'Ajouter'}</Text>
      </TouchableOpacity>
      {!!onHide && !sent && (
        <TouchableOpacity onPress={onHide} hitSlop={10} accessibilityLabel={`Ne plus proposer ${u.full_name}`} style={{ paddingLeft: 2 }}>
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.55)" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}
