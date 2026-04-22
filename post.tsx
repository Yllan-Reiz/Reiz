import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';

const OBJECTIVES = [
  { id: '1', emoji: '🏃', name: 'Courir 10 km', progress: 64, unit: 'km', max: 10, current: 6.4 },
  { id: '2', emoji: '📚', name: 'Lire 12 livres', progress: 25, unit: 'livres', max: 12, current: 3 },
  { id: '3', emoji: '🚀', name: 'Lancer ma startup', progress: 45, unit: '%', max: 100, current: 45 },
];

export default function Post({ onBack, onPublish }: { onBack: () => void, onPublish: () => void }) {
  const [step, setStep] = useState(0);
  const [selectedObj, setSelectedObj] = useState(0);
  const [progress, setProgress] = useState(72);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('public');

  const obj = OBJECTIVES[selectedObj];
  const progressWidth = `${progress}%` as any;

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => step > 0 ? setStep(s => s - 1) : onBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 0 ? 'Quel objectif ?' : step === 1 ? 'Ta mise à jour' : 'Qui peut voir ?'}
        </Text>
        <Text style={styles.stepIndicator}>{step + 1}/3</Text>
      </View>

      <View style={styles.dots}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {step === 0 && (
          <View>
            <Text style={styles.sectionLabel}>MES OBJECTIFS ACTIFS</Text>
            {OBJECTIVES.map((o, i) => (
              <TouchableOpacity
                key={o.id}
                style={[styles.objRow, selectedObj === i && styles.objRowActive]}
                onPress={() => setSelectedObj(i)}
              >
                <View style={[styles.objIcon, selectedObj === i && styles.objIconActive]}>
                  <Text style={styles.objEmoji}>{o.emoji}</Text>
                </View>
                <View style={styles.objInfo}>
                  <Text style={styles.objName}>{o.name}</Text>
                  <Text style={styles.objProgress}>{o.current} {o.unit} sur {o.max}</Text>
                  <View style={styles.miniBar}>
                    <View style={[styles.miniBarFill, { width: `${o.progress}%` as any }]} />
                  </View>
                </View>
                <View style={[styles.checkCircle, selectedObj === i && styles.checkCircleActive]}>
                  {selectedObj === i && <Text style={styles.checkText}>✓</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={styles.sectionLabel}>PHOTO DE PROGRESSION</Text>
            <TouchableOpacity style={styles.photoZone}>
              <Text style={styles.photoIcon}>📷</Text>
              <Text style={styles.photoText}>Prends une photo ou importe</Text>
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>PROGRESSION AUJOURD'HUI</Text>
            <View style={styles.progressBlock}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressObjName}>{obj.name}</Text>
                <Text style={styles.progressValue}>
                  {Math.round((progress / 100) * obj.max * 10) / 10} {obj.unit}
                </Text>
              </View>
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderFill, { width: progressWidth }]} />
              </View>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>0</Text>
                <Text style={styles.sliderLabel}>{obj.max} {obj.unit}</Text>
              </View>
              <View style={styles.sliderBtns}>
                <TouchableOpacity style={styles.sliderBtn} onPress={() => setProgress(p => Math.max(0, p - 5))}>
                  <Text style={styles.sliderBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.sliderPct}>{progress}%</Text>
                <TouchableOpacity style={styles.sliderBtn} onPress={() => setProgress(p => Math.min(100, p + 5))}>
                  <Text style={styles.sliderBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.sectionLabel}>CAPTION</Text>
            <TextInput
              style={styles.captionInput}
              placeholder="Décris ta progression... (optionnel)"
              placeholderTextColor="#3a3a3a"
              value={caption}
              onChangeText={setCaption}
              multiline
            />
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.sectionLabel}>VISIBILITÉ</Text>
            <View style={styles.visToggle}>
              {[
                { key: 'public', label: '🌍 Public' },
                { key: 'friends', label: '👥 Amis' },
                { key: 'private', label: '🔒 Privé' },
              ].map(v => (
                <TouchableOpacity
                  key={v.key}
                  style={[styles.visOpt, visibility === v.key && styles.visOptActive]}
                  onPress={() => setVisibility(v.key)}
                >
                  <Text style={[styles.visOptText, visibility === v.key && styles.visOptTextActive]}>
                    {v.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>RÉCAPITULATIF</Text>
            <View style={styles.recap}>
              <View style={styles.recapRow}>
                <Text style={styles.recapKey}>Objectif</Text>
                <Text style={styles.recapVal}>{obj.emoji} {obj.name}</Text>
              </View>
              <View style={styles.recapDivider} />
              <View style={styles.recapRow}>
                <Text style={styles.recapKey}>Progression</Text>
                <Text style={styles.recapVal}>{Math.round((progress / 100) * obj.max * 10) / 10} {obj.unit} ({progress}%)</Text>
              </View>
              <View style={styles.recapDivider} />
              <View style={styles.recapRow}>
                <Text style={styles.recapKey}>Visibilité</Text>
                <Text style={styles.recapVal}>
                  {visibility === 'public' ? '🌍 Public' : visibility === 'friends' ? '👥 Amis' : '🔒 Privé'}
                </Text>
              </View>
              <View style={styles.recapDivider} />
              <View style={styles.recapRow}>
                <Text style={styles.recapKey}>Streak</Text>
                <Text style={styles.recapVal}>🔥 8 jours d'affilée</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => step < 2 ? setStep(s => s + 1) : onPublish()}
        >
          <Text style={styles.ctaText}>
            {step === 2 ? 'Publier ma mise à jour 🚀' : 'Continuer →'}
          </Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: '#888' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  stepIndicator: { fontSize: 12, color: '#555' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#333' },
  dotActive: { width: 20, backgroundColor: '#fff' },
  content: { flex: 1, paddingHorizontal: 20 },
  sectionLabel: { fontSize: 10, color: '#555', letterSpacing: 1.5, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10, marginTop: 16 },
  objRow: { backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#222', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  objRowActive: { borderColor: '#fff', backgroundColor: '#1a1a1a' },
  objIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  objIconActive: { backgroundColor: '#fff', borderColor: '#fff' },
  objEmoji: { fontSize: 20 },
  objInfo: { flex: 1 },
  objName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  objProgress: { fontSize: 12, color: '#555', marginTop: 2 },
  miniBar: { height: 3, backgroundColor: '#222', borderRadius: 2, marginTop: 6 },
  miniBarFill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#333' },
  checkCircleActive: { backgroundColor: '#fff', borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  checkText: { fontSize: 12, color: '#000', fontWeight: '800' },
  photoZone: { backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 18, height: 160, alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 },
  photoIcon: { fontSize: 32 },
  photoText: { fontSize: 13, color: '#555', fontWeight: '600' },
  progressBlock: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 18, padding: 16, marginBottom: 4 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  progressObjName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  progressValue: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  sliderTrack: { height: 4, backgroundColor: '#222', borderRadius: 2, marginBottom: 6 },
  sliderFill: { height: 4, backgroundColor: '#fff', borderRadius: 2 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { fontSize: 10, color: '#444' },
  sliderBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 14 },
  sliderBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  sliderBtnText: { fontSize: 22, color: '#fff', fontWeight: '300' },
  sliderPct: { fontSize: 18, fontWeight: '900', color: '#fff', minWidth: 60, textAlign: 'center' },
  captionInput: { backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#222', borderRadius: 16, padding: 14, fontSize: 14, color: '#fff', minHeight: 80, textAlignVertical: 'top' },
  visToggle: { flexDirection: 'row', backgroundColor: '#141414', borderWidth: 1, borderColor: '#222', borderRadius: 18, overflow: 'hidden', marginBottom: 4 },
  visOpt: { flex: 1, paddingVertical: 12, alignItems: 'center', margin: 4, borderRadius: 14 },
  visOptActive: { backgroundColor: '#fff' },
  visOptText: { fontSize: 12, fontWeight: '700', color: '#555' },
  visOptTextActive: { color: '#000' },
  recap: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 18, padding: 16 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  recapKey: { fontSize: 13, color: '#555', fontWeight: '600' },
  recapVal: { fontSize: 13, color: '#fff', fontWeight: '700' },
  recapDivider: { height: 1, backgroundColor: '#1e1e1e', marginVertical: 8 },
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, backgroundColor: '#0a0a0a' },
  cta: { width: '100%', backgroundColor: '#fff', padding: 16, borderRadius: 18, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#000' },
});