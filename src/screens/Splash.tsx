import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, StatusBar, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import { s } from '../styles';

export function Splash({ onNext }: { onNext: () => void }) {
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Erreur', 'Remplis tous les champs !'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Erreur', frError(error));
  };

  if (showLogin) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#0a0a0a' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar barStyle="light-content" />
        <ScrollView
          contentContainerStyle={s.splashLoginContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Image source={require('../../assets/ecriture-reiz-blanc.png')} style={s.splashLogoLogin} resizeMode="contain" />
            <Text style={s.splashTagline}>RISE TO YOUR GOALS</Text>
          </View>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>EMAIL</Text>
            <TextInput style={s.inputField} placeholder="ton@email.com" placeholderTextColor="#666" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
          </View>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>MOT DE PASSE</Text>
            <TextInput style={s.inputField} placeholder="••••••••" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry maxLength={72} />
          </View>
          <TouchableOpacity style={[s.btn, { marginTop: 4 }, loading && s.btnDisabled]} onPress={loading ? undefined : handleLogin}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Se connecter →</Text>}
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 14 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#222' }} />
            <Text style={{ color: '#666', fontSize: 12 }}>ou</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#222' }} />
          </View>
          <SocialAuthButtons mode="signin" />
          <TouchableOpacity style={{ marginTop: 16, paddingVertical: 8, alignItems: 'center' }} onPress={() => setShowLogin(false)}>
            <Text style={s.splashLogin}>← Retour</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[s.splashContainer, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar barStyle="light-content" />
      {/* Le logo se centre dans l'espace AU-DESSUS des boutons, pas dans tout l'écran. */}
      <View style={s.splashHero}>
        <Image source={require('../../assets/ecriture-reiz-blanc.png')} style={s.splashLogo} resizeMode="contain" />
        <Text style={s.splashTagline}>RISE TO YOUR GOALS</Text>
      </View>
      <View style={s.splashBottom}>
        <TouchableOpacity style={s.btn} onPress={onNext}>
          <Text style={s.btnText}>Commencer →</Text>
        </TouchableOpacity>
        <SocialAuthButtons />
        <TouchableOpacity style={{ marginTop: 12, paddingVertical: 10, alignItems: 'center' }} onPress={() => setShowLogin(true)}>
          <Text style={s.splashLogin}>Déjà un compte ? <Text style={s.splashLoginLink}>Se connecter</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
