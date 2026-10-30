import { requireNativeView, requireOptionalNativeModule } from 'expo';
import { ComponentType, ReactNode } from 'react';

// Module natif local (modules/reiz-keyboard-dock), arrivé avec la 1.2.
// Absent (Android, ancien build) : l'écran garde son décalage calculé en JavaScript.
type NativeProps = { hiddenBottom: number; children?: ReactNode };

const available = !!requireOptionalNativeModule('ReizKeyboardDock');
const NativeDock: ComponentType<NativeProps> | null = available ? requireNativeView('ReizKeyboardDock') : null;

export const keyboardDockAvailable = () => available;

/** Ce qu'elle contient reste collé au clavier. `hiddenBottom` : la marge du bas qui peut passer sous le clavier. */
export function KeyboardDock({ hiddenBottom, children }: { hiddenBottom: number; children: ReactNode }) {
  if (!NativeDock) return <>{children}</>;
  return <NativeDock hiddenBottom={hiddenBottom}>{children}</NativeDock>;
}
