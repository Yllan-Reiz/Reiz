import { ReactNode, useEffect, useState } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

// Image d'aperçu d'une vidéo : la première image, lecteur en pause et muet (aucun module en plus : on réutilise
// expo-video déjà dans l'app). Avant, les vidéos de l'historique, de l'activité et des vignettes montraient
// un carré gris avec un triangle « lecture ».
//
// Chaque aperçu ouvre un lecteur, donc un petit téléchargement : on plafonne à MAX_LIVE aperçus à l'écran en même
// temps, les autres gardent leur carré de repli (`fallback`) jusqu'à ce qu'une place se libère.
const MAX_LIVE = 8;
let live = 0;

export function VideoPoster({ uri, style, fallback }: { uri: string; style?: StyleProp<ViewStyle>; fallback?: ReactNode }) {
  const [claimed] = useState(() => { if (live < MAX_LIVE) { live += 1; return true; } return false; });
  useEffect(() => () => { if (claimed) live -= 1; }, [claimed]);
  if (!claimed) return <View style={style}>{fallback}</View>;
  return <PosterPlayer uri={uri} style={style} fallback={fallback} />;
}

function PosterPlayer({ uri, style, fallback }: { uri: string; style?: StyleProp<ViewStyle>; fallback?: ReactNode }) {
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(uri, p => {
    p.muted = true;
    p.loop = false;
    p.pause();
    p.currentTime = 0.1; // force l'affichage d'une image
  });
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }: { status: string }) => { if (status === 'readyToPlay') { setReady(true); player.pause(); } });
    return () => sub.remove();
  }, [player]);
  return (
    <View style={style} pointerEvents="none">
      {!ready && fallback}
      <VideoView
        player={player}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: ready ? 1 : 0 }}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}
