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
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

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
