import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, Alert, Keyboard, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Ionicons } from '@expo/vector-icons';
import { supabase, currentUser } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { signOne } from '../lib/storage';
import { createGoal } from '../lib/createGoal';
import { consumePendingInvite, shareInvite, myInviteLink, type InviteChannel } from '../lib/invites';
import { APP_STORE_URL } from '../constants';
import { registerForPushNotifications } from '../lib/notifications';
import { track, getInstallId } from '../lib/track';
import { SentenceGoal, type SentenceResult } from './SentenceGoal';
import { InviteCard, shareInviteCard } from './InviteCard';
import { KeyboardFrame, KeyboardScroll } from './KeyboardFrame';
import { welcomePending, seenKey, Rise, CircleFaces } from './WelcomeFlow';
import { FEATURES } from '../lib/features';
import { F } from '../styles';
import { t, dirIcon } from '../i18n';

// Onboarding express (1.4, 12/11/2026) : après le prénom et le compte (Onboarding.tsx), deux écrans seulement.
//   1. Ton premier objectif, en une phrase.
//   2. Qui te suit ? Le lien d'invitation par WhatsApp, SMS ou le partage du téléphone, avec un « Plus tard » discret.
// La photo, la bio, la salle : plus tard, dans la carte « Ton profil » du fil. Les notifications : la demande du
// téléphone arrive à la fin, une fois l'objectif créé (elle a alors un sens).
// Remplace WelcomeFlow tant que QUICK_START est vrai (src/constants.ts).
// Retour possible d'une étape à l'autre (flèche en haut à gauche) : l'objectif déjà écrit reste à l'écran, et s'il
// est corrigé au retour, le nouveau remplace celui qui venait d'être créé (jamais deux objectifs).

type StepId = 'name' | 'objective' | 'invite' | 'notifs';

/** Version automatique, montée une fois dans App.tsx pour un compte tout neuf. */
export function QuickStart({ onChanged }: { onChanged?: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await currentUser();
      if (!(await welcomePending(user))) return;
      // Sans attente : l'objectif doit arriver tout de suite après le prénom.
      if (alive) setShow(true);
    })().catch(() => {});
    return () => { alive = false; };
  }, []);
  return <QuickStartModal visible={show} onClose={changed => { setShow(false); if (changed) onChanged?.(); }} />;
}

function Primary({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || busy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      style={{ backgroundColor: disabled ? 'rgba(255,255,255,0.14)' : '#fff', borderRadius: 27, minHeight: 54, alignItems: 'center', justifyContent: 'center' }}>
      {busy ? <ActivityIndicator color="#000" /> : <Text style={{ color: disabled ? 'rgba(255,255,255,0.4)' : '#000', fontSize: 17, fontFamily: F.extrabold }}>{label}</Text>}
    </TouchableOpacity>
  );
}

// Les couleurs de chaque app (Yllan, 12/11/2026) : on reconnaît WhatsApp, Messages et Instagram d'un coup d'œil.
const IG_GRADIENT = ['#feda75', '#d62976', '#4f5bd5'] as const;

function ShareRow({ icon, color, gradient, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; color: string; gradient?: readonly [string, string, string]; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={label}
      style={{ minHeight: 58, borderRadius: 29, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: color, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {gradient && <LinearGradient colors={gradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <Text style={{ flex: 1, color: '#fff', fontSize: 17, fontFamily: F.bold }} maxFontSizeMultiplier={1.3}>{label}</Text>
      <Ionicons name={dirIcon('chevron-forward')} size={18} color="rgba(255,255,255,0.45)" style={{ marginRight: 8 }} />
    </TouchableOpacity>
  );
}

/** `preview` (Réglages, « Revoir l'accueil ») : les écrans tels quels, rien n'est enregistré, rien n'est envoyé. */
export function QuickStartModal({ visible, preview, onClose }: { visible: boolean; preview?: boolean; onClose: (changed: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const [steps, setSteps] = useState<StepId[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [result, setResult] = useState<SentenceResult>({ goal: null, via: 'sentence', edited: false });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);
  // Celui qui m'a invité, si je suis arrivé par son lien : nous sommes déjà amis.
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  // Pour la carte d'invitation (image à poster sur Instagram) : mon nom, mon @pseudo, mon lien.
  const [me, setMe] = useState<{ name: string; username: string | null }>({ name: '', username: null });
  const [mine, setMine] = useState<{ link: string; personal: boolean }>({ link: APP_STORE_URL, personal: false });
  const [linkCopied, setLinkCopied] = useState(false);
  const cardRef = useRef<View>(null);
  // L'étape objectif reste montée une fois vue : au retour, la phrase écrite est encore là.
  const [seenObjective, setSeenObjective] = useState(false);
  // L'objectif créé pendant ce parcours, et ce qu'il disait : un retour suivi d'une correction le remplace.
  const created = useRef<{ id: string | null; sig: string } | null>(null);
  const wrote = useRef(false);
  const madeObjective = useRef(false);
  const onResult = useCallback((r: SentenceResult) => setResult(r), []);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setSteps(null); setIdx(0); setSent(0); setSeenObjective(false); wrote.current = false; madeObjective.current = false; created.current = null;
    (async () => {
      const user = await currentUser();
      if (!user) return;
      const [row, objs] = await Promise.all([
        supabase.from('users').select('full_name, username, avatar_url').eq('id', user.id).maybeSingle(),
        supabase.from('objectives').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      if (!alive) return;
      // « Athlète » = nom de secours d'un compte Apple ou Google sans prénom (ensureProfile) : on le demande ici.
      const full = (row.data as { full_name?: string } | null)?.full_name || '';
      const noName = !full || full === 'Athlète' || full === t('common.athlete');
      const list: StepId[] = [];
      if (noName && !preview) list.push('name');
      if (preview || !objs.count) list.push('objective');
      list.push('invite');
      // Essai du 19/11/2026 : la demande du téléphone tombait seule, 0,6 s après l'accueil, sans dire à quoi servent
      // les notifications. Un écran l'annonce d'abord. Il n'apparaît que si le téléphone peut encore poser la
      // question (et dans l'aperçu des Réglages, pour le voir).
      if (FEATURES.notifsExplainer) {
        const perm = preview ? null : await Notifications.getPermissionsAsync().catch(() => null);
        if (preview || (Device.isDevice && perm && perm.status !== 'granted' && perm.canAskAgain)) list.push('notifs');
      }
      if (!alive) return;
      // La photo est privée : il faut une adresse signée. Elle arrive après, sans retenir l'écran.
      const path = (row.data as { avatar_url?: string | null } | null)?.avatar_url;
      if (path) signOne(path).then(uri => { if (alive) setAvatar(uri); }).catch(() => {});
      else setAvatar(null);
      setMe({ name: noName ? '' : full, username: (row.data as { username?: string | null } | null)?.username ?? null });
      myInviteLink(user.id).then(l => { if (alive) setMine(l); }).catch(() => {});
      setUserId(user.id);
      setSteps(list);
      if (preview) return;
      // Relie l'écran d'inscription (anonyme) à ce compte, pour l'entonnoir.
      getInstallId().then(install => track('onboarding_account', { install, provider: String(user.app_metadata?.provider ?? 'email') }, 'onboarding')).catch(() => {});
      // Le profil existe forcément ici : c'est le bon moment pour retrouver l'invitation (lien reçu ou lien différé).
      consumePendingInvite(user.id, user.created_at).then(r => {
        if (!alive || r.status !== 'friends') return;
        wrote.current = true;
        setInvitedBy(r.name || '');
      }).catch(() => {});
    })().catch(() => { if (alive) setSteps(['invite']); });
    return () => { alive = false; };
  }, [visible, preview]);

  const step: StepId | null = steps ? steps[idx] : null;

  useEffect(() => { if (step === 'objective') setSeenObjective(true); }, [step]);

  useEffect(() => {
    if (visible && step && !preview) track('welcome_step', { step, index: idx, action: 'view', flow: 'quick' }, 'welcome');
  }, [visible, step, idx, preview]);

  // « Plus tard » sur l'écran des notifications : on ne déclenche pas la demande du téléphone (elle ne se pose qu'une fois).
  const skipNotifs = useRef(false);
  const finish = async (via: 'end' | 'later') => {
    Keyboard.dismiss();
    if (preview) { onClose(false); return; }
    track('welcome_end', { step, via, flow: 'quick' }, 'welcome');
    track('onboarding_done', { objective: madeObjective.current, invites: sent, invited_by_link: invitedBy !== null }, 'onboarding');
    if (userId) await AsyncStorage.setItem(seenKey(userId), '1').catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose(wrote.current);
    // La demande de notifications du téléphone, maintenant que l'objectif existe (rappels, amis qui postent).
    if (userId && !skipNotifs.current) setTimeout(() => { registerForPushNotifications(userId).catch(() => {}); }, 600);
  };
  const answerNotifs = (yes: boolean) => {
    skipNotifs.current = !yes;
    if (!preview) track('welcome_step', { step: 'notifs', index: idx, action: yes ? 'done' : 'skip', flow: 'quick' }, 'welcome');
    finish(yes ? 'end' : 'later');
  };

  const next = (action: 'done' | 'skip') => {
    if (!steps) return;
    if (!preview) track('welcome_step', { step, index: idx, action, flow: 'quick' }, 'welcome');
    if (idx + 1 >= steps.length) { finish(action === 'skip' ? 'later' : 'end'); return; }
    Haptics.selectionAsync().catch(() => {});
    setIdx(idx + 1);
  };

  const back = () => {
    if (idx <= 0 || busy) return;
    Keyboard.dismiss();
    Haptics.selectionAsync().catch(() => {});
    if (!preview) track('welcome_step', { step, index: idx, action: 'back', flow: 'quick' }, 'welcome');
    setIdx(idx - 1);
  };

  const saveName = async () => {
    const first = name.trim();
    if (!first) { Alert.alert(t('quick.nameTitle'), t('quick.nameNeeded')); return; }
    if (!userId) return;
    setBusy(true);
    const { error } = await supabase.from('users').update({ full_name: first.slice(0, 40) }).eq('id', userId);
    setBusy(false);
    if (error) { Alert.alert(t('common.error'), frError(error)); return; }
    wrote.current = true;
    next('done');
  };

  const saveObjective = async () => {
    if (!result.goal) return;
    if (preview) { Keyboard.dismiss(); next('done'); return; }
    // Revenu en arrière sans rien changer : l'objectif existe déjà, on avance.
    const sig = JSON.stringify(result.goal);
    if (created.current?.sig === sig) { Keyboard.dismiss(); next('done'); return; }
    setBusy(true);
    const { id, error } = await createGoal(result.goal, { from: 'welcome', via: result.via, edited: result.edited });
    setBusy(false);
    if (error) { Alert.alert(t('common.error'), frError(error)); return; }
    // Corrigé après un retour : le premier jet, créé il y a un instant et sans aucune séance, laisse la place.
    const previous = created.current?.id;
    if (previous) supabase.from('objectives').delete().eq('id', previous).then(() => {}, () => {});
    created.current = { id, sig };
    wrote.current = true;
    madeObjective.current = true;
    Keyboard.dismiss();
    next('done');
  };

  // « Plus tard » sur l'objectif : on avance, et le fil n'ouvrira pas la création d'objectif tout seul juste après
  // (Main le fait une fois pour un compte sans objectif : la personne vient de dire non).
  const skipObjective = () => {
    Keyboard.dismiss();
    if (userId && !preview) AsyncStorage.setItem(`reiz.firstobj.${userId}`, '1').catch(() => {});
    next('skip');
  };

  const share = async (channel: InviteChannel | 'instagram') => {
    if (!userId) return;
    Haptics.selectionAsync().catch(() => {});
    setLinkCopied(false);
    if (preview) { setSent(n => n + 1); return; }
    // Instagram : la carte (nom, QR code) part en image, le lien est copié pour le sticker « Lien ».
    const ok = channel === 'instagram'
      ? await shareInviteCard(cardRef, userId, 'welcome', () => setLinkCopied(true))
      : await shareInvite(userId, channel, 'welcome');
    if (ok) setSent(n => n + 1);
  };

  const total = 3;
  // Le prénom (étape 1) est déjà fait à l'inscription : la barre commence à 1 sur 3.
  const filled = step === 'invite' || step === 'notifs' ? 3 : step === 'objective' ? 2 : 1;

  // La barre du bas : elle suit le clavier. Vide tant que les étapes ne sont pas connues.
  const footer = (
    <>
          {step === 'name' && <Primary label={t('quick.continue')} onPress={saveName} disabled={!name.trim()} busy={busy} />}
          {step === 'objective' && <Primary label={t('quick.continue')} onPress={saveObjective} disabled={!result.goal} busy={busy} />}
          {/* Essai du 19/11/2026 : quelqu'un venu suivre un proche n'a pas d'objectif à écrire. Avant : bouton gris, aucune sortie. */}
          {step === 'objective' && FEATURES.skipFirstGoal && !result.goal && (
            <TouchableOpacity onPress={skipObjective} accessibilityRole="button" accessibilityLabel={t('quick.later')} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: F.semibold }}>{t('quick.later')}</Text>
            </TouchableOpacity>
          )}
          {step === 'notifs' && (
            <>
              <Primary label={t('welcome.enableNotifs')} onPress={() => answerNotifs(true)} />
              <TouchableOpacity onPress={() => answerNotifs(false)} accessibilityRole="button" accessibilityLabel={t('quick.later')} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: F.semibold }}>{t('quick.later')}</Text>
              </TouchableOpacity>
            </>
          )}
          {step === 'invite' && (sent > 0
            ? <Primary label={t('quick.finish')} onPress={() => next('done')} />
            : (
              <TouchableOpacity onPress={() => next('skip')} accessibilityRole="button" accessibilityLabel={t('quick.later')} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, fontFamily: F.semibold }}>{t('quick.later')}</Text>
              </TouchableOpacity>
            ))}
    </>
  );

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={back}>
      {/* Même clavier que les commentaires : le bouton du bas reste collé au clavier (KeyboardFrame). */}
      <KeyboardFrame active={visible} style={{ backgroundColor: '#0a0a0a', paddingTop: insets.top + 8 }} footerStyle={{ paddingHorizontal: 24, paddingTop: 8, backgroundColor: '#0a0a0a' }} footer={footer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, height: 40 }}>
            {idx > 0 ? (
              <TouchableOpacity onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.back')} style={{ width: 28 }}>
                <Ionicons name={dirIcon('chevron-back')} size={24} color="#fff" />
              </TouchableOpacity>
            ) : preview ? (
              <TouchableOpacity onPress={() => onClose(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.cancel')} style={{ width: 28 }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            ) : <View style={{ width: 28 }} />}
            <View style={{ flex: 1, flexDirection: 'row', gap: 6 }} accessibilityLabel={t('quick.progress', { n: filled, total })}>
              {Array.from({ length: total }).map((_, i) => (
                <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < filled ? '#fff' : 'rgba(255,255,255,0.18)' }} />
              ))}
            </View>
            <View style={{ width: 28 }} />
          </View>

          {!step ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
          ) : (
            <>
              {(seenObjective || step === 'objective') && (
                <KeyboardScroll style={{ flex: 1, display: step === 'objective' ? 'flex' : 'none' }}
                  contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24 }}>
                  <Rise>
                    <Text style={title} maxFontSizeMultiplier={1.2}>{t('quick.objTitle')}</Text>
                    <Text style={sub}>{t('quick.objSub')}</Text>
                  </Rise>
                  <Rise delay={80} style={{ marginTop: 22 }}>
                    <SentenceGoal onChange={onResult} autoFocus tone="plain" />
                  </Rise>
                </KeyboardScroll>
              )}

              {step !== 'objective' && (
              <KeyboardScroll key={step} style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24 }}>
                {step === 'name' && (
                  <>
                    <Text style={title} maxFontSizeMultiplier={1.2}>{t('quick.nameTitle')}</Text>
                    <Text style={sub}>{t('quick.nameSub')}</Text>
                    <TextInput
                      style={{ marginTop: 24, minHeight: 58, borderRadius: 24, paddingHorizontal: 20, color: '#fff', fontSize: 20, fontFamily: F.bold, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}
                      placeholder={t('onboarding.firstNamePlaceholder')}
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      value={name}
                      onChangeText={setName}
                      autoFocus
                      keyboardAppearance="dark"
                      autoCapitalize="words"
                      autoCorrect={false}
                      textContentType="givenName"
                      returnKeyType="done"
                      onSubmitEditing={saveName}
                      maxLength={40}
                      accessibilityLabel={t('onboarding.firstNameLabel')}
                    />
                  </>
                )}

                {step === 'notifs' && (
                  <>
                    <Rise>
                      <Text style={title} maxFontSizeMultiplier={1.2}>{t('welcome.notifsTitle')}</Text>
                      <Text style={sub}>{t('welcome.notifsSub')}</Text>
                    </Rise>
                    {/* Trois exemples de ce qui arrivera, pour que la demande du téléphone ait un sens. */}
                    <View style={{ marginTop: 26, gap: 10 }}>
                      {([['mock1Title', 'mock1Body', 'mockNow'], ['mock2Title', 'mock2Body', 'mock2When'], ['mock3Title', 'mock3Body', 'mock3When']] as const).map(([a, b, w], i) => (
                        <Rise key={a} delay={100 + i * 70}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name="notifications" size={18} color="#000" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.bold }} numberOfLines={1}>{t(`welcome.${a}`)}</Text>
                              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontFamily: F.regular, marginTop: 1 }} numberOfLines={1}>{t(`welcome.${b}`)}</Text>
                            </View>
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F.regular }}>{t(`welcome.${w}`)}</Text>
                          </View>
                        </Rise>
                      ))}
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 18, fontFamily: F.regular, textAlign: 'center', marginTop: 18 }}>{t('welcome.footNotifs')}</Text>
                  </>
                )}

                {step === 'invite' && (
                  <>
                    {/* Le visuel de l'ancien accueil : toi au centre, ton futur cercle autour, tout arrive en douceur. */}
                    <Rise style={{ alignItems: 'center', marginTop: 4 }}>
                      <CircleFaces avatar={avatar} />
                    </Rise>
                    <Rise delay={80} style={{ marginTop: 26 }}>
                      <Text style={[title, { textAlign: 'center' }]} maxFontSizeMultiplier={1.2}>{t('quick.inviteTitle')}</Text>
                      <Text style={[sub, { textAlign: 'center' }]}>{t('quick.inviteSub')}</Text>
                    </Rise>
                    {invitedBy !== null && !!invitedBy && (
                      <Rise delay={120} style={{ marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={{ flex: 1, color: '#fff', fontSize: 14, lineHeight: 19, fontFamily: F.semibold }}>{t('quick.alreadyFriend', { name: invitedBy })}</Text>
                      </Rise>
                    )}
                    <View style={{ marginTop: 24, gap: 14 }}>
                      <Rise delay={140}><ShareRow icon="logo-whatsapp" color="#25D366" label={t('quick.whatsapp')} onPress={() => share('whatsapp')} /></Rise>
                      <Rise delay={200}><ShareRow icon="chatbubble" color="#34C759" label={t('quick.sms')} onPress={() => share('sms')} /></Rise>
                      <Rise delay={260}><ShareRow icon="logo-instagram" color="#d62976" gradient={IG_GRADIENT} label={t('shareSheet.shareInstagram')} onPress={() => share('instagram')} /></Rise>
                      <Rise delay={320}><ShareRow icon="share-outline" color="rgba(255,255,255,0.18)" label={t('quick.other')} onPress={() => share('share')} /></Rise>
                    </View>
                    {sent > 0 && (
                      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 19, fontFamily: F.semibold, textAlign: 'center', marginTop: 16 }} accessibilityLiveRegion="polite">{linkCopied ? t('shareSheet.linkCopied') : t('quick.sent')}</Text>
                    )}
                  </>
                )}
              </KeyboardScroll>
              )}

            </>
          )}
      </KeyboardFrame>
      {/* La carte d'invitation, hors de l'écran : elle ne sert qu'à faire l'image partagée sur Instagram. */}
      {step === 'invite' && (
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: -2000, top: 0 }}>
          <InviteCard ref={cardRef} width={320} name={name.trim() || me.name || t('shareSheet.me')} username={me.username} avatar={avatar} link={mine.link} personal={mine.personal} />
        </View>
      )}
    </Modal>
  );
}

const title = { color: '#fff', fontSize: 34, lineHeight: 38, fontFamily: F.black, letterSpacing: -1.1 } as const;
const sub = { color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 23, fontFamily: F.regular, marginTop: 10 } as const;
