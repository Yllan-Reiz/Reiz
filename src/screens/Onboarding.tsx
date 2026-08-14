import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { CGU_URL, PRIVACY_URL } from '../constants';
import { s } from '../styles';

export function Onboarding({ onNext }: { onNext: () => void }) {
  const [step, setStep] = useState(0);
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
    if (!trimmedName || !trimmedEmail || !password) { Alert.alert('Erreur', 'Remplis tous les champs !'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { Alert.alert('Erreur', 'Email invalide.'); return; }
    if (password.length < 6) { Alert.alert('Erreur', 'Le mot de passe doit faire au moins 6 caractères.'); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail, password,
      options: { data: { full_name: trimmedName } },
    });
    if (error) { setLoading(false); Alert.alert('Erreur', frError(error)); return; }
    if (!data.user) { setLoading(false); Alert.alert('Erreur', 'Compte non créé, réessaie.'); return; }

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
        Alert.alert('Erreur', frError(insErr));
        return;
      }
    }
    if (!inserted) {
      setLoading(false);
      Alert.alert('Erreur', "Impossible de créer ton profil. Réessaie.");
      return;
    }

    setLoading(false);

    // Si confirmation email requise, pas de session → on ne navigue pas vers Main
    if (!data.session) {
      Alert.alert(
        'Vérifie ta boîte mail',
        `Un email a été envoyé à ${trimmedEmail}. Clique sur le lien pour confirmer ton compte, puis reviens te connecter.`,
        [{ text: 'OK', onPress: () => setShowLogin(true) }]
      );
      return;
    }

    // Session active : onAuthStateChange va naviguer vers Main, l'alert reste informatif
    Alert.alert('Bienvenue sur Reiz', '', [{ text: 'C\'est parti' }]);
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { Alert.alert('Erreur', 'Remplis tous les champs !'); return; }
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoginLoading(false);
    if (error) Alert.alert('Erreur', frError(error));
  };

  if (showLogin) {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView style={s.obContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Text style={s.headline}>Bon retour</Text>
        <Text style={s.subtext}>Connecte-toi pour reprendre ta progression.</Text>
        <View style={s.inputBlock}>
          <Text style={s.inputLabel}>EMAIL</Text>
          <TextInput style={s.inputField} placeholder="yllan@reiz.app" placeholderTextColor="#666" value={loginEmail} onChangeText={setLoginEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
        </View>
        <View style={s.inputBlock}>
          <Text style={s.inputLabel}>MOT DE PASSE</Text>
          <TextInput style={s.inputField} placeholder="••••••••" placeholderTextColor="#666" value={loginPassword} onChangeText={setLoginPassword} secureTextEntry maxLength={72} />
        </View>
        <TouchableOpacity style={[s.btn, { marginTop: 8 }, loginLoading && s.btnDisabled]} onPress={loginLoading ? undefined : handleLogin}>
          {loginLoading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Se connecter →</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.obBackBtn} onPress={() => setShowLogin(false)}>
          <Text style={s.obBackText}>← Retour</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    );
  }

  // Écrans 0-3 (4 écrans), écran 4 = formulaire compte
  const TOTAL_STEPS = 4;

  const canGoNext = step < TOTAL_STEPS;

  return (
    <KeyboardAvoidingView style={s.obContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
            <Text style={s.obBackArrowText}>←</Text>
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
            <Text style={s.obBigTitle}>Tes proches savent quand tu lâches ton entraînement.</Text>
            <Text style={s.obBody}>Reiz transforme ton entourage en raison de ne pas lâcher.</Text>
          </View>
          <View style={s.obNextWrap}>
            <TouchableOpacity style={s.btn} onPress={next}><Text style={s.btnText}>Suivant →</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {step === 1 && (
        <View style={s.obScreen}>
          <View>
            <Text style={s.obBigTitle}>Un cercle. Un objectif. Zéro excuse.</Text>
            <Text style={s.obBody}>Tu choisis ton objectif sportif. Tu invites les personnes qui comptent. Ils voient ta progression chaque jour et toi la leur.</Text>
          </View>
          <View style={s.obNextWrap}>
            <TouchableOpacity style={s.btn} onPress={next}><Text style={s.btnText}>Suivant →</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={s.obScreen}>
          <View>
            <Text style={s.obBigTitle}>La discipline seul, ça ne tient pas.</Text>
            <Text style={s.obBody}>Les applications de sport te demandent d'être motivé tout seul. Reiz, non. Quand quelqu'un que tu respectes regarde, tu te lèves.</Text>
          </View>
          <View style={s.obNextWrap}>
            <TouchableOpacity style={s.btn} onPress={next}><Text style={s.btnText}>Suivant →</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={s.obScreen}>
          <View>
            <Text style={s.obBigTitle}>Crée ton compte et invite ton cercle.</Text>
            <Text style={s.obBody}>Gratuit. 2 minutes. Et quelqu'un dans ton entourage va le voir dès ce soir.</Text>
          </View>
          <View style={s.obBottom}>
            <TouchableOpacity style={s.btn} onPress={next}><Text style={s.btnText}>Créer mon compte →</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {step < 3 && (
        <TouchableOpacity style={s.obLoginLink} onPress={() => setShowLogin(true)}>
          <Text style={s.splashLogin}>Déjà un compte ? <Text style={s.splashLoginLink}>Se connecter</Text></Text>
        </TouchableOpacity>
      )}

      {step === 4 && (
        <ScrollView style={s.screen} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={s.headline}>Dernière étape.</Text>
          <Text style={s.subtext}>Ton parcours commence maintenant.</Text>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>PRÉNOM</Text>
            <TextInput style={s.inputField} placeholder="Yllan" placeholderTextColor="#666" value={name} onChangeText={setName} autoCapitalize="words" maxLength={40} />
          </View>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>EMAIL</Text>
            <TextInput style={s.inputField} placeholder="yllan@reiz.app" placeholderTextColor="#666" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
          </View>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>MOT DE PASSE</Text>
            <TextInput style={s.inputField} placeholder="••••••••" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry maxLength={72} />
          </View>
          <TouchableOpacity style={[s.btn, { marginTop: 8 }, loading && s.btnDisabled]} onPress={loading ? undefined : handleSignUp}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Créer mon compte</Text>}
          </TouchableOpacity>
          <Text style={s.legal}>
            En créant un compte tu acceptes nos{' '}
            <Text style={s.legalLink} onPress={() => Linking.openURL(CGU_URL).catch(() => {})}>CGU</Text>
            {' '}et notre{' '}
            <Text style={s.legalLink} onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}>politique de confidentialité</Text>
          </Text>
        </ScrollView>
      )}

    </KeyboardAvoidingView>
  );
}
