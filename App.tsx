import { useState, useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useFonts, Inter_300Light, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black } from '@expo-google-fonts/inter';
import { supabase } from './src/lib/supabase';
import { registerForPushNotifications } from './src/lib/notifications';
import { handleAuthUrl, ensureProfile } from './src/lib/googleAuth';
import { captureInviteFromUrl, consumePendingInvite } from './src/lib/invites';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { Splash } from './src/screens/Splash';
import { Onboarding } from './src/screens/Onboarding';
import { Main } from './src/screens/Main';
import { PostScreen } from './src/screens/PostScreen';

export default function App() {
  return (
    <ErrorBoundary>
      {/* Fournit les encoches/home indicator réels de l'appareil à tous les écrans */}
      <SafeAreaProvider>
        <AppInner />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

function AppInner() {
  const [fontsLoaded] = useFonts({ Inter_300Light, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black });
  const [screen, setScreen] = useState('splash');
  const [checkingAuth, setCheckingAuth] = useState(true);
  // Onglet à ouvrir quand l'utilisateur tape une notification push
  const [navIntent, setNavIntent] = useState<string | null>(null);
  // Ami à identifier d'office quand on répond à une séance en duo.
  const [postDuoWith, setPostDuoWith] = useState<string | null>(null);
  const notifListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const registeredUserId = useRef<string | null>(null);

  const maybeRegisterPush = (uid: string) => {
    if (registeredUserId.current === uid) return;
    registeredUserId.current = uid;
    registerForPushNotifications(uid);
  };

  useEffect(() => {
    // Deep link d'invitation : capture le lien d'ouverture (app fermée) puis ceux reçus
    // app ouverte. Le ref est consommé après connexion (cf. onAuthStateChange ci-dessous).
    Linking.getInitialURL().then((url) => { handleAuthUrl(url); captureInviteFromUrl(url, registeredUserId.current); });
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      handleAuthUrl(url);
      captureInviteFromUrl(url, registeredUserId.current);
    });

    // Apple / Google : la ligne `users` n'existe pas encore à la première connexion.
    // On la crée AVANT d'entrer dans l'app, sinon le fil se charge sans profil.
    const enter = async (user: any) => {
      const viaEmail = (user?.app_metadata?.providers || [user?.app_metadata?.provider]).includes('email');
      if (!viaEmail) { await ensureProfile(user).catch(() => {}); consumePendingInvite(user.id); }
      setScreen('main');
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        enter(session.user);
        maybeRegisterPush(session.user.id);
        consumePendingInvite(session.user.id);
      }
      setCheckingAuth(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        enter(session.user);
        maybeRegisterPush(session.user.id);
        consumePendingInvite(session.user.id);
      } else {
        registeredUserId.current = null;
        setScreen('splash');
      }
    });

    notifListener.current = Notifications.addNotificationReceivedListener(() => {});
    // Deep link : taper une notification ouvre le bon onglet (envoyé dans data.type par les edge functions)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = (response.notification.request.content.data as any)?.type;
      if (type) {
        setScreen('main');
        setNavIntent(String(type));
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      notifListener.current?.remove();
      responseListener.current?.remove();
      linkSub.remove();
    };
  }, []);

  if (checkingAuth || !fontsLoaded) return null;
  if (screen === 'splash') return <Splash onNext={() => setScreen('onboarding')} />;
  if (screen === 'onboarding') return <Onboarding onNext={() => setScreen('main')} />;
  if (screen === 'main') return <Main onPost={(opts) => { setPostDuoWith(opts?.duoWith ?? null); setScreen('post'); }} navIntent={navIntent} onNavIntentHandled={() => setNavIntent(null)} />;
  if (screen === 'post') return <PostScreen duoWith={postDuoWith} onBack={() => setScreen('main')} onPublish={() => setScreen('main')} />;
  return null;
}
