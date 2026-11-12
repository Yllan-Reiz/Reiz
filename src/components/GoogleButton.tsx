import { useState } from 'react';
import { Text, TouchableOpacity, Alert, ActivityIndicator, Image, View } from 'react-native';
import { signInWithGoogle } from '../lib/googleAuth';
import { F } from '../styles';
import { t } from '../i18n';

export type AuthMode = 'signin' | 'signup' | 'continue';

// Les boutons des écrans d'entrée (accueil, connexion, prénom) : en pilule, bien détachés les uns des autres.
// `text` : la taille du libellé, la même sur tous les boutons (Commencer, Apple, Google, e-mail).
export const AUTH_BTN = { height: 54, radius: 27, gap: 14, text: 17 } as const;

const LABELS: Record<AuthMode, string> = {
  signin: t('auth.googleSignin'),
  signup: t('auth.googleSignup'),
  continue: t('auth.googleContinue'),
};

// Bouton officiel « Sign in with Google », thème sombre (charte Google) : fond #131314,
// liseré #8E918F, texte #E3E3E3, logo « G » quadricolore sans modification.
export function GoogleButton({ mode = 'continue' }: { mode?: AuthMode }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const err = await signInWithGoogle();
    setBusy(false);
    if (err) Alert.alert(t('common.error'), err);
  };
  return (
    <TouchableOpacity
      onPress={busy ? undefined : go}
      activeOpacity={0.85}
      accessibilityLabel={LABELS[mode]}
      style={{ marginTop: AUTH_BTN.gap, height: AUTH_BTN.height, borderRadius: AUTH_BTN.radius, backgroundColor: '#131314', borderWidth: 1, borderColor: '#8E918F', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}
    >
      {busy ? <ActivityIndicator color="#E3E3E3" /> : (
        <>
          <View style={{ width: 20, height: 20 }}><Image source={require('../../assets/google-g.png')} style={{ width: 20, height: 20 }} /></View>
          <Text style={{ color: '#E3E3E3', fontSize: AUTH_BTN.text, fontFamily: F.semibold }} maxFontSizeMultiplier={1.3}>{LABELS[mode]}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
