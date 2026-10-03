import { useEffect, useState } from 'react';
import { View, Alert, Platform, ActivityIndicator } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { signInWithApple, isAppleAvailable } from '../lib/appleAuth';
import { GoogleButton } from './GoogleButton';

// « Se connecter avec Apple » (obligatoire à côté de Google) puis « Continuer avec Google ».
// Le bouton Apple est le composant officiel : Apple exige son style exact.
export function SocialAuthButtons() {
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (Platform.OS === 'ios') isAppleAvailable().then(setApple); }, []);

  const go = async () => {
    setBusy(true);
    const err = await signInWithApple();
    setBusy(false);
    if (err) Alert.alert('Erreur', err);
  };

  return (
    <View style={{ marginTop: 10 }}>
      {apple && (busy
        ? <View style={{ height: 50, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
        : (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={16}
            style={{ width: '100%', height: 50 }}
            onPress={go}
          />
        ))}
      <GoogleButton />
    </View>
  );
}
