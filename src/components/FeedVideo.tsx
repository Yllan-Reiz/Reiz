import { useEffect, useState } from 'react';
import { View, Pressable, StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Vidéo courte d'une publication (15 s max), à la façon d'Instagram :
// muette et en boucle, elle ne joue que si la carte est à l'écran (`active`),
// sinon dix vidéos tourneraient en même temps. Un tap coupe ou remet le son.
export function FeedVideo({ uri, active, style }: {
  uri: string;
  active: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  // Le lecteur n'existe que pour la carte visible. Avant, chaque vidéo du fil créait son lecteur dès
  // l'affichage de la carte et commençait à télécharger : plusieurs vidéos de 20 Mo se disputaient la
  // connexion avec les photos, et tout le fil ralentissait.
  if (!active) return <View style={[style, { backgroundColor: '#111' }]} />;
  return <FeedVideoPlayer uri={uri} style={style} />;
}

function FeedVideoPlayer({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => { player.muted = muted; }, [muted, player]);

  return (
    <Pressable
      style={style}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); setMuted(m => !m); }}
      accessibilityLabel={muted ? 'Activer le son' : 'Couper le son'}
    >
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
      <View
        pointerEvents="none"
        style={{
          // Sous le bouton « … » : le bas de la carte est pris par la légende et les réactions.
          position: 'absolute', right: 14, top: 64, width: 28, height: 28, borderRadius: 14,
          backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={14} color="#fff" />
      </View>
    </Pressable>
  );
}
