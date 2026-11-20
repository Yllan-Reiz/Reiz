import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import { AUTH_BTN } from '../components/GoogleButton';
import { KeyboardFrame, KeyboardScroll } from '../components/KeyboardFrame';
import { BubbleSplash } from '../components/BubbleSplash';
import { PasswordInput, ForgotPasswordLink } from '../components/PasswordTools';
import { WeekSplash } from '../components/WeekSplash';
import { BUBBLE_SPLASH, WEEK_SPLASH } from '../constants';
import { s } from '../styles';
import { t } from '../i18n';

// Boutons en pilule, comme Apple et Google juste en dessous.
const pill = { minHeight: AUTH_BTN.height, borderRadius: AUTH_BTN.radius };
const btnLabel = { fontSize: AUTH_BTN.text };

export function Splash({ onNext }: { onNext: () => void }) {
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert(t('common.error'), t('common.fillAll')); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert(t('common.error'), frError(error));
  };

  if (showLogin) {
    return (
      <KeyboardFrame style={{ backgroundColor: '#0a0a0a' }}>
        <StatusBar barStyle="light-content" />
        <KeyboardScroll contentContainerStyle={s.splashLoginContent}>
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Image source={require('../../assets/ecriture-reiz-blanc.png')} style={s.splashLogoLogin} resizeMode="contain" />
            <Text style={s.splashTagline}>RISE TO YOUR GOALS</Text>
          </View>
          <View style={s.inputBlock}>
            <Text style={[s.inputLabel, s.authLabel]}>{t('auth.emailLabel')}</Text>
            <TextInput style={[s.inputField, s.authField]} placeholder={t('auth.emailPlaceholder')} placeholderTextColor="#666" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" keyboardAppearance="dark" maxLength={254} />
          </View>
          <View style={s.inputBlock}>
            <Text style={[s.inputLabel, s.authLabel]}>{t('auth.passwordLabel')}</Text>
            <PasswordInput style={[s.inputField, s.authField]} placeholder="••••••••" placeholderTextColor="#666" value={password} onChangeText={setPassword} keyboardAppearance="dark" textContentType="password" autoComplete="current-password" maxLength={72} />
          </View>
          <ForgotPasswordLink email={email} />
          <TouchableOpacity style={[s.btn, pill, { marginTop: 8 }, loading && s.btnDisabled]} onPress={loading ? undefined : handleLogin}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={[s.btnText, btnLabel]}>{t('auth.signInArrow')}</Text>}
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 14 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#222' }} />
            <Text style={{ color: '#8a8a8a', fontSize: 12 }}>{t('common.or')}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#222' }} />
          </View>
          <SocialAuthButtons mode="signin" />
          <TouchableOpacity style={{ marginTop: 16, paddingVertical: 8, alignItems: 'center' }} onPress={() => setShowLogin(false)}>
            <Text style={s.splashLogin}>{t('common.backArrow')}</Text>
          </TouchableOpacity>
        </KeyboardScroll>
      </KeyboardFrame>
    );
  }

  if (WEEK_SPLASH) return <WeekSplash onStart={onNext} onLogin={() => setShowLogin(true)} />;
  if (BUBBLE_SPLASH) return <BubbleSplash onStart={onNext} onLogin={() => setShowLogin(true)} />;

  return (
    <View style={[s.splashContainer, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar barStyle="light-content" />
      {/* Le logo se centre dans l'espace AU-DESSUS des boutons, pas dans tout l'écran. */}
      <View style={s.splashHero}>
        <Image source={require('../../assets/ecriture-reiz-blanc.png')} style={s.splashLogo} resizeMode="contain" />
        <Text style={s.splashTagline}>RISE TO YOUR GOALS</Text>
      </View>
      <View style={s.splashBottom}>
        <TouchableOpacity style={[s.btn, pill]} onPress={onNext}>
          <Text style={[s.btnText, btnLabel]}>{t('auth.start')}</Text>
        </TouchableOpacity>
        <SocialAuthButtons />
        <TouchableOpacity style={{ marginTop: 18, paddingVertical: 10, alignItems: 'center' }} onPress={() => setShowLogin(true)}>
          <Text style={s.splashLogin}>{t('auth.haveAccount')} <Text style={s.splashLoginLink}>{t('auth.signIn')}</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
