import { useState, useEffect, useRef } from 'react';
import { Linking, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useFonts, Inter_300Light, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black } from '@expo-google-fonts/inter';
import { supabase, storedUserId } from './src/lib/supabase';
import { registerForPushNotifications } from './src/lib/notifications';
import { handleAuthUrl, ensureProfile } from './src/lib/googleAuth';
import { cacheClearAll } from './src/lib/cache';
import { resetSignedCache } from './src/lib/storage';
import { resetUserCards } from './src/lib/posts';
import { resetCloseCircle } from './src/lib/closeCircle';
import { stopAllPresence } from './src/lib/presence'; // importe aussi la tâche de détection d'arrivée
import { captureInviteFromUrl, consumePendingInvite } from './src/lib/invites';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { Splash } from './src/screens/Splash';
import { Onboarding } from './src/screens/Onboarding';
import { Main } from './src/screens/Main';
import { WhatsNewModal } from './src/components/WhatsNewModal';
import { FindFriendsPrompt } from './src/components/FindFriendsPrompt';
import { WelcomeFlow, welcomePending } from './src/components/WelcomeFlow';
import { WELCOME_FLOW } from './src/constants';
import { PostScreen } from './src/screens/PostScreen';
import { track } from './src/lib/track';
import { registerLiveActivityToken, endExpiredLiveActivities } from './src/lib/liveActivity';
import { saveLanguage } from './src/lib/language';
import { mark } from './src/lib/perf';

// Au-delà, le fil est rechargé au retour dans l'app (liens de photos neufs, posts du jour).
const STALE_AFTER_MS = 3 * 3600 * 1000;

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
  // Remonter Main recharge le fil : utile quand l'accueil vient de créer la photo ou le premier objectif.
  const [mainKey, setMainKey] = useState(0);
  const notifListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const registeredUserId = useRef<string | null>(null);
  // Carte du duo touchée alors que l'app démarrait : on ouvre la publication une fois connecté.
  const pendingDuo = useRef<string | null>(null);

  // Compte tout neuf : la demande d'autorisation du système attend l'écran d'accueil qui explique pourquoi (sinon elle tombe sans contexte).
  const maybeRegisterPush = async (user: { id: string; created_at?: string }) => {
    if (registeredUserId.current === user.id) return;
    registeredUserId.current = user.id;
    // Jeton de l'Activité en direct du duo : il ne demande aucune autorisation, on le range tout de suite.
    registerLiveActivityToken();
    saveLanguage(user.id);
    if (await welcomePending(user)) return;
    registerForPushNotifications(user.id);
  };

  useEffect(() => {
    // Deep link d'invitation : capture le lien d'ouverture (app fermée) puis ceux reçus
    // app ouverte. Le ref est consommé après connexion (cf. onAuthStateChange ci-dessous).
    // Carte du duo (Activité en direct) touchée : reiz://duo/<id de l'ami> ouvre la publication avec lui identifié.
    const openDuo = (url: string | null) => {
      const id = url?.match(/^reiz:\/\/duo\/([0-9a-f-]{36})/i)?.[1];
      if (!id) return;
      setPostDuoWith(id);
      pendingDuo.current = id;
      track('post_open', { from: 'duo_card' });
      setScreen(s => {
        if (s !== 'main' && s !== 'post') return s; // pas encore connecté : enter() s'en chargera
        pendingDuo.current = null;
        return 'post';
      });
    };
    Linking.getInitialURL().then((url) => { handleAuthUrl(url); captureInviteFromUrl(url, registeredUserId.current); openDuo(url); });
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      handleAuthUrl(url);
      captureInviteFromUrl(url, registeredUserId.current);
      openDuo(url);
    });
    // Une carte du duo dont l'heure est passée ne reste pas affichée.
    endExpiredLiveActivities();
    // Retour dans l'app après une longue absence : le fil affiché date d'hier, avec des liens de photos qui ont pu
    // expirer (les photos ne chargeaient plus, vu dans les journaux du serveur le 23/10). On le recharge, liens neufs.
    let backgroundAt = 0;
    const appStateSub = AppState.addEventListener('change', st => {
      if (st === 'background') backgroundAt = Date.now();
      if (st !== 'active') return;
      endExpiredLiveActivities();
      if (backgroundAt && Date.now() - backgroundAt > STALE_AFTER_MS) setMainKey(k => k + 1);
      backgroundAt = 0;
    });

    // Apple / Google : la ligne `users` n'existe pas encore à la première connexion.
    // On la crée AVANT d'entrer dans l'app, sinon le fil se charge sans profil.
    // Une seule fois par compte : le renouvellement du jeton (toutes les heures) ne doit rien relancer, et surtout
    // pas ramener sur le fil quelqu'un qui est en train d'écrire un post (c'était le cas avant le 25/10/2026).
    const enteredUser = { id: null as string | null };
    const enter = async (user: any) => {
      if (enteredUser.id === user.id) return;
      enteredUser.id = user.id;
      const viaEmail = (user?.app_metadata?.providers || [user?.app_metadata?.provider]).includes('email');
      if (!viaEmail) await ensureProfile(user).catch(() => {});
      maybeRegisterPush(user);
      consumePendingInvite(user.id);
      setScreen(s => (s === 'post' ? s : pendingDuo.current ? 'post' : 'main'));
      pendingDuo.current = null;
    };

    // Ouverture rapide : une session est enregistrée sur le téléphone, on entre tout de suite (le fil gardé en
    // mémoire s'affiche) sans attendre que Supabase renouvelle le jeton par le réseau. Le serveur ne répond qu'avec
    // un jeton valide, et une session refusée ramène à l'accueil (INITIAL_SESSION ci-dessous).
    storedUserId().then(id => {
      mark('session:locale');
      if (!id) return;
      setScreen(s => (s === 'splash' ? 'main' : s));
      setCheckingAuth(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        mark('session:confirmee');
        setCheckingAuth(false);
        if (session) { enter(session.user); return; }
        // Pas de session valide. Si elle est encore enregistrée (renouvellement impossible hors ligne), on garde
        // l'app ouverte : supabase-js réessaiera tout seul. Sinon, retour à l'accueil.
        storedUserId().then(id => { if (!id) setScreen(s => (s === 'main' || s === 'post' ? 'splash' : s)); });
        return;
      }
      if (event === 'SIGNED_IN' && session) { enter(session.user); return; }
      if (event === 'SIGNED_OUT') {
        enteredUser.id = null;
        registeredUserId.current = null;
        stopAllPresence(); // plus de détection d'arrivée pour un compte déconnecté
        cacheClearAll(); resetSignedCache(); resetUserCards(); resetCloseCircle(); // rien de ce compte ne reste affiché pour le suivant
        setScreen('splash');
      }
      // TOKEN_REFRESHED, USER_UPDATED : rien à faire.
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
      appStateSub.remove();
    };
  }, []);

  if (checkingAuth || !fontsLoaded) return null;
  mark('ecran:' + screen);
  // Ouvre la publication. `from` dit d'où (bouton, carte du profil, fil vide, accueil...) pour le back-office.
  const openPost = (opts?: { duoWith?: string; from?: string }) => {
    track('post_open', { from: opts?.from ?? (opts?.duoWith ? 'duo' : 'button') });
    setPostDuoWith(opts?.duoWith ?? null);
    setScreen('post');
  };

  if (screen === 'splash') return <Splash onNext={() => setScreen('onboarding')} />;
  if (screen === 'onboarding') return <Onboarding onNext={() => setScreen('main')} />;
  if (screen === 'main') return (
    <>
      <Main key={mainKey} onPost={openPost} navIntent={navIntent} onNavIntentHandled={() => setNavIntent(null)} />
      <WhatsNewModal />
      {WELCOME_FLOW ? <WelcomeFlow onChanged={() => setMainKey(k => k + 1)} onPost={() => openPost({ from: 'welcome' })} /> : <FindFriendsPrompt />}
    </>
  );
  if (screen === 'post') return <PostScreen duoWith={postDuoWith} onBack={() => setScreen('main')} onPublish={() => setScreen('main')} />;
  return null;
}
