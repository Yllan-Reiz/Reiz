import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { supabase } from './supabase';

const GOALS = [
  { emoji: '💪', label: 'Perdre du poids' },
  { emoji: '💰', label: "Gagner de l'argent" },
  { emoji: '🏃', label: 'Courir' },
  { emoji: '📚', label: 'Lire' },
  { emoji: '🧘', label: 'Méditer' },
  { emoji: '🚀', label: 'Startup' },
  { emoji: '🏋️', label: 'Sport' },
  { emoji: '🏦', label: 'Épargne' },
];

export default function Onboarding({ onNext }: { onNext: () => void }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleGoal = (label: string) => {
    setSelected(prev =>
      prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]
    );
  };

  const next = () => {
    if (step < 2) setStep(s => s + 1);
  };

  const prev = () => setStep(s => s - 1);

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      Alert.alert('Erreur', 'Remplis tous les champs !');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });
    setLoading(false);
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      Alert.alert(
        'Compte créé ! 🎉',
        'Vérifie ta boîte mail pour confirmer ton adresse.',
        [{ text: 'OK', onPress: onNext }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
        ))}
      </View>

      {step === 0 && (
        <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>Bienvenue</Text>
          <Text style={styles.headline}>Tes objectifs méritent une communauté.</Text>
          <Text style={styles.subtext}>Les influenceurs réussissent car leur communauté les pousse. Reiz te donne ça, avec tes proches.</Text>
          <View style={styles.cards}>
            {[
              { emoji: '🤝', title: 'Cercle de confiance', desc: "Tes amis proches voient ta progression et t'encouragent." },
              { emoji: '📈', title: 'Progression visible', desc: 'Photo, texte, pourcentage — montre où tu en es.' },
              { emoji: '🔥', title: 'Motivation réelle', desc: "La streak quotidienne t'empêche d'abandonner." },
            ].map((card, i) => (
              <View key={i} style={styles.card}>
                <Text style={styles.cardEmoji}>{card.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardDesc}>{card.desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.btn} onPress={next}>
            <Text style={styles.btnText}>C'est parti →</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {step === 1 && (
        <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>Étape 1</Text>
          <Text style={styles.headline}>Choisis tes objectifs.</Text>
          <Text style={styles.subtext}>Sur quoi veux-tu être accompagné ?</Text>
          <View style={styles.pillsGrid}>
            {GOALS.map((g) => (
              <TouchableOpacity
                key={g.label}
                style={[styles.pill, selected.includes(g.label) && styles.pillActive]}
                onPress={() => toggleGoal(g.label)}
              >
                <Text style={styles.pillEmoji}>{g.emoji}</Text>
                <Text style={[styles.pillText, selected.includes(g.label) && styles.pillTextActive]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.btn, selected.length === 0 && styles.btnDisabled]}
            onPress={selected.length > 0 ? next : undefined}
          >
            <Text style={[styles.btnText, selected.length === 0 && styles.btnTextDisabled]}>Continuer →</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {step === 2 && (
        <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>Étape 2</Text>
          <Text style={styles.headline}>Crée ton compte.</Text>
          <Text style={styles.subtext}>Ton parcours commence maintenant.</Text>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>PRÉNOM</Text>
            <TextInput
              style={styles.inputField}
              placeholder="Yllan"
              placeholderTextColor="#444"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TextInput
              style={styles.inputField}
              placeholder="yllan@reiz.app"
              placeholderTextColor="#444"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>MOT DE PASSE</Text>
            <TextInput
              style={styles.inputField}
              placeholder="••••••••"
              placeholderTextColor="#444"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.appleBtn}>
            <Text style={styles.appleBtnText}>🍎  Continuer avec Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, { marginTop: 16 }, loading && styles.btnDisabled]}
            onPress={loading ? undefined : handleSignUp}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.btnText}>Créer mon compte 🚀</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.legal}>
            En créant un compte tu acceptes nos <Text style={styles.legalLink}>CGU</Text>
          </Text>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {step > 0 && (
        <TouchableOpacity style={styles.backBtn} onPress={prev}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#333' },
  dotActive: { width: 20, backgroundColor: '#fff' },
  screen: { flex: 1 },
  eyebrow: { fontSize: 11, color: '#555', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  headline: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 8, lineHeight: 28 },
  subtext: { fontSize: 13, color: '#888', lineHeight: 20, marginBottom: 20 },
  cards: { gap: 8, marginBottom: 24 },
  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e1e', padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardEmoji: { fontSize: 20, marginTop: 2 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#fff', marginBottom: 3 },
  cardDesc: { fontSize: 12, color: '#666', lineHeight: 17 },
  pillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 100, backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#222' },
  pillActive: { backgroundColor: '#fff', borderColor: '#fff' },
  pillEmoji: { fontSize: 13 },
  pillText: { fontSize: 12, fontWeight: '700', color: '#888' },
  pillTextActive: { color: '#000' },
  inputBlock: { marginBottom: 12 },
  inputLabel: { fontSize: 10, color: '#555', letterSpacing: 1.5, fontWeight: '700', marginBottom: 6 },
  inputField: { backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 14, padding: 14, fontSize: 14, color: '#fff', fontFamily: 'System' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#222' },
  dividerText: { fontSize: 12, color: '#555' },
  appleBtn: { backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 14, padding: 14, alignItems: 'center' },
  appleBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  btn: { width: '100%', backgroundColor: '#fff', padding: 15, borderRadius: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#1e1e1e' },
  btnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  btnTextDisabled: { color: '#444' },
  backBtn: { paddingVertical: 14, alignItems: 'center' },
  backText: { fontSize: 13, color: '#555' },
  legal: { fontSize: 11, color: '#444', textAlign: 'center', marginTop: 12 },
  legalLink: { color: '#888', fontWeight: '700' },
});