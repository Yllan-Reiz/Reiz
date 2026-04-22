import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { supabase } from './supabase';

export default function App() {
  const [screen, setScreen] = useState('splash');
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setScreen('main');
      setCheckingAuth(false);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setScreen('main');
      else setScreen('splash');
    });
  }, []);

  if (checkingAuth) return null;

  if (screen === 'splash') return <Splash onNext={() => setScreen('onboarding')} />;
  if (screen === 'onboarding') return <Onboarding onNext={() => setScreen('main')} />;
  if (screen === 'main') return <Main onPost={() => setScreen('post')} />;
  if (screen === 'post') return <Post onBack={() => setScreen('main')} onPublish={() => setScreen('main')} />;
  return null;
}

function Splash({ onNext }: { onNext: () => void }) {
  return (
    <View style={s.splashContainer}>
      <StatusBar barStyle="light-content" />
      <Image source={require('./assets/ecriture-reiz-blanc.png')} style={s.splashLogo} resizeMode="contain" />
      <Text style={s.splashTagline}>RISE TO YOUR GOALS</Text>
      <View style={s.splashBottom}>
        <TouchableOpacity style={s.btn} onPress={onNext}>
          <Text style={s.btnText}>Commencer →</Text>
        </TouchableOpacity>
        <Text style={s.splashLogin}>Déjà un compte ? <Text style={s.splashLoginLink}>Se connecter</Text></Text>
      </View>
    </View>
  );
}

const GOALS = [
  { emoji: '💪', label: 'Perdre du poids' },
  { emoji: '💰', label: "Gagner de l'argent" },
  { emoji: '🏃', label: 'Courir' },
  { emoji: '📚', label: 'Lire' },
  { emoji: '🧘', label: 'Méditer' },
  { emoji: '🚀', label: 'Startup' },
  { emoji: '🏋️', label: 'Sport' },
  { emoji: '🏦', label: 'Épargne' },
];

function Onboarding({ onNext }: { onNext: () => void }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleGoal = (label: string) => setSelected(prev => prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]);
  const next = () => step < 2 ? setStep(st => st + 1) : undefined;

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      Alert.alert('Erreur', 'Remplis tous les champs !');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });
    setLoading(false);
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      Alert.alert(
        'Compte créé ! 🎉',
        'Vérifie ta boîte mail pour confirmer ton adresse.',
        [{ text: 'OK', onPress: onNext }]
      );
    }
  };

  return (
    <View style={s.obContainer}>
      <View style={s.dots}>
        {[0, 1, 2].map(i => <View key={i} style={[s.dot, step === i && s.dotActive]} />)}
      </View>
      {step === 0 && (
        <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
          <Text style={s.eyebrow}>Bienvenue</Text>
          <Text style={s.headline}>Tes objectifs méritent une communauté.</Text>
          <Text style={s.subtext}>Les influenceurs réussissent car leur communauté les pousse. Reiz te donne ça, avec tes proches.</Text>
          <View style={s.cards}>
            {[
              { emoji: '🤝', title: 'Cercle de confiance', desc: "Tes amis proches voient ta progression et t'encouragent." },
              { emoji: '📈', title: 'Progression visible', desc: 'Photo, texte, pourcentage — montre où tu en es.' },
              { emoji: '🔥', title: 'Motivation réelle', desc: "La streak quotidienne t'empêche d'abandonner." },
            ].map((card, i) => (
              <View key={i} style={s.card}>
                <Text style={s.cardEmoji}>{card.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{card.title}</Text>
                  <Text style={s.cardDesc}>{card.desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.btn} onPress={next}><Text style={s.btnText}>C'est parti →</Text></TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
      {step === 1 && (
        <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
          <Text style={s.eyebrow}>Étape 1</Text>
          <Text style={s.headline}>Choisis tes objectifs.</Text>
          <Text style={s.subtext}>Sur quoi veux-tu être accompagné ?</Text>
          <View style={s.pillsGrid}>
            {GOALS.map((g) => (
              <TouchableOpacity key={g.label} style={[s.pill, selected.includes(g.label) && s.pillActive]} onPress={() => toggleGoal(g.label)}>
                <Text style={s.pillEmoji}>{g.emoji}</Text>
                <Text style={[s.pillText, selected.includes(g.label) && s.pillTextActive]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[s.btn, selected.length === 0 && s.btnDisabled]} onPress={selected.length > 0 ? next : undefined}>
            <Text style={[s.btnText, selected.length === 0 && s.btnTextDisabled]}>Continuer →</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
      {step === 2 && (
        <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
          <Text style={s.eyebrow}>Étape 2</Text>
          <Text style={s.headline}>Crée ton compte.</Text>
          <Text style={s.subtext}>Ton parcours commence maintenant.</Text>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>PRÉNOM</Text>
            <TextInput
              style={s.inputField}
              placeholder="Yllan"
              placeholderTextColor="#444"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>EMAIL</Text>
            <TextInput
              style={s.inputField}
              placeholder="yllan@reiz.app"
              placeholderTextColor="#444"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>MOT DE PASSE</Text>
            <TextInput
              style={s.inputField}
              placeholder="••••••••"
              placeholderTextColor="#444"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
          <View style={s.divider}><View style={s.dividerLine} /><Text style={s.dividerText}>ou</Text><View style={s.dividerLine} /></View>
          <TouchableOpacity style={s.appleBtn}><Text style={s.appleBtnText}>🍎  Continuer avec Apple</Text></TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, { marginTop: 16 }, loading && s.btnDisabled]}
            onPress={loading ? undefined : handleSignUp}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={s.btnText}>Créer mon compte 🚀</Text>
            )}
          </TouchableOpacity>
          <Text style={s.legal}>En créant un compte tu acceptes nos <Text style={s.legalLink}>CGU</Text></Text>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
      {step > 0 && (
        <TouchableOpacity style={s.obBackBtn} onPress={() => setStep(st => st - 1)}>
          <Text style={s.obBackText}>← Retour</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const UPDATES = [
  { id: '1', name: 'Karim', initial: 'K', time: 'Il y a 23 min', goal: '🏃 Courir 10 km', progress: 64, progressLabel: '6,4 km', caption: 'Entraînement matinal 🌅', likes: 13, fire: 5, muscle: 3, comments: 2, isPrivate: false },
  { id: '2', name: 'Sofia', initial: 'S', time: 'Il y a 1h', goal: '💪 Perdre 10 kg', progress: 40, progressLabel: '4 kg', caption: 'Meal prep de la semaine 🥗', likes: 8, fire: 12, muscle: 7, comments: 4, isPrivate: false },
  { id: '3', name: 'Lucas', initial: 'L', time: 'Il y a 3h', goal: '💰 Gagner 10 000€', progress: 28, progressLabel: '2 800€', caption: '', likes: 6, fire: 9, muscle: 0, comments: 1, isPrivate: true },
];

const MY_OBJECTIVES = [
  { id: '1', emoji: '🏃', name: 'Courir 10 km', progress: 72, unit: 'km', max: 10, streak: 8, visibility: 'Public' },
  { id: '2', emoji: '📚', name: 'Lire 12 livres', progress: 25, unit: 'livres', max: 12, streak: 3, visibility: 'Privé' },
  { id: '3', emoji: '🚀', name: 'Lancer ma startup', progress: 45, unit: '%', max: 100, streak: 14, visibility: 'Public' },
];

const FRIENDS = [
  { initial: 'K', name: 'Karim', posted: true, streak: 12 },
  { initial: 'S', name: 'Sofia', posted: true, streak: 5 },
  { initial: 'L', name: 'Lucas', posted: false, streak: 3 },
  { initial: 'M', name: 'Marie', posted: false, streak: 0 },
];

function Main({ onPost }: { onPost: () => void }) {
  const [tab, setTab] = useState('feed');
  const [reactions, setReactions] = useState<{[key: string]: {likes: boolean, fire: boolean, muscle: boolean}}>({});
  const toggleReaction = (id: string, type: 'likes' | 'fire' | 'muscle') => setReactions(prev => ({ ...prev, [id]: { ...prev[id], [type]: !prev[id]?.[type] } }));

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Image source={require('./assets/ecriture-reiz-blanc.png')} style={s.headerLogo} resizeMode="contain" />
        <View style={s.headerRight}>
          <View style={s.streakBadge}><Text style={s.streakText}>🔥 8j</Text></View>
          <View style={s.iconBtn}><Text style={s.iconText}>🔔</Text></View>
          <TouchableOpacity style={s.iconBtn} onPress={handleSignOut}>
            <Text style={s.iconText}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.friendsBar}>
        {[{ initial: 'Toi', posted: true }, ...FRIENDS].map((f, i) => (
          <View key={i} style={s.friendItem}>
            <View style={[s.friendAv, f.posted ? s.friendAvActive : s.friendAvInactive]}>
              <Text style={s.friendAvText}>{f.initial}</Text>
            </View>
            <Text style={[s.friendName, f.posted && s.friendNameActive]}>{f.initial}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={s.tabs}>
        {(['feed', 'objectives', 'friends'] as const).map((t, i) => (
          <TouchableOpacity key={t} style={s.tabBtn} onPress={() => setTab(t)}>
            <Text style={[s.tab, tab === t && s.tabActive]}>{['Feed', 'Mes objectifs', 'Amis'][i]}</Text>
            {tab === t && <View style={s.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'feed' && (
        <ScrollView style={s.feed} showsVerticalScrollIndicator={false}>
          <View style={s.myUpdate}>
            <View style={s.myAv}><Text style={s.myAvText}>Y</Text></View>
            <View style={s.myUpdateInfo}>
              <Text style={s.myUpdateTitle}>Ta mise à jour du jour ✓</Text>
              <Text style={s.myUpdateSub}>🏃 7,2 km · Il y a 2 min · <Text style={s.streakInline}>8j 🔥</Text></Text>
            </View>
            <View style={s.postedBadge}><Text style={s.postedBadgeText}>Publié</Text></View>
          </View>
          {UPDATES.map((u) => (
            <View key={u.id} style={[s.feedCard, u.isPrivate && s.feedCardPrivate]}>
              {u.isPrivate && <View style={s.privBadge}><Text style={s.privBadgeText}>PRIVÉ</Text></View>}
              <View style={s.cardHeader}>
                <View style={s.av}><Text style={s.avText}>{u.initial}</Text></View>
                <View style={s.cardMeta}>
                  <Text style={s.cardName}>{u.name}</Text>
                  <Text style={s.cardTime}>{u.time}</Text>
                </View>
              </View>
              <View style={s.goalRow}>
                <View style={s.goalPill}><Text style={s.goalPillText}>{u.goal}</Text></View>
              </View>
              <View style={s.progressRow}>
                <View style={s.progressBg}><View style={[s.progressFill, { width: `${u.progress}%` as any }]} /></View>
                <Text style={s.progressLabel}>{u.progressLabel}</Text>
              </View>
              {u.caption ? <View style={s.photoPlaceholder}><Text style={s.photoCaption}>{u.caption}</Text></View> : null}
              <View style={s.reactionsRow}>
                <TouchableOpacity style={[s.rxn, reactions[u.id]?.likes && s.rxnActive]} onPress={() => toggleReaction(u.id, 'likes')}>
                  <Text style={s.rxnEmoji}>❤️</Text><Text style={s.rxnCount}>{u.likes + (reactions[u.id]?.likes ? 1 : 0)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.rxn, reactions[u.id]?.fire && s.rxnActive]} onPress={() => toggleReaction(u.id, 'fire')}>
                  <Text style={s.rxnEmoji}>🔥</Text><Text style={s.rxnCount}>{u.fire + (reactions[u.id]?.fire ? 1 : 0)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.rxn, reactions[u.id]?.muscle && s.rxnActive]} onPress={() => toggleReaction(u.id, 'muscle')}>
                  <Text style={s.rxnEmoji}>💪</Text><Text style={s.rxnCount}>{u.muscle + (reactions[u.id]?.muscle ? 1 : 0)}</Text>
                </TouchableOpacity>
                <Text style={s.commentsLink}>{u.comments} commentaires</Text>
              </View>
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {tab === 'objectives' && (
        <ScrollView style={s.feed} showsVerticalScrollIndicator={false}>
          <View style={s.statsRow}>
            <View style={s.statPill}><Text style={s.statVal}>3</Text><Text style={s.statLbl}>Actifs</Text></View>
            <View style={s.statPill}><Text style={s.statVal}>🔥 8j</Text><Text style={s.statLbl}>Streak</Text></View>
            <View style={s.statPill}><Text style={s.statVal}>47%</Text><Text style={s.statLbl}>Moy.</Text></View>
          </View>
          {MY_OBJECTIVES.map((o) => (
            <View key={o.id} style={s.objCard}>
              <View style={s.objCardHeader}>
                <View style={s.objIconBox}><Text style={s.objEmoji}>{o.emoji}</Text></View>
                <View style={s.objCardInfo}>
                  <Text style={s.objCardName}>{o.name}</Text>
                  <Text style={s.objCardSub}>🔥 {o.streak} jours d'affilée</Text>
                </View>
                <View style={[s.visBadge, o.visibility === 'Public' && s.visBadgePublic]}>
                  <Text style={[s.visText, o.visibility === 'Public' && s.visTextPublic]}>{o.visibility}</Text>
                </View>
              </View>
              <View style={s.objProgressRow}>
                <View style={s.progressBg}><View style={[s.progressFill, { width: `${o.progress}%` as any }]} /></View>
                <Text style={s.progressLabel}>{o.progress}%</Text>
              </View>
              <TouchableOpacity style={s.updateBtn}><Text style={s.updateBtnText}>+ Mise à jour</Text></TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={s.addObjBtn}>
            <Text style={s.addObjBtnText}>+ Ajouter un objectif</Text>
          </TouchableOpacity>
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {tab === 'friends' && (
        <ScrollView style={s.feed} showsVerticalScrollIndicator={false}>
          <View style={s.searchBar}>
            <Text style={s.searchIcon}>🔍</Text>
            <Text style={s.searchPlaceholder}>Rechercher un ami...</Text>
          </View>
          <Text style={s.sectionTitle}>4 amis</Text>
          {FRIENDS.map((f, i) => (
            <View key={i} style={s.friendRow}>
              <View style={[s.friendRowAv, f.posted && s.friendRowAvActive]}>
                <Text style={s.friendRowAvText}>{f.initial}</Text>
              </View>
              <View style={s.friendRowInfo}>
                <Text style={s.friendRowName}>{f.name}</Text>
                <Text style={s.friendRowSub}>{f.posted ? "✓ A posté aujourd'hui" : 'Pas encore posté'}</Text>
              </View>
              {f.streak > 0 ? (
                <View style={s.friendStreakBadge}><Text style={s.friendStreakText}>🔥 {f.streak}j</Text></View>
              ) : (
                <TouchableOpacity style={s.nudgeBtn}><Text style={s.nudgeBtnText}>👋</Text></TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity style={s.inviteBtn}>
            <Text style={s.inviteBtnText}>+ Inviter des amis</Text>
          </TouchableOpacity>
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={onPost}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      <View style={s.bottomNav}>
        <TouchableOpacity style={s.navItem} onPress={() => setTab('feed')}>
          <Text style={[s.navIcon, tab === 'feed' && s.navIconActive]}>⊞</Text>
          {tab === 'feed' && <View style={s.navDot} />}
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={onPost}>
          <View style={s.navPostBtn}><Text style={s.navPostBtnText}>+</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => setTab('friends')}>
          <Text style={[s.navIcon, tab === 'friends' && s.navIconActive]}>👥</Text>
          {tab === 'friends' && <View style={s.navDot} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const OBJECTIVES = [
  { id: '1', emoji: '🏃', name: 'Courir 10 km', progress: 64, unit: 'km', max: 10, current: 6.4 },
  { id: '2', emoji: '📚', name: 'Lire 12 livres', progress: 25, unit: 'livres', max: 12, current: 3 },
  { id: '3', emoji: '🚀', name: 'Lancer ma startup', progress: 45, unit: '%', max: 100, current: 45 },
];

function Post({ onBack, onPublish }: { onBack: () => void, onPublish: () => void }) {
  const [step, setStep] = useState(0);
  const [selectedObj, setSelectedObj] = useState(0);
  const [progress, setProgress] = useState(72);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('public');
  const obj = OBJECTIVES[selectedObj];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => step > 0 ? setStep(st => st - 1) : onBack()}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{step === 0 ? 'Quel objectif ?' : step === 1 ? 'Ta mise à jour' : 'Qui peut voir ?'}</Text>
        <Text style={s.stepIndicator}>{step + 1}/3</Text>
      </View>
      <View style={s.dots}>
        {[0, 1, 2].map(i => <View key={i} style={[s.dot, step === i && s.dotActive]} />)}
      </View>
      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {step === 0 && (
          <View>
            <Text style={s.sectionLabel}>MES OBJECTIFS ACTIFS</Text>
            {OBJECTIVES.map((o, i) => (
              <TouchableOpacity key={o.id} style={[s.objRow, selectedObj === i && s.objRowActive]} onPress={() => setSelectedObj(i)}>
                <View style={[s.objIcon, selectedObj === i && s.objIconActive]}><Text style={s.objEmojiPost}>{o.emoji}</Text></View>
                <View style={s.objInfoPost}>
                  <Text style={s.objNamePost}>{o.name}</Text>
                  <Text style={s.objProgressPost}>{o.current} {o.unit} sur {o.max}</Text>
                  <View style={s.miniBar}><View style={[s.miniBarFill, { width: `${o.progress}%` as any }]} /></View>
                </View>
                <View style={[s.checkCircle, selectedObj === i && s.checkCircleActive]}>
                  {selectedObj === i && <Text style={s.checkText}>✓</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {step === 1 && (
          <View>
            <Text style={s.sectionLabel}>PHOTO DE PROGRESSION</Text>
            <TouchableOpacity style={s.photoZone}>
              <Text style={s.photoIcon}>📷</Text>
              <Text style={s.photoText}>Prends une photo ou importe</Text>
            </TouchableOpacity>
            <Text style={s.sectionLabel}>PROGRESSION AUJOURD'HUI</Text>
            <View style={s.progressBlock}>
              <View style={s.progressHeader}>
                <Text style={s.progressObjName}>{obj.name}</Text>
                <Text style={s.progressValue}>{Math.round((progress / 100) * obj.max * 10) / 10} {obj.unit}</Text>
              </View>
              <View style={s.sliderTrack}><View style={[s.sliderFill, { width: `${progress}%` as any }]} /></View>
              <View style={s.sliderLabels}><Text style={s.sliderLabel}>0</Text><Text style={s.sliderLabel}>{obj.max} {obj.unit}</Text></View>
              <View style={s.sliderBtns}>
                <TouchableOpacity style={s.sliderBtn} onPress={() => setProgress(p => Math.max(0, p - 5))}><Text style={s.sliderBtnText}>−</Text></TouchableOpacity>
                <Text style={s.sliderPct}>{progress}%</Text>
                <TouchableOpacity style={s.sliderBtn} onPress={() => setProgress(p => Math.min(100, p + 5))}><Text style={s.sliderBtnText}>+</Text></TouchableOpacity>
              </View>
            </View>
            <Text style={s.sectionLabel}>CAPTION</Text>
            <TextInput style={s.captionInput} placeholder="Décris ta progression..." placeholderTextColor="#3a3a3a" value={caption} onChangeText={setCaption} multiline />
          </View>
        )}
        {step === 2 && (
          <View>
            <Text style={s.sectionLabel}>VISIBILITÉ</Text>
            <View style={s.visToggle}>
              {[{ key: 'public', label: '🌍 Public' }, { key: 'friends', label: '👥 Amis' }, { key: 'private', label: '🔒 Privé' }].map(v => (
                <TouchableOpacity key={v.key} style={[s.visOpt, visibility === v.key && s.visOptActive]} onPress={() => setVisibility(v.key)}>
                  <Text style={[s.visOptText, visibility === v.key && s.visOptTextActive]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.sectionLabel}>RÉCAPITULATIF</Text>
            <View style={s.recap}>
              <View style={s.recapRow}><Text style={s.recapKey}>Objectif</Text><Text style={s.recapVal}>{obj.emoji} {obj.name}</Text></View>
              <View style={s.recapDivider} />
              <View style={s.recapRow}><Text style={s.recapKey}>Progression</Text><Text style={s.recapVal}>{Math.round((progress / 100) * obj.max * 10) / 10} {obj.unit} ({progress}%)</Text></View>
              <View style={s.recapDivider} />
              <View style={s.recapRow}><Text style={s.recapKey}>Visibilité</Text><Text style={s.recapVal}>{visibility === 'public' ? '🌍 Public' : visibility === 'friends' ? '👥 Amis' : '🔒 Privé'}</Text></View>
              <View style={s.recapDivider} />
              <View style={s.recapRow}><Text style={s.recapKey}>Streak</Text><Text style={s.recapVal}>🔥 8 jours d'affilée</Text></View>
            </View>
          </View>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
      <View style={s.ctaContainer}>
        <TouchableOpacity style={s.cta} onPress={() => step < 2 ? setStep(st => st + 1) : onPublish()}>
          <Text style={s.ctaText}>{step === 2 ? 'Publier ma mise à jour 🚀' : 'Continuer →'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  btn: { width: '100%', backgroundColor: '#fff', padding: 15, borderRadius: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#1e1e1e' },
  btnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  btnTextDisabled: { color: '#444' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#333' },
  dotActive: { width: 20, backgroundColor: '#fff' },
  splashContainer: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  splashLogo: { width: 260, height: 90, marginBottom: 12 },
  splashTagline: { fontSize: 10, color: '#555', letterSpacing: 3 },
  splashBottom: { position: 'absolute', bottom: 48, left: 28, right: 28 },
  splashLogin: { fontSize: 12, color: '#555', textAlign: 'center', marginTop: 14 },
  splashLoginLink: { color: '#fff', fontWeight: '700' },
  obContainer: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 24 },
  screen: { flex: 1 },
  eyebrow: { fontSize: 11, color: '#555', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  headline: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 8, lineHeight: 28 },
  subtext: { fontSize: 13, color: '#888', lineHeight: 20, marginBottom: 20 },
  cards: { gap: 8, marginBottom: 24 },
  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e1e', padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardEmoji: { fontSize: 20, marginTop: 2 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#fff', marginBottom: 3 },
  cardDesc: { fontSize: 12, color: '#666', lineHeight: 17 },
  pillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 100, backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#222' },
  pillActive: { backgroundColor: '#fff', borderColor: '#fff' },
  pillEmoji: { fontSize: 13 },
  pillText: { fontSize: 12, fontWeight: '700', color: '#888' },
  pillTextActive: { color: '#000' },
  inputBlock: { marginBottom: 12 },
  inputLabel: { fontSize: 10, color: '#555', letterSpacing: 1.5, fontWeight: '700', marginBottom: 6 },
  inputField: { backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 14, padding: 14, fontSize: 14, color: '#fff' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#222' },
  dividerText: { fontSize: 12, color: '#555' },
  appleBtn: { backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 14, padding: 14, alignItems: 'center' },
  appleBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  obBackBtn: { paddingVertical: 14, alignItems: 'center' },
  obBackText: { fontSize: 13, color: '#555' },
  legal: { fontSize: 11, color: '#444', textAlign: 'center', marginTop: 12 },
  legalLink: { color: '#888', fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  headerLogo: { width: 80, height: 28 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakBadge: { backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#2a2a2a' },
  streakText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 14 },
  friendsBar: { paddingHorizontal: 16, paddingVertical: 8, flexGrow: 0 },
  friendItem: { alignItems: 'center', marginRight: 14 },
  friendAv: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  friendAvActive: { backgroundColor: '#2a2a2a', borderWidth: 2, borderColor: '#fff' },
  friendAvInactive: { backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#2a2a2a' },
  friendAvText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  friendName: { fontSize: 10, color: '#555', fontWeight: '600' },
  friendNameActive: { color: '#888' },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tab: { fontSize: 12, fontWeight: '700', color: '#555' },
  tabActive: { color: '#fff' },
  tabUnderline: { position: 'absolute', bottom: 0, height: 2, width: '80%', backgroundColor: '#fff', borderRadius: 1 },
  feed: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  myUpdate: { backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#fff', borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  myAv: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  myAvText: { fontSize: 14, fontWeight: '800', color: '#000' },
  myUpdateInfo: { flex: 1 },
  myUpdateTitle: { fontSize: 13, fontWeight: '700', color: '#fff' },
  myUpdateSub: { fontSize: 11, color: '#888', marginTop: 2 },
  streakInline: { color: '#fff', fontWeight: '700' },
  postedBadge: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  postedBadgeText: { fontSize: 10, fontWeight: '800', color: '#000' },
  feedCard: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 20, marginBottom: 12, overflow: 'hidden' },
  feedCardPrivate: { borderColor: '#333' },
  privBadge: { position: 'absolute', top: 0, left: 16, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, zIndex: 1 },
  privBadgeText: { fontSize: 9, fontWeight: '800', color: '#000' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 0 },
  av: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  cardMeta: { flex: 1 },
  cardName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  cardTime: { fontSize: 11, color: '#555', marginTop: 1 },
  goalRow: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  goalPill: { backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#2a2a2a' },
  goalPillText: { fontSize: 11, color: '#888', fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  progressBg: { flex: 1, height: 3, backgroundColor: '#222', borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
  progressLabel: { fontSize: 11, fontWeight: '700', color: '#666' },
  photoPlaceholder: { marginHorizontal: 14, marginBottom: 10, backgroundColor: '#1a1a1a', borderRadius: 14, height: 90, alignItems: 'center', justifyContent: 'center' },
  photoCaption: { fontSize: 11, color: '#555', fontWeight: '500' },
  reactionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
  rxn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#252525' },
  rxnActive: { backgroundColor: '#252525', borderColor: '#333' },
  rxnEmoji: { fontSize: 12 },
  rxnCount: { fontSize: 12, color: '#666', fontWeight: '700' },
  commentsLink: { fontSize: 12, color: '#444', marginLeft: 'auto' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statPill: { flex: 1, backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 14, padding: 12, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900', color: '#fff' },
  statLbl: { fontSize: 10, color: '#555', fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  objCard: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 20, padding: 14, marginBottom: 12 },
  objCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  objIconBox: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  objEmoji: { fontSize: 20 },
  objCardInfo: { flex: 1 },
  objCardName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  objCardSub: { fontSize: 11, color: '#555', marginTop: 2 },
  visBadge: { backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#2a2a2a' },
  visBadgePublic: { backgroundColor: '#fff', borderColor: '#fff' },
  visText: { fontSize: 10, fontWeight: '700', color: '#555' },
  visTextPublic: { color: '#000' },
  objProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  updateBtn: { backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 10, alignItems: 'center' },
  updateBtnText: { fontSize: 13, fontWeight: '700', color: '#888' },
  addObjBtn: { borderWidth: 1.5, borderColor: '#222', borderRadius: 20, padding: 16, alignItems: 'center', marginBottom: 12 },
  addObjBtnText: { fontSize: 14, fontWeight: '700', color: '#555' },
  searchBar: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  searchIcon: { fontSize: 14 },
  searchPlaceholder: { fontSize: 14, color: '#444' },
  sectionTitle: { fontSize: 11, color: '#555', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  friendRow: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  friendRowAv: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1e1e1e', borderWidth: 2, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  friendRowAvActive: { borderColor: '#fff' },
  friendRowAvText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  friendRowInfo: { flex: 1 },
  friendRowName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  friendRowSub: { fontSize: 12, color: '#555', marginTop: 2 },
  friendStreakBadge: { backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#2a2a2a' },
  friendStreakText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  nudgeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  nudgeBtnText: { fontSize: 18 },
  inviteBtn: { borderWidth: 1.5, borderColor: '#222', borderRadius: 18, padding: 14, alignItems: 'center', marginTop: 4 },
  inviteBtnText: { fontSize: 14, fontWeight: '700', color: '#555' },
  fab: { position: 'absolute', bottom: 80, right: 16, width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  fabText: { fontSize: 28, color: '#000', fontWeight: '300', lineHeight: 34 },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 64, backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#141414', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  navItem: { alignItems: 'center', padding: 8 },
  navIcon: { fontSize: 22, color: '#444' },
  navIconActive: { color: '#fff' },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff', marginTop: 3 },
  navPostBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  navPostBtnText: { fontSize: 24, color: '#000', fontWeight: '300', lineHeight: 30 },
  content: { flex: 1, paddingHorizontal: 20 },
  stepIndicator: { fontSize: 12, color: '#555' },
  sectionLabel: { fontSize: 10, color: '#555', letterSpacing: 1.5, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10, marginTop: 16 },
  objRow: { backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#222', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  objRowActive: { borderColor: '#fff', backgroundColor: '#1a1a1a' },
  objIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  objIconActive: { backgroundColor: '#fff', borderColor: '#fff' },
  objEmojiPost: { fontSize: 20 },
  objInfoPost: { flex: 1 },
  objNamePost: { fontSize: 14, fontWeight: '700', color: '#fff' },
  objProgressPost: { fontSize: 12, color: '#555', marginTop: 2 },
  miniBar: { height: 3, backgroundColor: '#222', borderRadius: 2, marginTop: 6 },
  miniBarFill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#333' },
  checkCircleActive: { backgroundColor: '#fff', borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  checkText: { fontSize: 12, color: '#000', fontWeight: '800' },
  photoZone: { backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 18, height: 160, alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 },
  photoIcon: { fontSize: 32 },
  photoText: { fontSize: 13, color: '#555', fontWeight: '600' },
  progressBlock: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 18, padding: 16, marginBottom: 4 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  progressObjName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  progressValue: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  sliderTrack: { height: 4, backgroundColor: '#222', borderRadius: 2, marginBottom: 6 },
  sliderFill: { height: 4, backgroundColor: '#fff', borderRadius: 2 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { fontSize: 10, color: '#444' },
  sliderBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 14 },
  sliderBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  sliderBtnText: { fontSize: 22, color: '#fff', fontWeight: '300' },
  sliderPct: { fontSize: 18, fontWeight: '900', color: '#fff', minWidth: 60, textAlign: 'center' },
  captionInput: { backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#222', borderRadius: 16, padding: 14, fontSize: 14, color: '#fff', minHeight: 80, textAlignVertical: 'top' },
  visToggle: { flexDirection: 'row', backgroundColor: '#141414', borderWidth: 1, borderColor: '#222', borderRadius: 18, overflow: 'hidden', marginBottom: 4 },
  visOpt: { flex: 1, paddingVertical: 12, alignItems: 'center', margin: 4, borderRadius: 14 },
  visOptActive: { backgroundColor: '#fff' },
  visOptText: { fontSize: 12, fontWeight: '700', color: '#555' },
  visOptTextActive: { color: '#000' },
  recap: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 18, padding: 16 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  recapKey: { fontSize: 13, color: '#555', fontWeight: '600' },
  recapVal: { fontSize: 13, color: '#fff', fontWeight: '700' },
  recapDivider: { height: 1, backgroundColor: '#1e1e1e', marginVertical: 8 },
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, backgroundColor: '#0a0a0a' },
  cta: { width: '100%', backgroundColor: '#fff', padding: 16, borderRadius: 18, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#000' },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: '#888' },
});