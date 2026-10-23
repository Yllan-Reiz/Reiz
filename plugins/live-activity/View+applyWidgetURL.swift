import SwiftUI

// Copié par plugins/withLiveActivityScheme.js : un lien complet (reiz://...) est pris tel quel, sinon il est
// préfixé par « reiz:// ». La version d'expo-live-activity cherchait le schéma dans l'extension, où il n'est pas.
extension View {
  @ViewBuilder
  func applyWidgetURL(from urlString: String?) -> some View {
    if let string = urlString, let url = URL(string: string.contains("://") ? string : "reiz://" + string) {
      self.widgetURL(url)
    } else {
      self
    }
  }
}
