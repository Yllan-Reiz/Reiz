import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, StatusBar, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { s } from '../styles';

export function Splash({ onNext }: { onNext: () => void }) {
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
            <TextInput style={s.inputField} placeholder="yllan@reiz.app" placeholderTextColor="#666" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>MOT DE PASSE</Text>
            <TextInput style={s.inputField} placeholder="••••••••" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry />
          </View>
          <TouchableOpacity style={[s.btn, { marginTop: 8 }, loading && s.btnDisabled]} onPress={loading ? undefined : handleLogin}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Se connecter →</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 18, alignItems: 'center' }} onPress={() => setShowLogin(false)}>
            <Text style={s.splashLogin}>← Retour</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={s.splashContainer}>
      <StatusBar barStyle="light-content" />
      <Image source={require('../../assets/ecriture-reiz-blanc.png')} style={s.splashLogo} resizeMode="contain" />
      <Text style={s.splashTagline}>RISE TO YOUR GOALS</Text>
      <View style={s.splashBottom}>
        <TouchableOpacity style={s.btn} onPress={onNext}>
          <Text style={s.btnText}>Commencer →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 14, alignItems: 'center' }} onPress={() => setShowLogin(true)}>
          <Text style={s.splashLogin}>Déjà un compte ? <Text style={s.splashLoginLink}>Se connecter</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
