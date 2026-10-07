import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlassSurface } from './GlassSurface';
import { PeopleListModal } from './PeopleListModal';
import { currentUser } from '../lib/supabase';
import { useCloseCircle, resetCloseCircle, CloseFriend } from '../lib/closeCircle';
import { F } from '../styles';

// Le cercle proche, mis en avant dans le fil tant qu'il est vide ou presque :
//   0 proche  : grande carte qui explique à quoi ça sert, impossible à masquer ;
//   1-2       : rappel plus discret, qu'on peut repousser 3 jours ;
//   3 et plus : la carte disparaît (le cercle est lancé).

const label = { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 } as const;
const LATER_KEY = 'reiz.closecard.later';
const LATER_MS = 3 * 24 * 3600 * 1000;

export function Faces({ people, size = 34 }: { people: CloseFriend[]; size?: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {people.slice(0, 5).map((p, i) => (
        <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -size * 0.3, width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: '#161616', backgroundColor: '#2a2a2a', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {p.avatar_url
            ? <Image source={{ uri: p.avatar_url }} style={{ width: size, height: size }} />
            : <Text style={{ color: '#fff', fontSize: size * 0.4, fontFamily: F.bold }}>{p.full_name.charAt(0).toUpperCase()}</Text>}
        </View>
      ))}
    </View>
  );
}

export function CloseCircleCard({ onOpenProfile }: { onOpenProfile?: (id: string) => void }) {
  const { list, reload } = useCloseCircle();
  const [later, setLater] = useState(false);
  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    currentUser().then(u => setUid(u?.id ?? null));
    AsyncStorage.getItem(LATER_KEY).then(v => { if (v && Date.now() - Number(v) < LATER_MS) setLater(true); }).catch(() => {});
  }, []);

  if (list === null || !uid || list.length >= 3) return null;
  const empty = list.length === 0;
  if (!empty && later) return null;

  return (
    <>
      <GlassSurface radius={28} style={{ marginBottom: 14 }}>
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="star" size={13} color="rgba(255,255,255,0.55)" />
              <Text style={label}>CERCLE PROCHE</Text>
            </View>
            {!empty && (
              <TouchableOpacity
                onPress={() => { setLater(true); AsyncStorage.setItem(LATER_KEY, String(Date.now())).catch(() => {}); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Masquer pendant 3 jours"
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={{ color: '#fff', fontSize: 24, fontFamily: F.black, letterSpacing: -0.6, marginTop: 10 }}>
            {empty ? 'Crée ton cercle proche' : 'Ton cercle proche grandit'}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 21, fontFamily: F.regular, marginTop: 8 }}>
            {empty
              ? "Tes vrais partenaires d'entraînement. Ils sont prévenus quand tu arrives à la salle, voient les objectifs que tu leur réserves et te rejoignent en duo."
              : `${list.length} ${list.length > 1 ? 'proches' : 'proche'} pour l'instant. Avec 3 personnes ou plus, l'alerte « je suis à la salle » prend tout son sens.`}
          </Text>
          {!empty && <View style={{ marginTop: 12 }}><Faces people={list} /></View>}

          <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.85} style={{ backgroundColor: '#fff', borderRadius: 16, paddingVertical: 13, alignItems: 'center', marginTop: 16 }}>
            <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>{empty ? 'Choisir mes proches' : 'Ajouter des proches'}</Text>
          </TouchableOpacity>
        </View>
      </GlassSurface>

      <PeopleListModal
        visible={open}
        mode="close"
        userId={uid}
        currentUserId={uid}
        onClose={() => { setOpen(false); resetCloseCircle(); reload(true); }}
        onOpenProfile={onOpenProfile}
      />
    </>
  );
}
