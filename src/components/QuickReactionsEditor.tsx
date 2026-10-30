import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ALL_REACTION_EMOJIS } from '../constants';
import { EmojiKeyboardInput, emojiKeyboardAvailable } from '../../modules/reiz-emoji-keyboard';
import { DEFAULT_QUICK_REACTIONS, saveQuickReactions, useQuickReactions } from '../lib/quickReactions';
import { F } from '../styles';
import { t } from '../i18n';

// Choisir ses 6 réactions : on touche une case de la barre, puis l'emoji qui la remplace dans le clavier d'Apple
// (la liste de l'app seulement sur un build sans le module natif). La barre garde ainsi toujours
// 6 emojis différents. Un emoji déjà dans la barre échange sa place avec la case choisie. Tout est enregistré au fil de l'eau.
export function QuickReactionsEditor() {
  const list = useQuickReactions();
  const [slot, setSlot] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(true);
  const isDefault = list.join() === DEFAULT_QUICK_REACTIONS.join();

  const choose = (emoji: string) => {
    if (list[slot] === emoji) return;
    Haptics.selectionAsync().catch(() => {});
    const next = [...list];
    const from = next.indexOf(emoji);
    if (from >= 0) next[from] = next[slot];
    next[slot] = emoji;
    saveQuickReactions(next);
    setSlot((slot + 1) % next.length);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      <EmojiKeyboardInput active={keyboardOpen} onEmoji={choose} onDismiss={() => setKeyboardOpen(false)} />
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 20, fontFamily: F.regular }}>{t('quickReactions.hint')}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
        {list.map((emoji, i) => (
          <TouchableOpacity key={emoji} onPress={() => { setSlot(i); setKeyboardOpen(true); }} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ selected: i === slot }} accessibilityLabel={t('quickReactions.slot', { n: i + 1, emoji })}
            style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#1c1c1c', borderWidth: 2, borderColor: i === slot ? '#fff' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 25 }}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {!emojiKeyboardAvailable() && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 26 }}>
        {ALL_REACTION_EMOJIS.map(emoji => (
          <TouchableOpacity key={emoji} onPress={() => choose(emoji)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={emoji} accessibilityState={{ selected: list.includes(emoji) }}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#1c1c1c', opacity: list.includes(emoji) ? 0.35 : 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22 }}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>}
      {!isDefault && (
        <TouchableOpacity onPress={() => { saveQuickReactions(DEFAULT_QUICK_REACTIONS); setSlot(0); }} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 26, padding: 8 }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: F.semibold }}>{t('quickReactions.reset')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
