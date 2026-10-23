// Carte d'Activité en direct (extension « LiveActivity » créée par expo-live-activity) : deux retouches.
//   1. Le dessin : plugins/live-activity/LiveActivityWidget.swift remplace celui de la bibliothèque (maquette de Yllan,
//      jauge qui change de couleur avec le temps restant).
//   2. Le lien : la bibliothèque préfixe le lien avec le schéma qu'elle cherche dans l'Info.plist de l'extension, où il
//      n'est pas, donc aucun lien n'était posé (vérifié dans le simulateur, « WidgetURLPreferenceKey has no url »).
//      plugins/live-activity/View+applyWidgetURL.swift pose reiz://... directement, et on ajoute quand même le schéma
//      à l'Info.plist de l'extension.
const { withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
const plist = require('@expo/plist').default;

const OWN_FILES = ['LiveActivityWidget.swift', 'View+applyWidgetURL.swift'];

module.exports = function withLiveActivityScheme(config) {
  // Même étape que la copie des fichiers de l'extension par expo-live-activity (projet Xcode). Placé AVANT
  // elle dans app.json, ce plugin passe APRÈS elle : les fichiers existent déjà, on les remplace.
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
    for (const name of OWN_FILES) {
      const target = path.join(dir, name);
      if (fs.existsSync(target)) fs.copyFileSync(path.join(cfg.modRequest.projectRoot, 'plugins', 'live-activity', name), target);
    }
    return cfg;
  });
};
