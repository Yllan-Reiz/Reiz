// Textes légaux lisibles dans l'app (Réglages > Légal). Ils reprennent ceux des pages
// web de landing/ (cgu.html, confidentialite.html) : si tu modifies l'un, modifie l'autre.
// Aucun lien externe n'est nécessaire pour les lire : tout est dans l'application.

export const SUPPORT_EMAIL = 'reizapp.contact@gmail.com';

export type LegalSection = { h: string; p?: string[]; list?: string[] };
export type LegalDoc = { id: 'cgu' | 'privacy' | 'rules'; title: string; updated: string; intro?: string; sections: LegalSection[] };

export const LEGAL_DOCS: LegalDoc[] = [
  {
    id: 'cgu',
    title: "Conditions d'utilisation",
    updated: '3 octobre 2026',
    sections: [
      { h: '1. Objet', p: ["Reiz est une application mobile de suivi d'objectifs personnels et de partage de progression au sein d'un cercle d'amis, éditée par Yllan Karsenty. En créant un compte, tu acceptes les présentes conditions."] },
      { h: '2. Compte', list: [
        "Tu dois avoir au moins 15 ans (ou l'accord d'un parent ou tuteur).",
        "Tu es responsable de la confidentialité de ton mot de passe et de l'activité de ton compte.",
        'Une personne = un compte. Les informations fournies doivent être exactes.',
      ] },
      { h: '3. Ton contenu', p: ["Tu restes propriétaire de ce que tu publies (photos, vidéos, textes, objectifs). Tu nous accordes uniquement la licence technique nécessaire pour l'héberger et l'afficher aux personnes autorisées par tes réglages de visibilité. La suppression de ton contenu ou de ton compte met fin à cette licence."] },
      { h: '4. Comportements interdits', list: [
        "Publier du contenu illégal, haineux, violent, sexuellement explicite, ou portant atteinte aux droits d'autrui.",
        "Harceler, usurper une identité, ou collecter les données d'autres utilisateurs.",
        "Perturber le fonctionnement du service (spam, accès non autorisé, ingénierie inverse).",
      ] },
      { h: '5. Modération', p: [`Chaque publication et chaque commentaire peut être signalé, et chaque utilisateur peut être bloqué depuis l'app. Les signalements sont examinés et peuvent entraîner le retrait du contenu ou la suspension du compte concerné. Pour un problème urgent : ${SUPPORT_EMAIL}.`] },
      { h: '6. Suppression du compte', p: ['Tu peux supprimer ton compte à tout moment depuis Réglages, puis « Supprimer mon compte ». Cette action est immédiate et irréversible.'] },
      { h: '7. Responsabilité', p: ["Reiz est fourni « en l'état », en phase de lancement. Nous faisons de notre mieux pour assurer la disponibilité du service mais ne garantissons pas l'absence d'interruptions ou d'erreurs. Reiz est un outil de motivation : il ne fournit aucun conseil médical, sportif ou financier. Écoute ton corps et entraîne-toi dans des conditions sûres."] },
      { h: '8. Données personnelles', p: ['Le traitement de tes données est décrit dans la Politique de confidentialité.'] },
      { h: '9. Droit applicable', p: ["Les présentes conditions sont régies par le droit français. Tout litige relèvera des tribunaux compétents français, après recherche d'une solution amiable."] },
    ],
  },
  {
    id: 'privacy',
    title: 'Politique de confidentialité',
    updated: '3 octobre 2026',
    sections: [
      { h: '1. Qui sommes-nous ?', p: [`Reiz est une application mobile éditée par Yllan Karsenty (« nous »). Elle permet de suivre ses objectifs personnels et de partager sa progression avec un cercle d'amis. Pour toute question relative à tes données : ${SUPPORT_EMAIL}.`] },
      { h: '2. Données que nous collectons', list: [
        'Données de compte : adresse email, prénom, nom d\'utilisateur, mot de passe (chiffré, jamais lisible par nous). Si tu te connectes avec Apple ou Google, nous recevons ton email et ton prénom depuis ce service.',
        'Contenu que tu publies : objectifs, progression, photos, vidéos (avec leur son), légendes, commentaires, réactions, photo de profil, bio et tags de profil.',
        "Données sociales : liste d'amis, cercle proche, demandes d'amitié, blocages, signalements.",
        "Données techniques : jeton de notification push de ton appareil (si tu acceptes les notifications), journaux techniques de sécurité.",
      ], p: ['Nous ne collectons ni géolocalisation, ni contacts, ni données publicitaires. Nous ne vendons aucune donnée.'] },
      { h: '3. Pourquoi (bases légales)', list: [
        'Fournir le service (exécution du contrat) : compte, fil, amis, publication.',
        'Notifications push (consentement) : tu peux les refuser ou les désactiver à tout moment dans les réglages de ton téléphone.',
        'Sécurité et modération (intérêt légitime) : traitement des signalements, prévention des abus.',
      ] },
      { h: '4. Où sont stockées tes données ?', p: ["Tes données sont hébergées par Supabase sur des serveurs situés dans l'Union européenne (Stockholm, Suède). Supabase agit comme sous-traitant au sens du RGPD. Si tu acceptes les notifications, leur envoi passe par le service de notifications d'Expo puis par Apple ou Google, qui reçoivent le jeton de ton appareil et le texte de la notification."] },
      { h: '5. Qui voit ton contenu ?', p: ["Ta progression est visible selon la visibilité que tu choisis pour chaque objectif : Mon cercle (tes amis), Cercle proche (les amis que tu as choisis) ou Moi seul. Ton prénom, ton nom d'utilisateur, ta photo de profil et ta bio sont visibles des utilisateurs connectés (recherche d'amis). Si tu partages un visuel de ta progression sur Instagram, c'est toi qui décides de le publier : Reiz ne publie jamais rien à ta place."] },
      { h: '6. Combien de temps ?', p: ["Tes données sont conservées tant que ton compte existe. La suppression de ton compte (Réglages, puis « Supprimer mon compte ») efface immédiatement et définitivement ton compte, tes publications, tes photos, tes vidéos, tes objectifs et tes liens d'amitié."] },
      { h: '7. Tes droits (RGPD)', p: [`Tu disposes des droits d'accès, de rectification, d'effacement, de portabilité, de limitation et d'opposition. Tu peux les exercer directement dans l'app (modification du profil, « Exporter mes données », suppression du compte) ou en écrivant à ${SUPPORT_EMAIL}. Tu peux aussi saisir la CNIL (cnil.fr).`] },
      { h: '8. Mineurs', p: ["Reiz est réservé aux personnes de 15 ans et plus. Si tu as moins de 15 ans, l'accord d'un parent ou tuteur est requis."] },
      { h: '9. Modifications', p: ["Cette politique peut évoluer. La date en haut de page indique la dernière version ; en cas de changement important, nous t'en informerons dans l'app."] },
    ],
  },
  {
    id: 'rules',
    title: 'Règles de la communauté',
    updated: '3 octobre 2026',
    intro: "Reiz repose sur la confiance : ton cercle te regarde, et tu regardes le sien. Pour que ça reste un endroit qui donne envie de se dépasser, voici ce qu'on attend de chacun.",
    sections: [
      { h: 'Ce qu\'on encourage', list: [
        'Poster des preuves réelles de ta progression, même petites.',
        'Encourager les autres : une réaction ou un commentaire sincère fait la différence.',
        "Respecter le rythme de chacun : on compare les efforts, pas les performances.",
      ] },
      { h: "Ce qui n'est pas accepté", list: [
        'Moqueries, harcèlement, pression ou body shaming.',
        'Contenu sexuel, violent, haineux ou discriminatoire.',
        "Faux contenus, usurpation d'identité, spam.",
        'Défis ou conseils dangereux pour la santé (privation, dopage, surentraînement).',
        "Publier la photo ou la vidéo d'une personne sans son accord.",
      ] },
      { h: 'Si quelque chose ne va pas', list: [
        "Signale une publication ou un commentaire avec le menu « … » ou par appui long.",
        "Bloque un utilisateur depuis son profil : il ne verra plus tes publications ni toi les siennes.",
        `Pour un problème urgent, écris-nous : ${SUPPORT_EMAIL}.`,
      ], p: ["Les signalements sont examinés. Selon la gravité, nous pouvons retirer un contenu ou suspendre un compte."] },
      { h: 'Ta sécurité', p: ["Reiz ne remplace ni un coach, ni un médecin. Si tu ressens une douleur ou un malaise, arrête-toi. Ne partage jamais ton adresse ni tes informations personnelles dans un commentaire."] },
    ],
  },
];
