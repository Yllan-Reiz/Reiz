import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, Image, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gif, searchGifs, trendingGifs } from '../lib/giphy';
import { F } from '../styles';

// La banque de GIF des commentaires : les tendances à l'ouverture, une recherche (en français), deux colonnes.
// Toucher un GIF l'envoie. La mention « Powered by GIPHY » est demandée par les conditions de l'API.

let trendingCache: Gif[] | null = null;

export function GifPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (gif: Gif) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Gif[]>(trendingCache || []);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recherche avec une petite attente : la clé gratuite est limitée à 100 appels par heure pour toute l'app.
  useEffect(() => {
    if (!visible) return;
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (!term && trendingCache) { setItems(trendingCache); setFailed(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = term ? await searchGifs(term) : await trendingGifs();
        if (!term) trendingCache = res;
        setItems(res);
        setFailed(false);
      } catch {
        setFailed(true);
      }
      setLoading(false);
    }, term ? 450 : 0);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, visible]);

  useEffect(() => { if (!visible) setQ(''); }, [visible]);

  const GAP = 6;
  const colW = (width - 32 - GAP) / 2;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a1a1a', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 12, height: 44 }}>
            <Ionicons name="search" size={17} color="#777" />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Chercher un GIF"
              placeholderTextColor="#666"
              autoFocus
              returnKeyType="search"
              autoCorrect={false}
              style={{ flex: 1, color: '#fff', fontSize: 15, fontFamily: F.regular }}
            />
            {!!q && (
              <TouchableOpacity onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Effacer la recherche">
                <Ionicons name="close-circle" size={17} color="#666" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={{ color: '#aaa', fontSize: 14, fontFamily: F.semibold }}>Fermer</Text>
          </TouchableOpacity>
        </View>

        {failed ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontFamily: F.bold }}>GIF indisponibles</Text>
            <Text style={{ color: '#888', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 }}>Vérifie ta connexion, ou réessaie dans un moment.</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={g => g.id}
            numColumns={2}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            columnWrapperStyle={{ gap: GAP }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: GAP, paddingBottom: insets.bottom + 48 }}
            ListEmptyComponent={loading ? <ActivityIndicator color="#fff" style={{ marginTop: 40 }} /> : (
              <Text style={{ color: '#777', fontSize: 13, textAlign: 'center', marginTop: 40 }}>Aucun GIF trouvé.</Text>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); onPick(item); }}
                accessibilityLabel="Envoyer ce GIF"
                style={{ width: colW, height: Math.min(colW * 1.3, Math.max(colW * 0.6, colW * (item.height / item.width))), borderRadius: 12, overflow: 'hidden', backgroundColor: '#161616' }}
              >
                <Image source={{ uri: item.preview }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </TouchableOpacity>
            )}
          />
        )}

        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 10, paddingTop: 10, alignItems: 'center', backgroundColor: 'rgba(10,10,10,0.92)' }}>
          <Text style={{ color: '#888', fontSize: 11, fontFamily: F.bold, letterSpacing: 1 }}>POWERED BY GIPHY</Text>
        </View>
      </View>
    </Modal>
  );
}
