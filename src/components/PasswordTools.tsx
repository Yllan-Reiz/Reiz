import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { sendPasswordReset } from '../lib/passwordReset';
import { FEATURES } from '../lib/features';
import { s, F } from '../styles';
import { t } from '../i18n';

// Essai du 19/11/2026 (testeurs fictifs) : tout ce qui touche au mot de passe sur les écrans d'entrée.
//   PasswordInput      le champ habituel, avec un œil pour relire ce qu'on tape (une faute de frappe verrouillait le compte)
//   ForgotPasswordLink « Mot de passe oublié ? » sous le champ (FEATURES.forgotPassword)
//   NewPasswordModal   s'ouvre au retour du lien reçu par e-mail

/** Un champ mot de passe avec son œil. `wrapStyle` porte les marges (le champ garde son style d'origine). */
export function PasswordInput({ style, wrapStyle, ...props }: TextInputProps & { wrapStyle?: StyleProp<ViewStyle> }) {
  const [shown, setShown] = useState(false);
  return (
    <View style={[{ justifyContent: 'center' }, wrapStyle]}>
      <TextInput {...props} style={[style, { paddingRight: 52 }]} secureTextEntry={!shown} />
      <TouchableOpacity onPress={() => setShown(v => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t(shown ? 'auth.hidePassword' : 'auth.showPassword')}
        style={{ position: 'absolute', right: 6, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>
    </View>
  );
}

/** Le lien sous le champ. Il se sert de l'e-mail déjà tapé dans le champ du dessus. */
export function ForgotPasswordLink({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  if (!FEATURES.forgotPassword) return null;
  const send = async () => {
    const to = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { Alert.alert(t('auth.forgot'), t('auth.forgotNeedEmail')); return; }
    setBusy(true);
    const error = await sendPasswordReset(to);
    setBusy(false);
    if (error) { Alert.alert(t('common.error'), frError(error)); return; }
    Alert.alert(t('auth.forgotSentTitle'), t('auth.forgotSentText', { email: to }));
  };
  return (
    <TouchableOpacity onPress={busy ? undefined : send} accessibilityRole="button" hitSlop={6} style={{ alignSelf: 'flex-end', minHeight: 32, justifyContent: 'center', marginTop: -6, marginBottom: 6 }}>
      {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#bbb', fontSize: 14, fontFamily: F.semibold }}>{t('auth.forgot')}</Text>}
    </TouchableOpacity>
  );
}

/** Au retour du lien : la personne est connectée, elle choisit son nouveau mot de passe. */
export function NewPasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [pwd, setPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const ok = pwd.length >= 8;
  const save = async () => {
    if (!ok) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSaving(false);
    if (error) { Alert.alert(t('common.error'), /same|different/i.test(error.message) ? t('settings.pwdSame') : frError(error)); return; }
    setPwd('');
    Alert.alert(t('settings.pwdChanged'), t('settings.pwdChangedText'));
    onClose();
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: insets.top + 24, paddingHorizontal: 24 }}>
        <Text style={{ color: '#fff', fontSize: 34, lineHeight: 38, fontFamily: F.black, letterSpacing: -1.1 }} maxFontSizeMultiplier={1.2}>{t('auth.newPasswordTitle')}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 23, fontFamily: F.regular, marginTop: 10, marginBottom: 22 }}>{t('auth.newPasswordSub')}</Text>
        <PasswordInput style={[s.inputField, s.authField]} placeholder={t('settings.pwdMin')} placeholderTextColor="#888" value={pwd} onChangeText={setPwd} autoFocus autoCapitalize="none" keyboardAppearance="dark" textContentType="newPassword" autoComplete="new-password" maxLength={72} accessibilityLabel={t('settings.newPwd')} />
        <TouchableOpacity style={[s.btn, { marginTop: 16, minHeight: 54, borderRadius: 27 }, !ok && s.btnDisabled]} onPress={saving ? undefined : save} accessibilityRole="button" accessibilityState={{ disabled: !ok }}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={[s.btnText, { fontSize: 17 }]}>{t('common.save')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} accessibilityRole="button" style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: F.semibold }}>{t('common.later')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
