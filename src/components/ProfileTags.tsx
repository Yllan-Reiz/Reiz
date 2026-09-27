import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { s, F } from '../styles';

// Tags du profil : de courtes étiquettes (« 💪 Push day », « 🎯 100 kg au bench »)
// visibles par le cercle. Les amis les valident d'un tap, comme un « moi aussi »
// ou un « je confirme » : c'est une interaction légère, sans avoir à commenter.

type Tag = { id: string; emoji: string | null; label: string; tag_endorsements: { user_id: string }[] };

const MAX_TAGS = 6;
const TAG_EMOJIS = ['💪', '🔥', '🏋️', '🏃', '🎯', '⚡', '🧘', '🥇'];

export function ProfileTags({ userId, currentUserId, own }: { userId: string; currentUserId: string | null; own: boolean }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [emoji, setEmoji] = useState(TAG_EMOJIS[0]);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('profile_tags')
      .select('id, emoji, label, tag_endorsements(user_id)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    setTags((data || []) as Tag[]);
    setLoaded(true);
  };
  useEffect(() => { load(); }, [userId]);

  const addTag = async () => {
    const text = label.trim();
    if (!text) return;
    setSaving(true);
    const { error } = await supabase.from('profile_tags').insert({ user_id: userId, emoji, label: text });
    setSaving(false);
    if (error) { Alert.alert('Tags', /6 tags/.test(error.message || '') ? `${MAX_TAGS} tags maximum.` : frError(error)); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setLabel(''); setAdding(false);
    load();
  };

  const removeTag = (t: Tag) => {
    Alert.alert(`Retirer « ${t.label} » ?`, undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: async () => {
        await supabase.from('profile_tags').delete().eq('id', t.id);
        load();
      } },
    ]);
  };

  // Chez un ami : un tap valide le tag (ou retire sa validation).
  const toggleEndorse = async (t: Tag) => {
    if (!currentUserId) return;
    const mine = t.tag_endorsements.some(e => e.user_id === currentUserId);
    Haptics.impactAsync(mine ? Haptics.ImpactFeedbackStyle.Soft : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Mise à jour optimiste, puis resynchronisation.
    setTags(prev => prev.map(x => x.id !== t.id ? x : {
      ...x,
      tag_endorsements: mine
        ? x.tag_endorsements.filter(e => e.user_id !== currentUserId)
        : [...x.tag_endorsements, { user_id: currentUserId }],
    }));
    const { error } = mine
      ? await supabase.from('tag_endorsements').delete().eq('tag_id', t.id).eq('user_id', currentUserId)
      : await supabase.from('tag_endorsements').insert({ tag_id: t.id, user_id: currentUserId });
    if (error && !/duplicate key/i.test(error.message || '')) load();
  };

  if (!loaded) return null;
  if (!own && tags.length === 0) return null;

  return (
    <View>
      <Text style={s.sectionTitle}>TAGS</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tags.map(t => {
          const count = t.tag_endorsements.length;
          const mine = !!currentUserId && t.tag_endorsements.some(e => e.user_id === currentUserId);
          return (
            <TouchableOpacity
              key={t.id}
              activeOpacity={0.75}
              onPress={own ? undefined : () => toggleEndorse(t)}
              onLongPress={own ? () => removeTag(t) : undefined}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18,
                backgroundColor: mine ? '#fff' : '#161616', borderWidth: 1, borderColor: mine ? '#fff' : '#262626',
              }}
              accessibilityLabel={own ? `${t.label}, appui long pour retirer` : `${mine ? 'Retirer ma validation de' : 'Valider'} ${t.label}`}
            >
              {t.emoji ? <Text style={{ fontSize: 14 }}>{t.emoji}</Text> : null}
              <Text style={{ color: mine ? '#000' : '#eee', fontSize: 13, fontFamily: F.semibold }}>{t.label}</Text>
              {count > 0 && (
                <Text style={{ color: mine ? '#555' : '#888', fontSize: 12, fontFamily: F.bold }}>+{count}</Text>
              )}
            </TouchableOpacity>
          );
        })}
        {own && tags.length < MAX_TAGS && !adding && (
          <TouchableOpacity
            onPress={() => setAdding(true)}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed' }}
          >
            <Text style={{ color: '#aaa', fontSize: 13, fontFamily: F.semibold }}>+ Ajouter un tag</Text>
          </TouchableOpacity>
        )}
      </View>

      {own && tags.length === 0 && !adding && (
        <Text style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
          Ton style, ton défi du moment. Ton cercle pourra les valider d'un tap.
        </Text>
      )}
      {own && tags.length > 0 && (
        <Text style={{ color: '#555', fontSize: 11, marginTop: 8 }}>Appui long sur un tag pour le retirer.</Text>
      )}

      {adding && (
        <View style={{ backgroundColor: '#111', borderRadius: 16, padding: 12, marginTop: 10, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {TAG_EMOJIS.map(e => (
              <TouchableOpacity key={e} onPress={() => setEmoji(e)} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: emoji === e ? '#2a2a2a' : 'transparent', borderWidth: 1, borderColor: emoji === e ? '#fff' : '#222' }}>
                <Text style={{ fontSize: 17 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={label}
            onChangeText={setLabel}
            maxLength={24}
            autoFocus
            placeholder="Push day, 100 kg au bench, 6 h du mat..."
            placeholderTextColor="#666"
            style={{ backgroundColor: '#1a1a1a', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 14, fontFamily: F.regular }}
            returnKeyType="done"
            onSubmitEditing={addTag}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={s.profileSaveBtn} onPress={saving ? undefined : addTag}>
              {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.profileSaveBtnText}>Ajouter</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.profileCancelBtn} onPress={() => { setAdding(false); setLabel(''); }}>
              <Text style={s.profileCancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
