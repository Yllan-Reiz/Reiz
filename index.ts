import { registerRootComponent } from 'expo';

import App from './App';
import { syncDirection, reloadApp } from './src/i18n';

// Hébreu : l'écriture de droite à gauche ne bascule qu'au démarrage. Si le sens enregistré ne correspond pas
// à la langue (premier lancement, langue changée dans iOS), on relance une fois.
if (syncDirection()) setTimeout(reloadApp, 0);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
