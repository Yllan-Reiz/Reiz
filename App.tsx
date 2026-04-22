import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image } from 'react-native';

export default function App({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <Image 
        source={require('./assets/ecriture-reiz-blanc.png')}
        style={styles.logoImage}
        resizeMode="contain"
      />
      
      <Text style={styles.tagline}>RISE TO YOUR GOALS</Text>

      <View style={styles.bottom}>
        <TouchableOpacity style={styles.btn} onPress={onNext}>
          <Text style={styles.btnText}>Commencer →</Text>
        </TouchableOpacity>
        <Text style={styles.login}>
          Déjà un compte ? <Text style={styles.loginLink}>Se connecter</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 48 },
  logoImage: { width: 260, height: 90, marginBottom: 12 },
  tagline: { fontSize: 10, color: '#555555', letterSpacing: 3 },
  bottom: { position: 'absolute', bottom: 48, left: 28, right: 28 },
  btn: { width: '100%', backgroundColor: '#ffffff', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 14 },
  btnText: { fontSize: 16, fontWeight: '800', color: '#000000' },
  login: { fontSize: 12, color: '#555555', textAlign: 'center' },
  loginLink: { color: '#ffffff', fontWeight: '700' },
});