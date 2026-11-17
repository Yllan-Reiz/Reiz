import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { parseSentence, READY_GOALS, type ParsedGoal } from '../lib/sentence';
import { goalTitle, goalSummary } from '../lib/createGoal';
import { weeksLabel } from '../lib/goal';
import { GlassSurface } from './GlassSurface';
import { F } from '../styles';
import { t } from '../i18n';

// Un objectif en une phrase (1.4) : un seul champ, et dessous ce que l'app a compris, corrigeable d'un geste
// (plus ou moins de séances par semaine). Rien de compris : des objectifs tout prêts à toucher, jamais un formulaire.
// Sert à « Nouvel objectif » et à l'accueil.

export type SentenceResult = {
  /** L'objectif prêt à créer, null tant que rien n'est compris ni choisi. */
  goal: ParsedGoal | null;
  via: 'sentence' | 'ready';
  /** Le rythme a été corrigé avec + ou −. */
  edited: boolean;
};

const HAPTIC = () => { Haptics.selectionAsync().catch(() => {}); };

function Round({ icon, onPress, label, off }: { icon: 'remove' | 'add'; onPress: () => void; label: string; off: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={off} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', opacity: off ? 0.35 : 1 }}>
      <Ionicons name={icon} size={22} color="#fff" />
    </TouchableOpacity>
  );
}

export function SentenceGoal({ onChange, autoFocus, tone = 'glass' }: {
  onChange: (r: SentenceResult) => void;
  autoFocus?: boolean;
  /** 'glass' : sur fond noir (feuille « Nouvel objectif »). 'plain' : sur l'accueil, champs sombres simples. */
  tone?: 'glass' | 'plain';
}) {
  const [text, setText] = useState('');
  // Objectif tout prêt choisi : il prime tant que la phrase n'est pas retouchée.
  const [picked, setPicked] = useState<ParsedGoal | null>(null);
  // Rythme corrigé à la main, valable tant que la phrase ne dit pas un autre chiffre.
  const [perWeek, setPerWeek] = useState<number | null>(null);

  const parsed = useMemo(() => parseSentence(text), [text]);
  const base = picked ?? parsed;
  const goal = useMemo<ParsedGoal | null>(
    () => (base && base.kind === 'rhythm' && perWeek != null ? { ...base, perWeek, guessed: false } : base),
    [base, perWeek],
  );
  const via: 'sentence' | 'ready' = picked ? 'ready' : 'sentence';
  const edited = perWeek != null;

  useEffect(() => { onChange({ goal, via, edited }); }, [goal, via, edited]); // eslint-disable-line react-hooks/exhaustive-deps
  // La phrase dit un nouveau chiffre : la correction à la main ne tient plus.
  useEffect(() => { setPerWeek(null); }, [parsed?.perWeek, parsed?.kind]);

  // Le dernier objectif tout prêt choisi. Retoucher le texte ne le fait plus perdre (17/11/2026 : « Préparer un Hyrox »,
  // 4 fois sur 8 semaines, devenait « Entraînement Hyrox », 3 fois, à la moindre lettre effacée puis retapée).
  const lastPicked = useRef<ParsedGoal | null>(null);
  const onText = (v: string) => {
    setText(v);
    const ready = lastPicked.current;
    if (!ready) return;
    // Il reste choisi (nom, rythme, durée) tant que la phrase parle de la même activité sans donner de chiffre.
    // Un chiffre écrit (« 5 fois par semaine »), une autre activité ou un champ vidé : c'est la phrase qui décide.
    const p = parseSentence(v);
    const same = !!p && p.kind === 'rhythm' && !!p.guessed && p.activity === ready.activity;
    if (same) { if (picked !== ready) setPicked(ready); } else if (picked) setPicked(null);
    if (!v.trim()) lastPicked.current = null;
  };
  const pick = (g: ParsedGoal) => {
    HAPTIC();
    lastPicked.current = g;
    setPicked(g);
    setPerWeek(null);
    // Le champ ne reprend que le nom : le rythme se lit et se corrige dans la carte du dessous.
    setText(goalTitle(g));
  };
  const step = (d: number) => {
    if (!goal || goal.kind !== 'rhythm') return;
    const next = Math.max(1, Math.min(7, (goal.perWeek || 3) + d));
    if (next === goal.perWeek) return;
    HAPTIC();
    // La phrase dit « 3 fois » : on y écrit le nouveau chiffre, pour que le champ et la carte disent la même chose.
    if (!picked && parsed?.kind === 'rhythm' && !parsed.guessed) {
      const rewritten = text.replace(new RegExp(`(^|\\D)${goal.perWeek}(?!\\d)`), `$1${next}`);
      if (rewritten !== text && parseSentence(rewritten)?.perWeek === next) { setText(rewritten); return; }
    }
    setPerWeek(next);
  };

  const typed = text.trim().length >= 3;
  return (
    <View>
      <TextInput
        style={{
          minHeight: 58, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 16, color: '#fff', fontSize: 17, lineHeight: 23, fontFamily: F.semibold,
          backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: goal ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.14)',
        }}
        placeholder={t('sentence.placeholder')}
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={text}
        onChangeText={onText}
        autoFocus={autoFocus}
        autoCapitalize="sentences"
        autoCorrect={false}
        keyboardAppearance="dark"
        multiline
        blurOnSubmit
        returnKeyType="done"
        maxLength={120}
        accessibilityLabel={t('sentence.label')}
      />

      {goal ? (
        <GlassSurface radius={24} variant={tone === 'glass' ? 'regular' : 'clear'} tintColor="rgba(255,255,255,0.08)" style={{ marginTop: 14 }}>
          <View style={{ padding: 16, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} accessibilityLiveRegion="polite">
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5 }}>{t('sentence.resultLabel')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 19, lineHeight: 24, fontFamily: F.black, letterSpacing: -0.3 }} numberOfLines={2}>{goalTitle(goal)}</Text>
                {goal.kind === 'record' && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: F.semibold, marginTop: 2 }}>{goalSummary(goal)}</Text>}
              </View>
            </View>
            {goal.kind === 'rhythm' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <Round icon="remove" onPress={() => step(-1)} label={t('sentence.less')} off={(goal.perWeek || 1) <= 1} />
                <Text style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 17, fontFamily: F.extrabold }} maxFontSizeMultiplier={1.3}>{goalSummary(goal)}</Text>
                <Round icon="add" onPress={() => step(1)} label={t('sentence.more')} off={(goal.perWeek || 1) >= 7} />
              </View>
            )}
            {goal.kind === 'rhythm' && !!goal.weeks && (
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, fontFamily: F.regular, marginTop: 10, textAlign: 'center' }}>{weeksLabel(goal.weeks)}</Text>
            )}
            {goal.kind === 'rhythm' && goal.guessed && (
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, fontFamily: F.regular, marginTop: 12, textAlign: 'center' }}>{t('sentence.guessedHint')}</Text>
            )}
          </View>
        </GlassSurface>
      ) : (
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: typed ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 19, fontFamily: typed ? F.semibold : F.regular }}>
            {typed ? t('sentence.notUnderstood') : t('sentence.ready')}
          </Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {READY_GOALS.map(g => (
              <TouchableOpacity key={g.activity} onPress={() => pick(g)} activeOpacity={0.85} accessibilityRole="button"
                style={{ minHeight: 60, borderRadius: 30, paddingLeft: 22, paddingRight: 18, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontFamily: F.bold }} numberOfLines={1} maxFontSizeMultiplier={1.3}>{goalTitle(g)}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: F.regular, marginTop: 1 }} numberOfLines={1} maxFontSizeMultiplier={1.3}>{g.weeks ? `${goalSummary(g)}, ${weeksLabel(g.weeks)}` : goalSummary(g)}</Text>
                </View>
                <Ionicons name="add" size={20} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
