import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { parseSentence, freeGoal, type ParsedGoal } from '../lib/sentence';
import { FEATURES } from '../lib/features';
import { goalTitle, goalSummary } from '../lib/createGoal';
import { F } from '../styles';
import { t, type TKey } from '../i18n';
import type { SentenceResult } from './SentenceGoal';

// « Dis ton objectif » (15/11/2026, demande de Yllan) : la feuille « Nouvel objectif » se présente comme une phrase
// qu'on dit ou qu'on écrit, plus comme un champ de formulaire suivi de boutons.
//   la phrase est le titre de l'écran, écrite en grand, sans cadre
//   dessous, ce que Reiz a compris se remplit pendant qu'on écrit ou qu'on dicte (même analyse que SentenceGoal)
//   champ vide : trois phrases d'exemple à toucher, qui s'écrivent dans le champ (elles montrent comment parler)
//   une petite phrase taquine au-dessus, tirée au hasard à chaque ouverture (le ton des rappels du jour)
//   la dictée passe par le micro du clavier (un micro dans l'app demande un module natif, donc une version App Store)
// Même contrat que SentenceGoal (onChange), qui reste intact : FEATURES.talkGoal choisit entre les deux.

const HAPTIC = () => { Haptics.selectionAsync().catch(() => {}); };
const EXAMPLES: TKey[] = ['sentence.ex1', 'sentence.ex2', 'sentence.ex3'];
const TEASES: TKey[] = ['sentence.tease1', 'sentence.tease2', 'sentence.tease3'];

export function TalkGoal({ onChange, autoFocus }: { onChange: (r: SentenceResult) => void; autoFocus?: boolean }) {
  const [text, setText] = useState('');
  const [tease] = useState(() => TEASES[Math.floor(Math.random() * TEASES.length)]);
  // Rythme corrigé à la main, valable tant que la phrase ne dit pas un autre chiffre.
  const [perWeek, setPerWeek] = useState<number | null>(null);

  // Phrase pas comprise mais gardée telle quelle (essai du 19/11/2026) : un objectif libre, tant que le texte ne change pas.
  const [kept, setKept] = useState<ParsedGoal | null>(null);
  const onText = (v: string) => { setText(v); setKept(null); };

  const understood = useMemo(() => parseSentence(text), [text]);
  const parsed = understood ?? kept;
  const goal = useMemo<ParsedGoal | null>(
    () => (parsed && parsed.kind === 'rhythm' && perWeek != null ? { ...parsed, perWeek, guessed: false } : parsed),
    [parsed, perWeek],
  );
  const edited = perWeek != null;

  useEffect(() => { onChange({ goal, via: 'sentence', edited }); }, [goal, edited]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPerWeek(null); }, [parsed?.perWeek, parsed?.kind]);

  const step = (d: number) => {
    if (!goal || goal.kind !== 'rhythm') return;
    const next = Math.max(1, Math.min(7, (goal.perWeek || 3) + d));
    if (next === goal.perWeek) return;
    HAPTIC();
    // La phrase dit « 3 fois » : on y écrit le nouveau chiffre, pour que la phrase et le résultat disent la même chose.
    if (understood?.kind === 'rhythm' && !understood.guessed) {
      const rewritten = text.replace(new RegExp(`(^|\\D)${goal.perWeek}(?!\\d)`), `$1${next}`);
      if (rewritten !== text && parseSentence(rewritten)?.perWeek === next) { setText(rewritten); return; }
    }
    setPerWeek(next);
  };

  const typed = text.trim().length >= 3;
  const free = FEATURES.keepMySentence && typed ? freeGoal(text) : null;
  return (
    <View>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 21, fontFamily: F.semibold, marginBottom: 18 }} maxFontSizeMultiplier={1.3}>{t(tease)}</Text>
      <TextInput
        style={{ color: '#fff', fontSize: 30, lineHeight: 36, fontFamily: F.black, letterSpacing: -0.9, paddingVertical: 0, minHeight: 72 }}
        placeholder={t('sentence.talkPlaceholder')}
        placeholderTextColor="rgba(255,255,255,0.28)"
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

      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: 22 }} />

      {goal ? (
        <View style={{ marginTop: 30 }} accessibilityLiveRegion="polite">
          <Text style={label}>{t('sentence.resultLabel')}</Text>
          <Text style={{ color: '#fff', fontSize: 26, lineHeight: 31, fontFamily: F.black, letterSpacing: -0.6, marginTop: 12 }} numberOfLines={2}>{goalTitle(goal)}</Text>
          {goal.kind === 'record' ? (
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 17, fontFamily: F.semibold, marginTop: 8 }}>{goalSummary(goal)}</Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26 }}>
              <Round icon="remove" onPress={() => step(-1)} label={t('sentence.less')} off={(goal.perWeek || 1) <= 1} />
              <Text style={{ color: '#fff', fontSize: 19, fontFamily: F.extrabold, flex: 1, textAlign: 'center' }} maxFontSizeMultiplier={1.3}>{goalSummary(goal)}</Text>
              <Round icon="add" onPress={() => step(1)} label={t('sentence.more')} off={(goal.perWeek || 1) >= 7} />
            </View>
          )}
          {goal.kind === 'rhythm' && goal.guessed && (
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, fontFamily: F.regular, marginTop: 16, textAlign: 'center' }}>{t('sentence.guessedHint')}</Text>
          )}
        </View>
      ) : (
        <View style={{ marginTop: 24 }}>
          {!!free && (
            <TouchableOpacity onPress={() => { HAPTIC(); setKept(free); }} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${t('sentence.keepMine')}. ${free.text}`}
              style={{ height: 56, borderRadius: 18, marginBottom: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
              <Text style={{ color: '#000', fontSize: 16, fontFamily: F.extrabold }} maxFontSizeMultiplier={1.3}>{t('sentence.keepMine')}</Text>
            </TouchableOpacity>
          )}
          <Text style={typed ? { color: '#fff', fontSize: 14, lineHeight: 19, fontFamily: F.semibold } : label}>
            {typed ? (free ? t('sentence.orExample') : t('sentence.notYet')) : t('sentence.examples')}
          </Text>
          <View style={{ marginTop: 6 }}>
            {EXAMPLES.map(k => (
              <TouchableOpacity key={k} onPress={() => { HAPTIC(); setText(t(k)); }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t(k)}
                style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                <Text style={{ flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 16, lineHeight: 21, fontFamily: F.semibold }} maxFontSizeMultiplier={1.3}>{t(k)}</Text>
                <Ionicons name={'arrow-up'} size={18} color="rgba(255,255,255,0.45)" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const label = { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5 } as const;

function Round({ icon, onPress, label: a11y, off }: { icon: 'remove' | 'add'; onPress: () => void; label: string; off: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={off} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={6}
      style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', opacity: off ? 0.35 : 1 }}>
      <Ionicons name={icon} size={22} color="#fff" />
    </TouchableOpacity>
  );
}
