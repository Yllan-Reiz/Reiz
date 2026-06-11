import { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { F } from '../styles';

// Filet de sécurité : si un écran plante, on affiche un bouton "Réessayer"
// au lieu d'un écran blanc figé.
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <Text style={{ fontSize: 40 }}>😅</Text>
          <Text style={{ color: '#fff', fontSize: 18, fontFamily: F.extrabold, textAlign: 'center' }}>Quelque chose a planté</Text>
          <Text style={{ color: '#999', fontSize: 13, textAlign: 'center', lineHeight: 19 }}>Ce n'est pas toi, c'est nous. Appuie pour relancer.</Text>
          <TouchableOpacity
            style={{ backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 13, marginTop: 8 }}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
