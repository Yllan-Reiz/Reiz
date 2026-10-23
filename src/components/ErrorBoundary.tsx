import { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { F } from '../styles';
import { t } from '../i18n';

// Filet de sécurité : si un écran plante, on affiche un bouton "Réessayer"
// au lieu d'un écran blanc figé.
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#666" />
          <Text style={{ color: '#fff', fontSize: 18, fontFamily: F.extrabold, textAlign: 'center' }}>{t('errorBoundary.title')}</Text>
          <Text style={{ color: '#999', fontSize: 13, textAlign: 'center', lineHeight: 19 }}>{t('errorBoundary.text')}</Text>
          <TouchableOpacity
            style={{ backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 13, marginTop: 8 }}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
