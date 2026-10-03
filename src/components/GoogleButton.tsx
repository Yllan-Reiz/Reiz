import { useState } from 'react';
import { Text, TouchableOpacity, Alert, ActivityIndicator, Image, View } from 'react-native';
import { signInWithGoogle } from '../lib/googleAuth';
import { F } from '../styles';

export type AuthMode = 'signin' | 'signup' | 'continue';

const LABELS: Record<AuthMode, string> = {
  signin: 'Se connecter avec Google',
  signup: "S'inscrire avec Google",
  continue: 'Continuer avec Google',
};

// Bouton officiel « Sign in with Google », thème sombre (charte Google) : fond #131314,
// liseré #8E918F, texte #E3E3E3, logo « G » quadricolore sans modification.
export function GoogleButton({ mode = 'continue' }: { mode?: AuthMode }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const err = await signInWithGoogle();
    setBusy(false);
    if (err) Alert.alert('Erreur', err);
  };
  return (
    <TouchableOpacity
      onPress={busy ? undefined : go}
      activeOpacity={0.85}
      accessibilityLabel={LABELS[mode]}
      style={{ marginTop: 10, height: 50, borderRadius: 16, backgroundColor: '#131314', borderWidth: 1, borderColor: '#8E918F', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}
    >
      {busy ? <ActivityIndicator color="#E3E3E3" /> : (
        <>
          <View style={{ width: 20, height: 20 }}><Image source={require('../../assets/google-g.png')} style={{ width: 20, height: 20 }} /></View>
          <Text style={{ color: '#E3E3E3', fontSize: 16, fontFamily: F.semibold }}>{LABELS[mode]}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
