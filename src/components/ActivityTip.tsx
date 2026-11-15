import { View, Text, TouchableOpacity } from 'react-native';
import { GlassCard } from './GlassSurface';
import { track } from '../lib/track';
import { F } from '../styles';
import { t, type TKey } from '../i18n';

// « Le savais-tu ? » dans l'Activité (15/11/2026, demande de Yllan) : un jour sur deux, à la place de « Ton cercle
// cette semaine », une astuce sur une fonction que beaucoup ne connaissent pas (la séance à deux, le cercle proche,
// le lien d'invitation...). Une seule astuce par jour, la même toute la journée, dans l'ordre de la liste.
// N'y mettre que des fonctions allumées (voir lib/features.ts) : pas les défis ni les badges tant qu'ils sont rangés.

export type TipAction = 'post' | 'friends';
type Tip = { key: string; title: TKey; text: TKey; cta?: TKey; action?: TipAction };

const TIPS: Tip[] = [
  { key: 'duo', title: 'tips.duoTitle', text: 'tips.duoText', cta: 'tips.duoCta', action: 'post' },
  { key: 'invite', title: 'tips.inviteTitle', text: 'tips.inviteText', cta: 'tips.inviteCta', action: 'friends' },
  { key: 'close', title: 'tips.closeTitle', text: 'tips.closeText' },
  { key: 'journey', title: 'tips.journeyTitle', text: 'tips.journeyText' },
  { key: 'reactions', title: 'tips.reactionsTitle', text: 'tips.reactionsText' },
];

const dayNumber = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / (24 * 3600 * 1000));

/** L'astuce du jour, ou null les jours où « Ton cercle cette semaine » garde sa place (un jour sur deux). */
export function tipOfTheDay(): Tip | null {
  const d = dayNumber();
  return d % 2 === 0 ? null : TIPS[Math.floor(d / 2) % TIPS.length];
}

export function ActivityTip({ tip, onAction }: { tip: Tip; onAction?: (a: TipAction) => void }) {
  const can = !!tip.cta && !!tip.action && !!onAction;
  return (
    <GlassCard radius={28} style={{ marginBottom: 14 }}>
      <View style={{ padding: 18 }}>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>{t('tips.label')}</Text>
        <Text style={{ color: '#fff', fontSize: 22, lineHeight: 26, fontFamily: F.black, letterSpacing: -0.6, marginTop: 8 }} maxFontSizeMultiplier={1.3}>{t(tip.title)}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14.5, lineHeight: 21, fontFamily: F.regular, marginTop: 6 }}>{t(tip.text)}</Text>
        {can && (
          <TouchableOpacity onPress={() => { track('tip_tap', { tip: tip.key }, 'activity'); onAction!(tip.action!); }} activeOpacity={0.85} accessibilityRole="button"
            style={{ alignSelf: 'flex-start', height: 44, borderRadius: 16, paddingHorizontal: 18, marginTop: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }} maxFontSizeMultiplier={1.3}>{t(tip.cta!)}</Text>
          </TouchableOpacity>
        )}
      </View>
    </GlassCard>
  );
}
