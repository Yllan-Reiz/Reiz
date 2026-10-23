// La carte d'Activité en direct (extension « LiveActivity » créée par expo-live-activity) doit ouvrir l'app
// avec un lien reiz://duo/<id>. La bibliothèque préfixe le lien avec le schéma qu'elle cherche dans l'Info.plist
// de l'extension, où il n'est pas : aucun lien n'était posé (vérifié dans le simulateur, « WidgetURLPreferenceKey
// has no url »). On ajoute le schéma à l'Info.plist de l'extension ET on remplace la fonction qui pose le lien :
// un lien complet (reiz://...) est pris tel quel, sinon il est préfixé par « reiz:// ».
const { withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
const plist = require('@expo/plist').default;

const WIDGET_URL_SWIFT = `import SwiftUI

// Réécrit par plugins/withLiveActivityScheme.js (voir ce fichier).
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
`;

module.exports = function withLiveActivityScheme(config) {
  // Même étape que la copie des fichiers de l'extension par expo-live-activity (projet Xcode). Placé AVANT
  // elle dans app.json, ce plugin passe APRÈS elle : les fichiers existent déjà.
  return withXcodeProject(config, (cfg) => {
    const dir = path.join(cfg.modRequest.platformProjectRoot, 'LiveActivity');
    const file = path.join(dir, 'Info.plist');
    if (!fs.existsSync(file)) return cfg;
    const data = plist.parse(fs.readFileSync(file, 'utf8'));
    const scheme = typeof cfg.scheme === 'string' ? cfg.scheme : 'reiz';
    const types = data.CFBundleURLTypes || [];
    if (!types.some(t => (t.CFBundleURLSchemes || []).includes(scheme))) {
      data.CFBundleURLTypes = [...types, { CFBundleURLSchemes: [scheme] }];
      fs.writeFileSync(file, plist.build(data));
    }
    const swift = path.join(dir, 'View+applyWidgetURL.swift');
    if (fs.existsSync(swift)) fs.writeFileSync(swift, WIDGET_URL_SWIFT);
    return cfg;
  });
};
