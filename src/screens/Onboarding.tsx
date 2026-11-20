import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { CGU_URL, PRIVACY_URL, QUICK_START } from '../constants';
import { Ionicons } from '@expo/vector-icons';
import { setPendingName } from '../lib/googleAuth';
import { trackAnon } from '../lib/track';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import { AUTH_BTN } from '../components/GoogleButton';
import { KeyboardFrame, KeyboardScroll } from '../components/KeyboardFrame';
import { PasswordInput, ForgotPasswordLink } from '../components/PasswordTools';
import { FEATURES } from '../lib/features';
import { s, F } from '../styles';
import { t, lang, dirIcon } from '../i18n';

export function Onboarding({ onNext, onBack }: { onNext: () => void; onBack?: () => void }) {
  const [step, setStep] = useState(0);
  // 1.4 : l'e-mail et le mot de passe ne s'affichent que si on choisit « avec un e-mail ».
  const [withEmail, setWithEmail] = useState(false);
  // Début de l'onboarding, avant tout compte (pour mesurer qui s'arrête ici).
  useEffect(() => { if (QUICK_START) trackAnon('onboarding_start'); }, []);
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const next = () => setStep(st => st + 1);

  const handleSignUp = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || !password) { Alert.alert(t('common.error'), t('common.fillAll')); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { Alert.alert(t('common.error'), t('auth.badEmail')); return; }
    if (password.length < 6) { Alert.alert(t('common.error'), t('errors.passwordTooShort6')); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail, password,
      options: { data: { full_name: trimmedName } },
    });
    if (error) { setLoading(false); Alert.alert(t('common.error'), frError(error)); return; }
    if (!data.user) { setLoading(false); Alert.alert(t('common.error'), t('auth.accountNotCreated')); return; }

    // Username unique : base + suffixe random si collision
    const base = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
    let username = base;
    let attempt = 0;
    let inserted = false;
    while (attempt < 4 && !inserted) {
      const { error: insErr } = await supabase.from('users').insert({
        id: data.user.id, username, full_name: trimmedName, language: lang(),
      });
      if (!insErr) { inserted = true; break; }
      if (insErr.code === '23505') {
        username = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
        attempt++;
      } else {
        setLoading(false);
        Alert.alert(t('common.error'), frError(insErr));
        return;
      }
    }
    if (!inserted) {
      setLoading(false);
      Alert.alert(t('common.error'), t('auth.profileNotCreated'));
      return;
    }

    setLoading(false);

    // Si confirmation email requise, pas de session → on ne navigue pas vers Main
    if (!data.session) {
      Alert.alert(
        t('auth.checkMailTitle'),
        t('auth.checkMailText', { email: trimmedEmail }),
        [{ text: t('common.ok'), onPress: () => setShowLogin(true) }]
      );
      return;
    }

    // Session active : onAuthStateChange va naviguer vers Main, l'alert reste informatif
    if (!QUICK_START) Alert.alert(t('auth.welcomeTitle'), '', [{ text: t('auth.letsGo') }]);
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { Alert.alert(t('common.error'), t('common.fillAll')); return; }
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword });
    setLoginLoading(false);
    if (error) Alert.alert(t('common.error'), frError(error));
  };

  if (showLogin) {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardFrame style={[s.obContainer, { paddingTop: insets.top + 16 }]}>
        <Text style={s.headline}>{t('auth.welcomeBack')}</Text>
        <Text style={s.subtext}>{t('auth.welcomeBackSub')}</Text>
        <View style={s.inputBlock}>
          <Text style={[s.inputLabel, s.authLabel]}>{t('auth.emailLabel')}</Text>
          <TextInput style={[s.inputField, s.authField]} placeholder={t('auth.emailPlaceholder')} placeholderTextColor="#666" value={loginEmail} onChangeText={setLoginEmail} keyboardType="email-address" autoCapitalize="none" keyboardAppearance="dark" maxLength={254} />
        </View>
        <View style={s.inputBlock}>
          <Text style={[s.inputLabel, s.authLabel]}>{t('auth.passwordLabel')}</Text>
          <PasswordInput style={[s.inputField, s.authField]} placeholder="••••••••" placeholderTextColor="#666" value={loginPassword} onChangeText={setLoginPassword} keyboardAppearance="dark" textContentType="password" autoComplete="current-password" maxLength={72} />
        </View>
        <ForgotPasswordLink email={loginEmail} />
        <TouchableOpacity style={[s.btn, { marginTop: 8, minHeight: AUTH_BTN.height, borderRadius: AUTH_BTN.radius }, loginLoading && s.btnDisabled]} onPress={loginLoading ? undefined : handleLogin}>
          {loginLoading ? <ActivityIndicator color="#000" /> : <Text style={[s.btnText, { fontSize: AUTH_BTN.text }]}>{t('auth.signInArrow')}</Text>}
        </TouchableOpacity>
        {/* Essai du 19/11/2026 : un compte créé avec Apple ou Google retrouve son bouton ici aussi (comme sur l'accueil). */}
        {FEATURES.socialOnLogin && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: '#222' }} />
              <Text style={{ color: '#8a8a8a', fontSize: 12 }}>{t('common.or')}</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: '#222' }} />
            </View>
            <SocialAuthButtons mode="signin" />
          </>
        )}
        <TouchableOpacity style={s.obBackBtn} onPress={() => setShowLogin(false)}>
          <Text style={s.obBackText}>{t('common.backArrow')}</Text>
        </TouchableOpacity>
      </KeyboardFrame>
      </TouchableWithoutFeedback>
    );
  }

  // 1.4, onboarding express : un seul écran avant le compte. Le prénom, puis Apple, Google ou un e-mail.
  // Les 4 écrans de présentation ne sont plus montrés (l'ancien parcours reste plus bas, QUICK_START = false).
  if (QUICK_START) {
    const first = name.trim();
    // Apple et Google ne donnent pas toujours le prénom : celui tapé ici est repris à la création du profil.
    const onName = (v: string) => { setName(v); setPendingName(v.trim() || null); };
    return (
      <KeyboardFrame style={{ backgroundColor: '#0a0a0a' }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, height: insets.top + 48 }}>
          <TouchableOpacity onPress={onBack} disabled={!onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.back')} style={{ width: 28, opacity: onBack ? 1 : 0 }}>
            <Ionicons name={dirIcon('chevron-back')} size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 }} accessibilityLabel={t('quick.progress', { n: 1, total: 3 })}>
            {[0, 1, 2].map(i => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i === 0 ? '#fff' : 'rgba(255,255,255,0.18)' }} />)}
          </View>
          <View style={{ width: 28 }} />
        </View>
        <KeyboardScroll contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: insets.bottom + 24 }}>
          <Text style={{ color: '#fff', fontSize: 34, lineHeight: 38, fontFamily: F.black, letterSpacing: -1.1 }} maxFontSizeMultiplier={1.2}>{t('quick.nameTitle')}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 23, fontFamily: F.regular, marginTop: 10 }}>{t('quick.nameSub')}</Text>
          <TextInput
            style={{ marginTop: 20, minHeight: 58, borderRadius: 24, paddingHorizontal: 20, color: '#fff', fontSize: 20, fontFamily: F.bold, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: first ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.14)' }}
            placeholder={t('onboarding.firstNamePlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={name}
            onChangeText={onName}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            keyboardAppearance="dark"
            textContentType="givenName"
            autoComplete="given-name"
            returnKeyType="done"
            maxLength={40}
            accessibilityLabel={t('onboarding.firstNameLabel')}
          />

          {/* Les trois boutons doivent tenir au-dessus du clavier : pas de marge en plus de celle des boutons. */}
          <View style={{ marginTop: 4 }}>
            <SocialAuthButtons mode="continue" />
          </View>

          {!withEmail ? (
            <TouchableOpacity onPress={() => setWithEmail(true)} activeOpacity={0.85} accessibilityRole="button"
              style={{ marginTop: AUTH_BTN.gap, minHeight: AUTH_BTN.height, borderRadius: AUTH_BTN.radius, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
              <Ionicons name="mail-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: AUTH_BTN.text, fontFamily: F.bold }}>{t('quick.withEmail')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ marginTop: 18 }}>
              <TextInput style={quickField} placeholder={t('auth.emailPlaceholder')} placeholderTextColor="rgba(255,255,255,0.4)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoFocus keyboardAppearance="dark" textContentType="emailAddress" autoComplete="email" maxLength={254} accessibilityLabel={t('auth.emailLabel')} />
              <PasswordInput style={quickField} wrapStyle={{ marginTop: 10 }} placeholder={t('quick.passwordPlaceholder')} placeholderTextColor="rgba(255,255,255,0.4)" value={password} onChangeText={setPassword} keyboardAppearance="dark" textContentType="newPassword" autoComplete="new-password" maxLength={72} accessibilityLabel={t('auth.passwordLabel')} />
              <TouchableOpacity style={[s.btn, { marginTop: AUTH_BTN.gap, minHeight: AUTH_BTN.height, borderRadius: AUTH_BTN.radius }, loading && s.btnDisabled]} onPress={loading ? undefined : handleSignUp} accessibilityRole="button">
                {loading ? <ActivityIndicator color="#000" /> : <Text style={[s.btnText, { fontSize: AUTH_BTN.text }]}>{t('quick.continue')}</Text>}
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.legal}>
            {t('onboarding.legalBefore')}{' '}
            <Text style={s.legalLink} onPress={() => Linking.openURL(CGU_URL).catch(() => {})}>{t('onboarding.legalTerms')}</Text>
            {' '}{t('onboarding.legalAnd')}{' '}
            <Text style={s.legalLink} onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}>{t('onboarding.legalPrivacy')}</Text>
          </Text>
          <TouchableOpacity onPress={() => setShowLogin(true)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
            <Text style={s.splashLogin}>{t('auth.haveAccount')} <Text style={s.splashLoginLink}>{t('auth.signIn')}</Text></Text>
          </TouchableOpacity>
        </KeyboardScroll>
      </KeyboardFrame>
    );
  }

  // Écrans 0-3 (4 écrans), écran 4 = formulaire compte
  const TOTAL_STEPS = 4;

  const canGoNext = step < TOTAL_STEPS;

  return (
    <KeyboardAvoidingView style={[s.obContainer, { paddingTop: insets.top + 16 }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Zones de tap gauche/droite */}
      {step !== 4 && (
        <View style={s.obTapZones} pointerEvents="box-none">
          <TouchableOpacity style={s.obTapLeft} onPress={() => step > 0 && setStep(st => st - 1)} activeOpacity={1} />
          <TouchableOpacity style={s.obTapRight} onPress={() => canGoNext && setStep(st => st + 1)} activeOpacity={1} />
        </View>
      )}

      <View style={s.obTopRow}>
        {step === 4 && (
          <TouchableOpacity style={s.obBackArrow} onPress={() => setStep(3)}>
            <Text style={s.obBackArrowText}>{t('common.backGlyph')}</Text>
          </TouchableOpacity>
        )}
        {step < TOTAL_STEPS && (
          <View style={s.obProgress}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View key={i} style={[s.obProgressBar, step >= i && s.obProgressBarActive]} />
            ))}
          </View>
        )}
      </View>

      {step === 0 && (
        <View style={s.obScreen}>
          <View>
            <Text style={s.obBigTitle}>{t('onboarding.s1Title')}</Text>
            <Text style={s.obBody}>{t('onboarding.s1Body')}</Text>
          </View>
          <View style={s.obNextWrap}>
            <TouchableOpacity style={s.btn} onPress={next}><Text style={s.btnText}>{t('common.nextArrow')}</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {step === 1 && (
        <View style={s.obScreen}>
          <View>
            <Text style={s.obBigTitle}>{t('onboarding.s2Title')}</Text>
            <Text style={s.obBody}>{t('onboarding.s2Body')}</Text>
          </View>
          <View style={s.obNextWrap}>
            <TouchableOpacity style={s.btn} onPress={next}><Text style={s.btnText}>{t('common.nextArrow')}</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={s.obScreen}>
          <View>
            <Text style={s.obBigTitle}>{t('onboarding.s3Title')}</Text>
            <Text style={s.obBody}>{t('onboarding.s3Body')}</Text>
          </View>
          <View style={s.obNextWrap}>
            <TouchableOpacity style={s.btn} onPress={next}><Text style={s.btnText}>{t('common.nextArrow')}</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={s.obScreen}>
          <View>
            <Text style={s.obBigTitle}>{t('onboarding.s4Title')}</Text>
            <Text style={s.obBody}>{t('onboarding.s4Body')}</Text>
          </View>
          {/* Même place que les « Suivant » des écrans d'avant : le bouton ne saute pas. */}
          <View style={s.obNextWrap}>
            <TouchableOpacity style={s.btn} onPress={next}><Text style={s.btnText}>{t('onboarding.createArrow')}</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {step < 3 && (
        <TouchableOpacity style={s.obLoginLink} onPress={() => setShowLogin(true)}>
          <Text style={s.splashLogin}>{t('auth.haveAccount')} <Text style={s.splashLoginLink}>{t('auth.signIn')}</Text></Text>
        </TouchableOpacity>
      )}

      {step === 4 && (
        <ScrollView style={s.screen} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={s.headline}>{t('onboarding.lastStep')}</Text>
          <Text style={s.subtext}>{t('onboarding.lastStepSub')}</Text>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>{t('onboarding.firstNameLabel')}</Text>
            <TextInput style={s.inputField} placeholder={t('onboarding.firstNamePlaceholder')} placeholderTextColor="#666" value={name} onChangeText={setName} autoCapitalize="words" maxLength={40} />
          </View>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>{t('auth.emailLabel')}</Text>
            <TextInput style={s.inputField} placeholder={t('auth.emailPlaceholder')} placeholderTextColor="#666" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
          </View>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>{t('auth.passwordLabel')}</Text>
            <TextInput style={s.inputField} placeholder="••••••••" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry maxLength={72} />
          </View>
          <TouchableOpacity style={[s.btn, { marginTop: 8 }, loading && s.btnDisabled]} onPress={loading ? undefined : handleSignUp}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>{t('onboarding.create')}</Text>}
          </TouchableOpacity>
          <SocialAuthButtons mode="signup" />
          <Text style={s.legal}>
            {t('onboarding.legalBefore')}{' '}
            <Text style={s.legalLink} onPress={() => Linking.openURL(CGU_URL).catch(() => {})}>{t('onboarding.legalTerms')}</Text>
            {' '}{t('onboarding.legalAnd')}{' '}
            <Text style={s.legalLink} onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}>{t('onboarding.legalPrivacy')}</Text>
          </Text>
        </ScrollView>
      )}

    </KeyboardAvoidingView>
  );
}

const quickField = { minHeight: 52, borderRadius: 16, paddingHorizontal: 16, color: '#fff', fontSize: 16, fontFamily: F.semibold, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' } as const;
