import { useState } from 'react';
import { Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { signInWithGoogle } from '../lib/googleAuth';
import { s } from '../styles';

export function GoogleButton() {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const err = await signInWithGoogle();
    setBusy(false);
    if (err) Alert.alert('Erreur', err);
  };
  return (
    <TouchableOpacity style={[s.btn, { backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', marginTop: 10 }, busy && s.btnDisabled]} onPress={busy ? undefined : go}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={[s.btnText, { color: '#fff' }]}>Continuer avec Google</Text>}
    </TouchableOpacity>
  );
}
