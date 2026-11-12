import { createContext, forwardRef, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { View, ScrollView, Keyboard, LayoutAnimation, Platform, type KeyboardEvent, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardDock, keyboardDockAvailable } from '../../modules/reiz-keyboard-dock';

// Le clavier des commentaires, pour tous les écrans (12/11/2026, demande de Yllan : « tu reprends son code, sa
// manière d'ouverture, sa rapidité, et tu la remets partout »). C'est le même code que CommentsModal, sorti ici :
//   1. la barre du bas (le bouton « Continuer »...) reste COLLÉE au clavier, à l'ouverture, à la fermeture et quand on
//      le fait descendre au doigt : module natif ReizKeyboardDock (build 1.2 et suivants), sans passer par JavaScript ;
//   2. sans ce module (Android, ancien build, Expo Go) : le contenu se décale en JavaScript, avec la courbe et la durée
//      mêmes du clavier (LayoutAnimation « keyboard »), dès l'annonce « le clavier va s'ouvrir » ;
//   3. la liste se ferme au doigt (keyboardDismissMode « interactive ») et on peut toujours la faire défiler jusqu'en bas.
// KeyboardAvoidingView n'est plus utilisé sur ces écrans : il calcule mal dans une feuille et ne suit pas le doigt.
//
// Usage :
//   <KeyboardFrame style={...} footer={<Bouton />} footerStyle={...}>
//     <KeyboardScroll> ... champs ... </KeyboardScroll>
//   </KeyboardFrame>
// Le cadre doit descendre jusqu'au bas de l'écran (écran entier ou feuille collée en bas), comme les commentaires.

export const KEYBOARD_DOCKED = keyboardDockAvailable();

/**
 * La hauteur que le clavier recouvre en bas de `rootRef` (0 = fermé). `animated` : la mise en page suit le clavier
 * avec sa propre courbe (à couper quand la barre est tenue par le module natif, qui anime lui-même).
 */
export function useKeyboardPad(active: boolean, rootRef: RefObject<View | null>, animated: boolean): number {
  const [pad, setPad] = useState(0);
  useEffect(() => {
    if (!active) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const animate = (e?: KeyboardEvent) => {
      if (Platform.OS === 'ios' && animated) {
        LayoutAnimation.configureNext({ duration: e?.duration || 250, update: { type: LayoutAnimation.Types.keyboard } });
      }
    };
    const onShow = (e: KeyboardEvent) => {
      // iOS : le bas du cadre est collé au bas de l'écran, le chevauchement vaut exactement la hauteur du clavier.
      if (Platform.OS === 'ios') { animate(e); setPad(e.endCoordinates.height); return; }
      // Android : la mesure dans la fenêtre est fiable.
      rootRef.current?.measureInWindow((_x, y, _w, h) => {
        animate(e);
        setPad(Math.max(0, y + h - e.endCoordinates.screenY));
      });
    };
    const onHide = (e: KeyboardEvent) => { animate(e); setPad(0); };
    const a = Keyboard.addListener(showEvt, onShow);
    const b = Keyboard.addListener(hideEvt, onHide);
    // Filet de sécurité : si « will hide » est manqué, « did hide » remet à zéro.
    const c = Platform.OS === 'ios' ? Keyboard.addListener('keyboardDidHide', () => setPad(0)) : null;
    return () => { a.remove(); b.remove(); c?.remove(); setPad(0); };
  }, [active, animated, rootRef]);
  return pad;
}

// Ce que la liste doit laisser libre en bas quand le clavier et la barre passent par-dessus (barre tenue en natif).
const InsetContext = createContext(0);

export function KeyboardFrame({ active = true, style, footer, footerStyle, children }: {
  /** Faux quand l'écran n'est pas affiché (feuille fermée) : on n'écoute pas le clavier pour rien. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  /** La barre du bas, qui suit le clavier. Sans barre, c'est tout le contenu qui se resserre au-dessus du clavier. */
  footer?: ReactNode;
  footerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const rootRef = useRef<View>(null);
  const hasFooter = footer !== undefined;
  const docked = KEYBOARD_DOCKED && hasFooter;
  const pad = useKeyboardPad(active, rootRef, !docked);
  // Clavier ouvert, il reste 12 points entre la barre et le clavier : le reste de la marge du bas passe dessous.
  const hidden = Math.max(0, insets.bottom - 12);
  return (
    <View ref={rootRef} style={[{ flex: 1 }, style, { paddingBottom: docked ? 0 : pad }]}>
      <InsetContext.Provider value={docked ? Math.max(0, pad - hidden) : 0}>
        <View style={{ flex: 1 }}>{children}</View>
      </InsetContext.Provider>
      {hasFooter && (
        <KeyboardDock hiddenBottom={hidden}>
          <View style={[footerStyle, { paddingBottom: !docked && pad > 0 ? 12 : Math.max(12, insets.bottom) }]}>{footer}</View>
        </KeyboardDock>
      )}
    </View>
  );
}

/** La liste d'un KeyboardFrame : elle se ferme au doigt et garde de quoi défiler jusqu'en bas sous le clavier. */
export const KeyboardScroll = forwardRef<ScrollView, ScrollViewProps>(function KeyboardScroll(props, ref) {
  const bottom = useContext(InsetContext);
  return (
    <ScrollView
      ref={ref}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      {...props}
      contentInset={bottom > 0 ? { bottom } : undefined}
      scrollIndicatorInsets={bottom > 0 ? { bottom } : undefined}
    />
  );
});
