import { requireNativeView, requireOptionalNativeModule } from 'expo';
import { ComponentType } from 'react';
import { ViewStyle } from 'react-native';

// Module natif local (modules/reiz-emoji-keyboard), arrivé avec la 1.2.
// Absent d'un build plus ancien : l'app garde sa liste d'emojis.
type NativeProps = {
  active: boolean;
  onEmoji: (e: { nativeEvent: { emoji: string } }) => void;
  onDismiss?: () => void;
  style?: ViewStyle;
};

const available = !!requireOptionalNativeModule('ReizEmojiKeyboard');
const NativeInput: ComponentType<NativeProps> | null = available ? requireNativeView('ReizEmojiKeyboard') : null;

export const emojiKeyboardAvailable = () => available;

/** Invisible : tant que `active` est vrai, le clavier emoji d'Apple est ouvert. */
export function EmojiKeyboardInput({ active, onEmoji, onDismiss }: { active: boolean; onEmoji: (emoji: string) => void; onDismiss?: () => void }) {
  if (!NativeInput) return null;
  return <NativeInput active={active} onEmoji={e => onEmoji(e.nativeEvent.emoji)} onDismiss={onDismiss} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />;
}
