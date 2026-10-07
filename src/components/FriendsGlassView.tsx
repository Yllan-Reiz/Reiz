import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from './GlassSurface';
import { StatBubble, SectionHeader } from './ProfileSections';
import { Friend, PendingRequest } from '../lib/types';
import { GUTTER } from '../constants';
import { F } from '../styles';

// L'onglet Amis dans le design du profil : bulle de verre à 3 zones, cartes de verre, étoile du cercle proche,
// boutons blancs. Le fond (ta photo floutée) est posé par Main derrière tout l'écran.
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
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 8 }}>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>MES AMIS</Text>
        <Text style={{ color: '#fff', fontSize: 36, fontFamily: F.black, letterSpacing: -1.2, marginTop: 4 }}>
          {p.friends.length} {p.friends.length > 1 ? 'amis' : 'ami'}
        </Text>
      </View>

      <StatBubble tinted items={[
        { value: String(p.friends.length), label: 'Amis' },
        { value: String(close.length), label: close.length > 1 ? 'Proches' : 'Proche' },
        { value: String(p.pending.length), label: p.pending.length > 1 ? 'Demandes' : 'Demande' },
      ]} />

      {/* Inviter */}
      <View style={{ paddingHorizontal: GUTTER, marginTop: 14 }}>
        <GlassCard radius={28}>
          <View style={{ padding: 18 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontFamily: F.black, letterSpacing: -0.4 }}>Invite ton cercle</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 20, fontFamily: F.regular, marginTop: 4 }}>Reiz marche mieux quand tes proches te regardent.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity onPress={p.onInvite} activeOpacity={0.85} style={{ flex: 1, height: 46, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>Partager mon lien</Text>
              </TouchableOpacity>
              {p.onOpenContacts && (
                <TouchableOpacity onPress={p.onOpenContacts} activeOpacity={0.85} accessibilityLabel="Retrouver mes contacts sur Reiz" style={{ flex: 1, height: 46, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.extrabold }}>Mes contacts</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </GlassCard>
      </View>

      {/* Recherche */}
      <View style={{ paddingHorizontal: GUTTER, marginTop: 14 }}>
        <GlassCard radius={22}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 52 }}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.6)" />
            <TextInput
              style={{ flex: 1, color: '#fff', fontSize: 15, fontFamily: F.regular }}
              placeholder="Prénom ou @pseudo..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={p.searchQuery}
              onChangeText={p.onSearch}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={40}
            />
            {p.searchQuery.length > 0 && (
              <TouchableOpacity onPress={p.onClearSearch} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>
        </GlassCard>
      </View>

      {p.searchQuery.trim().length >= 2 && p.searchResults.length === 0 && (
        <View style={{ paddingVertical: 20, alignItems: 'center', gap: 4 }}>
          {p.searching ? <ActivityIndicator color="#fff" /> : (
            <>
              <Text style={{ color: '#ddd', fontSize: 15, fontFamily: F.bold }}>Personne à ce nom</Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' }}>Vérifie l'orthographe, ou invite-le avec ton lien</Text>
            </>
          )}
        </View>
      )}

      {p.searchResults.length > 0 && (
        <View style={{ paddingHorizontal: GUTTER, marginTop: 22 }}>
          <SectionHeader title="Résultats" count={p.searchResults.length} />
          {p.searchResults.map((u: Person) => (
            <Row key={u.id} person={u} onPress={() => p.onViewProfile(u.id)} right={
              p.isFriend(u.id)
                ? <RoundBtn icon="checkmark" label="Déjà ami" onPress={() => p.onViewProfile(u.id)} />
                : (
                  <TouchableOpacity onPress={() => p.onAddFriend(u.id)} activeOpacity={0.85} style={{ height: 40, borderRadius: 20, paddingHorizontal: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#000', fontSize: 13, fontFamily: F.extrabold }}>Ajouter</Text>
                  </TouchableOpacity>
                )
            } />
          ))}
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

      {/* Même objectif */}
      {p.suggestions.length > 0 && (
        <View style={{ marginTop: 26 }}>
          <SectionHeader title="Même objectif" style={{ paddingHorizontal: GUTTER }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: GUTTER }}>
            {p.suggestions.map(u => (
              <TouchableOpacity key={u.id} onPress={() => p.onViewProfile(u.id)} activeOpacity={0.85} style={{ width: 160 }}>
                <GlassCard radius={28}>
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <Avatar url={u.avatar_url} name={u.full_name} size={64} />
                    <Text style={{ color: '#fff', fontSize: 16, fontFamily: F.bold, marginTop: 10 }} numberOfLines={1}>{u.full_name}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: F.regular, marginTop: 2, textAlign: 'center', minHeight: 32 }} numberOfLines={2}>{u.objectiveTitle}</Text>
                    <TouchableOpacity onPress={() => p.onAddFriend(u.id)} activeOpacity={0.85} style={{ height: 38, borderRadius: 19, paddingHorizontal: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
                      <Text style={{ color: '#000', fontSize: 13, fontFamily: F.extrabold }}>Ajouter</Text>
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Amis */}
      <View style={{ paddingHorizontal: GUTTER, marginTop: 26 }}>
        {p.loading ? (
          <View style={{ paddingTop: 20, alignItems: 'center' }}><ActivityIndicator color="#fff" /></View>
        ) : p.friends.length === 0 ? (
          <GlassCard radius={28}>
            <View style={{ padding: 22, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 20, fontFamily: F.black }}>Pas encore d'amis</Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center', marginTop: 6 }}>Invite tes proches ou cherche-les par prénom.</Text>
              <TouchableOpacity onPress={p.onInvite} activeOpacity={0.85} style={{ height: 46, borderRadius: 16, paddingHorizontal: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
                <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>Inviter mes amis →</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        ) : (
          <>
            {close.length > 0 && (
              <>
                <SectionHeader title="⭐ Cercle proche" count={close.length} />
                {close.map(friendRow)}
              </>
            )}
            {others.length > 0 && (
              <View style={{ marginTop: close.length > 0 ? 16 : 0 }}>
                <SectionHeader title={close.length > 0 ? 'Autres amis' : 'Mes amis'} count={others.length} />
                {close.length === 0 && (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 17, marginBottom: 12, marginTop: -4 }}>
                    Touche l'étoile pour mettre un ami dans ton <Text style={{ color: '#fff', fontFamily: F.bold }}>cercle proche</Text> : il est prévenu quand tu arrives à ta salle et voit les objectifs que tu lui réserves.
                  </Text>
                )}
                {others.map(friendRow)}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
