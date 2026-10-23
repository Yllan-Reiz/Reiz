import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ALL_DAYS, DAY_LETTERS, DAY_LONG, TRAINING_PRESETS, daysLabel } from '../constants';
import { F } from '../styles';

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
      {/* Les 7 pastilles se partagent la largeur (6 pt entre chacune), sans dépasser 44 pt : rien ne déborde,
          même avec le zoom d'affichage ou un grand texte. */}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {ALL_DAYS.map(d => {
          const on = value.includes(d);
          return (
            <TouchableOpacity
              key={d}
              onPress={() => toggle(d)}
              activeOpacity={0.8}
              accessibilityLabel={`${DAY_LONG[d - 1]}, ${on ? 'jour d\'entraînement' : 'jour de repos'}`}
              style={{ flex: 1, maxWidth: 44, aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: on ? '#fff' : 'rgba(255,255,255,0.16)' }}
            >
              <Text style={{ color: on ? '#000' : 'rgba(255,255,255,0.75)', fontSize: 15, fontFamily: F.extrabold }} maxFontSizeMultiplier={1.2}>{DAY_LETTERS[d - 1]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {TRAINING_PRESETS.map(p => {
          const active = same(value, p.days);
          return (
            <TouchableOpacity key={p.label} onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(p.days); }} activeOpacity={0.85}
              style={{ height: 38, borderRadius: 19, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: active ? '#fff' : 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: active ? '#fff' : 'rgba(255,255,255,0.14)' }}>
              <Text style={{ color: active ? '#000' : '#fff', fontSize: 14, fontFamily: F.bold }} maxFontSizeMultiplier={1.3}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, fontFamily: F.regular, marginTop: 12 }}>
        {value.length === 0
          ? 'Choisis au moins un jour.'
          : value.length === 7
            ? 'Tous les jours. Retire ceux où tu te reposes : tu ne seras relancé que les autres.'
            : `Tu t'entraînes ${daysLabel(value, true)}. Tu ne seras relancé que ces jours-là, et ton cercle le saura.`}
      </Text>
    </View>
  );
}
