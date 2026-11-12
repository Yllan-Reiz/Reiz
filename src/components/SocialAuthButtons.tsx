import { useEffect, useState } from 'react';
import { View, Pressable, Alert, Platform, ActivityIndicator } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { signInWithApple, isAppleAvailable } from '../lib/appleAuth';
import { GoogleButton, AuthMode, AUTH_BTN } from './GoogleButton';
import { t } from '../i18n';

const APPLE_TYPE = {
  signin: AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN,
  signup: AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP,
  continue: AppleAuthentication.AppleAuthenticationButtonType.CONTINUE,
};

const APPLE_H = 46;

// « Se connecter avec Apple » (obligatoire à côté de Google) puis « Continuer avec Google ».
// Le bouton Apple est le composant officiel : Apple exige son style exact.
export function SocialAuthButtons({ mode = 'continue' }: { mode?: AuthMode }) {
  // Sur iPhone le bouton Apple est là dès la première image (il existe depuis iOS 13) : sans cela il arrivait
  // un instant après et poussait « Commencer » vers le haut. On le retire seulement si le téléphone dit non.
  const [apple, setApple] = useState(Platform.OS === 'ios');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (Platform.OS === 'ios') isAppleAvailable().then(setApple); }, []);

  const go = async () => {
    setBusy(true);
    const err = await signInWithApple();
    setBusy(false);
    if (err) Alert.alert(t('common.error'), err);
  };

  return (
    <View style={{ marginTop: AUTH_BTN.gap }}>
      {apple && (busy
        ? <View style={{ height: AUTH_BTN.height, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
        : (
          // Le bouton officiel règle la taille de son texte sur sa hauteur : à 54 de haut, « Continuer avec Apple »
          // s'écrivait plus gros que tous les autres boutons. On garde donc le composant officiel, intact, mais à
          // la hauteur qui donne un texte de 17, posé dans une pilule blanche de la hauteur commune (blanc sur blanc).
          <Pressable onPress={go} accessible={false} style={{ height: AUTH_BTN.height, borderRadius: AUTH_BTN.radius, backgroundColor: '#fff', justifyContent: 'center', overflow: 'hidden' }}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={APPLE_TYPE[mode]}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={0}
              style={{ width: '100%', height: APPLE_H }}
              onPress={go}
            />
          </Pressable>
        ))}
      <GoogleButton mode={mode} />
    </View>
  );
}
