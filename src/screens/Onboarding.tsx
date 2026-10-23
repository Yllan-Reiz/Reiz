import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { CGU_URL, PRIVACY_URL } from '../constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import { s } from '../styles';
import { t } from '../i18n';

export function Onboarding({ onNext }: { onNext: () => void }) {
  const [step, setStep] = useState(0);
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
        id: data.user.id, username, full_name: trimmedName,
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
    Alert.alert(t('auth.welcomeTitle'), '', [{ text: t('auth.letsGo') }]);
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { Alert.alert(t('common.error'), t('common.fillAll')); return; }
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoginLoading(false);
    if (error) Alert.alert(t('common.error'), frError(error));
  };

  if (showLogin) {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView style={[s.obContainer, { paddingTop: insets.top + 16 }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Text style={s.headline}>{t('auth.welcomeBack')}</Text>
        <Text style={s.subtext}>{t('auth.welcomeBackSub')}</Text>
        <View style={s.inputBlock}>
          <Text style={s.inputLabel}>{t('auth.emailLabel')}</Text>
          <TextInput style={s.inputField} placeholder={t('auth.emailPlaceholder')} placeholderTextColor="#666" value={loginEmail} onChangeText={setLoginEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
        </View>
        <View style={s.inputBlock}>
          <Text style={s.inputLabel}>{t('auth.passwordLabel')}</Text>
          <TextInput style={s.inputField} placeholder="••••••••" placeholderTextColor="#666" value={loginPassword} onChangeText={setLoginPassword} secureTextEntry maxLength={72} />
        </View>
        <TouchableOpacity style={[s.btn, { marginTop: 8 }, loginLoading && s.btnDisabled]} onPress={loginLoading ? undefined : handleLogin}>
          {loginLoading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>{t('auth.signInArrow')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.obBackBtn} onPress={() => setShowLogin(false)}>
          <Text style={s.obBackText}>{t('common.backArrow')}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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
