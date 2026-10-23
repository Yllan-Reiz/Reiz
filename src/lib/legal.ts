// Textes légaux lisibles dans l'app (Réglages > Légal), dans la langue de l'app. Le texte de chaque langue est
// dans i18n/legal/ ; la version française fait foi (les traductions le rappellent en tête de document).
// Aucun lien externe n'est nécessaire pour les lire : tout est dans l'application.

import { contactsAvailable } from './contacts';
import { lang } from '../i18n';
import { legalFr } from '../i18n/legal/fr';
import { legalEn } from '../i18n/legal/en';
import { legalEs } from '../i18n/legal/es';
import { legalHe } from '../i18n/legal/he';
import type { LegalDoc } from '../i18n/legal/types';

export type { LegalDoc, LegalSection } from '../i18n/legal/types';

export const SUPPORT_EMAIL = 'reizapp.contact@gmail.com';

// Les passages « Contacts » de la politique ne s'affichent que dans une version de l'app qui embarque vraiment
// la fonction (module natif expo-contacts, version 1.1.0). Un ancien build qui reçoit ce texte par mise à jour à
// distance garde l'ancienne politique : elle décrit toujours exactement ce que fait son app.
const WITH_CONTACTS = contactsAvailable();

const BY_LANG = { fr: legalFr, en: legalEn, es: legalEs, he: legalHe };

export const LEGAL_DOCS: LegalDoc[] = BY_LANG[lang()]({ withContacts: WITH_CONTACTS, email: SUPPORT_EMAIL });
