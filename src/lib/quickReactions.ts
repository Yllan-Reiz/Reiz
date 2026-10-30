import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_REACTION_EMOJIS } from '../constants';

// Les 6 emojis de la barre rapide (demande de Yllan, 30/10/2026) : chacun choisit les siens parmi ALL_REACTION_EMOJIS.
// Gardés sur le téléphone, comme les autres préférences d'affichage. Lus une fois, puis partagés par toutes les cartes du fil.

export const DEFAULT_QUICK_REACTIONS = ['🔥', '💪', '👏', '😮', '😂', '❤️'];
const KEY = 'reiz_quick_reactions';

let current = DEFAULT_QUICK_REACTIONS;
let loaded = false;
const listeners = new Set<(list: string[]) => void>();

const isValid = (list: unknown): list is string[] =>
  Array.isArray(list) && list.length === DEFAULT_QUICK_REACTIONS.length && new Set(list).size === list.length && list.every(e => ALL_REACTION_EMOJIS.includes(e));

function publish(list: string[]) {
  current = list;
  listeners.forEach(l => l(list));
}

export function saveQuickReactions(list: string[]) {
  if (!isValid(list)) return;
  publish(list);
  AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});
}

export function useQuickReactions() {
  const [list, setList] = useState(current);
  useEffect(() => {
    listeners.add(setList);
    setList(current);
    if (!loaded) {
      loaded = true;
      AsyncStorage.getItem(KEY).then(v => {
        const saved = v ? JSON.parse(v) : null;
        if (isValid(saved)) publish(saved);
      }).catch(() => {});
    }
    return () => { listeners.delete(setList); };
  }, []);
  return list;
}
