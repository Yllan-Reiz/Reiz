import { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Courte vidéo de présentation dans la carte « Nouveautés » : muette, en boucle, un tap met le son.
// Elle n'existe à l'écran que carte dépliée (le lecteur est libéré dès qu'on la replie).
export function NewsVideo({ uri, ratio = 9 / 16 }: { uri: string; ratio?: number }) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  useEffect(() => { player.muted = muted; }, [muted, player]);

  const height = 420;
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); setMuted(m => !m); }}
      accessibilityLabel={muted ? 'Activer le son' : 'Couper le son'}
      style={{ alignSelf: 'center', width: Math.round(height * ratio), height, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' }}
    >
      <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} />
      <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={14} color="#fff" />
      </View>
    </Pressable>
  );
}
