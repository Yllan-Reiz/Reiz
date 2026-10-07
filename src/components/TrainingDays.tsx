import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ALL_DAYS, DAY_LETTERS, DAY_LONG, TRAINING_PRESETS, daysLabel } from '../constants';
import { s, F } from '../styles';

// Jours d'entraînement d'un objectif : 7 pastilles à toucher + quelques raccourcis.
// Les rappels de l'app et ton cercle ne parlent que de ces jours-là (le dimanche de repos n'est plus relancé).

const same = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

export function TrainingDaysPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  const toggle = (d: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(value.includes(d) ? value.filter(x => x !== d) : [...value, d].sort((a, b) => a - b));
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {ALL_DAYS.map(d => {
          const on = value.includes(d);
          return (
            <TouchableOpacity
              key={d}
              onPress={() => toggle(d)}
              activeOpacity={0.8}
              accessibilityLabel={`${DAY_LONG[d - 1]}, ${on ? 'jour d\'entraînement' : 'jour de repos'}`}
              style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#fff' : '#1a1a1a', borderWidth: 1.5, borderColor: on ? '#fff' : '#2a2a2a' }}
            >
              <Text style={{ color: on ? '#000' : '#777', fontSize: 15, fontFamily: F.extrabold }}>{DAY_LETTERS[d - 1]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {TRAINING_PRESETS.map(p => {
          const active = same(value, p.days);
          return (
            <TouchableOpacity key={p.label} onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(p.days); }} style={[s.durationPill, active && s.durationPillActive]}>
              <Text style={[s.durationPillText, active && s.durationPillTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={s.fieldHint}>
        {value.length === 0
          ? 'Choisis au moins un jour.'
          : value.length === 7
            ? 'Tous les jours. Retire ceux où tu te reposes : tu ne seras relancé que les autres.'
            : `Tu t'entraînes ${daysLabel(value, true)}. Tu ne seras relancé que ces jours-là, et ton cercle le saura.`}
      </Text>
    </View>
  );
}
