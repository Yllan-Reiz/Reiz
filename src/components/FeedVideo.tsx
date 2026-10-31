import { useEffect, useState } from 'react';
import { View, Pressable, Platform, StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { t } from '../i18n';

// Vidéo courte d'une publication (25 s max), à la façon d'Instagram :
// muette et en boucle, elle joue tant qu'un bout de la carte est à l'écran (`active`), et s'arrête une fois
// sortie, sinon dix vidéos tourneraient en même temps. Un tap coupe ou remet le son.
// En préparation, on ne charge que le début : une vidéo jamais regardée ne doit pas coûter son poids entier.
const PRELOAD_SEC = 4;
const FULL_BUFFER_SEC = Platform.OS === 'ios' ? 0 : 20; // valeurs par défaut d'expo-video (0 = iOS décide)

export function FeedVideo({ uri, active, preload = false, style }: {
  uri: string;
  active: boolean;
  /** Carte voisine : le lecteur se tient prêt en pause et ne charge que le début de la vidéo. */
  preload?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  // Le lecteur n'existe que pour la carte visible. Avant, chaque vidéo du fil créait son lecteur dès
  // l'affichage de la carte et commençait à télécharger : plusieurs vidéos de 20 Mo se disputaient la
  // connexion avec les photos, et tout le fil ralentissait.
  // Carte pas encore à l'écran : une icône de lecture, pour que la case ne passe pas pour une image cassée.
  if (!active && !preload) {
    return (
      <View style={[style, { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }]}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play" size={24} color="rgba(255,255,255,0.85)" style={{ marginLeft: 3 }} />
        </View>
      </View>
    );
  }
  return <FeedVideoPlayer uri={uri} playing={active} style={style} />;
}

function FeedVideoPlayer({ uri, playing, style }: { uri: string; playing: boolean; style?: StyleProp<ViewStyle> }) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = true;
    if (!playing) p.bufferOptions = { preferredForwardBufferDuration: PRELOAD_SEC };
  });

  // Pas de useCaching d'expo-video : essayé le 30/10/2026, les vidéos du fil ne se lisaient plus du tout sur iOS.
  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => {
    if (!playing) { player.pause(); return; }
    player.bufferOptions = { preferredForwardBufferDuration: FULL_BUFFER_SEC };
    player.play();
  }, [playing, player]);

  return (
    <Pressable
      style={style}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); setMuted(m => !m); }}
      accessibilityLabel={muted ? t('video.unmute') : t('video.mute')}
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
