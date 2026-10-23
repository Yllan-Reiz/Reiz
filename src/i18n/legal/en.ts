import type { LegalDoc, LegalCtx } from './types';

// English translation of i18n/legal/fr.ts. The French version prevails (said at the top of each document).
const NOTE = 'This is a translation provided for convenience. In case of any difference, the French version prevails.';

export const legalEn = ({ withContacts, email }: LegalCtx): LegalDoc[] => [
  {
    id: 'cgu',
    title: 'Terms of use',
    updated: 'October 3, 2026',
    intro: NOTE,
    sections: [
      { h: '1. Purpose', p: ['Reiz is a mobile app for tracking personal goals and sharing progress within a circle of friends, published by Yllan Karsenty. By creating an account, you accept these terms.'] },
      { h: '2. Account', list: [
        'You must be at least 15 years old (or have the consent of a parent or guardian).',
        'You are responsible for keeping your password confidential and for the activity on your account.',
        'One person = one account. The information you provide must be accurate.',
      ] },
      { h: '3. Your content', p: ['You remain the owner of what you post (photos, videos, texts, goals). You only grant us the technical license needed to host it and show it to the people allowed by your visibility settings. Deleting your content or your account ends this license.'] },
      { h: '4. Prohibited behavior', list: [
        "Posting illegal, hateful, violent or sexually explicit content, or content that infringes other people's rights.",
        "Harassing others, impersonating someone, or collecting other users' data.",
        'Disrupting the service (spam, unauthorized access, reverse engineering).',
      ] },
      { h: '5. Moderation', p: [`Every post and every comment can be reported, and every user can be blocked from the app. Reports are reviewed and may lead to the content being removed or the account being suspended. For an urgent issue: ${email}.`] },
      { h: '6. Deleting your account', p: ['You can delete your account at any time from Settings, then "Delete my account". This is immediate and cannot be undone.'] },
      { h: '7. Liability', p: ['Reiz is provided "as is", in its launch phase. We do our best to keep the service available but cannot guarantee it will be free of interruptions or errors. Reiz is a motivation tool: it provides no medical, sports or financial advice. Listen to your body and train in safe conditions.'] },
      { h: '8. Personal data', p: ['How your data is processed is described in the Privacy policy.'] },
      { h: '9. Governing law', p: ['These terms are governed by French law. Any dispute will be brought before the competent French courts, after an attempt to find an amicable solution.'] },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy policy',
    updated: withContacts ? 'October 22, 2026' : 'October 3, 2026',
    intro: NOTE,
    sections: [
      { h: '1. Who are we?', p: [`Reiz is a mobile app published by Yllan Karsenty ("we"). It lets you track your personal goals and share your progress with a circle of friends. For any question about your data: ${email}.`] },
      { h: '2. Data we collect', list: [
        'Account data: email address, first name, username, password (encrypted, never readable by us). If you sign in with Apple or Google, we receive your email and first name from that service.',
        'Content you post: goals, progress, photos, videos (with their sound), captions, comments, reactions, profile photo, bio, profile tags and chosen sport.',
        'Social data: friends list, close circle, friend requests, blocks, reports.',
        'Technical data: your device\'s push notification token (if you accept notifications), technical security logs.',
        'Training places (optional): if you turn on arrival detection, your location is read on your phone to know when you arrive at a place you chose (your gym, your field). The coordinates of these places stay on your phone and are never sent to our servers. Only the event "arrived at <place name>", with the time, is recorded, and visible to your close circle.',
        ...(withContacts ? ['Contacts (optional): if you tap "Find my contacts", your phone asks for access to your address book. Names, emails and numbers stay on your phone. To tell you which of your contacts are already on Reiz, the app computes a fingerprint of each email address (a one-way encrypted version, SHA-256) and only sends these fingerprints to our servers. They compare them with those of Reiz accounts and reply with the matching accounts (first name, username, profile photo), without keeping these fingerprints. Numbers are only used to open Messages with a pre-written invitation: nothing is sent until you tap "Send".'] : []),
      ], p: [withContacts
        ? 'We collect no advertising data and no location outside the "Training places" feature, and we never keep your address book. We sell no data.'
        : 'We collect no contacts, no advertising data, and no location outside the optional feature above. We sell no data.'] },
      { h: '3. Why (legal bases)', list: [
        'Providing the service (performance of the contract): account, feed, friends, posting.',
        'Push notifications (consent): you can refuse or turn them off at any time in your phone settings.',
        'Security and moderation (legitimate interest): handling reports, preventing abuse.',
        'Location and alert to your close circle (consent): you turn the feature on yourself, after an explanation. You can turn it off at any time in Settings, "Notify my close circle", or in your iPhone\'s location settings.',
        ...(withContacts ? ['Finding your contacts (consent): you start the feature yourself, and access to the address book is requested by your phone at that moment. You can withdraw it at any time in your iPhone settings, under Reiz, Contacts.'] : []),
      ] },
      { h: '4. Where is your data stored?', p: ['Your data is hosted by Supabase on servers located in the European Union (Stockholm, Sweden). Supabase acts as a processor within the meaning of the GDPR. If you accept notifications, they are sent through Expo\'s notification service and then through Apple or Google, which receive your device token and the text of the notification.'] },
      { h: '5. Who sees your content?', p: ['Your progress is visible according to the visibility you choose for each goal: My circle (your friends), Close circle (the friends you chose) or Only me. Your first name, username, profile photo, bio and sport are visible to signed-in users (friend search). Your sport and profile tags also let people who do the same sport find you; you can remove your sport from your profile. "I\'m at the gym" alerts are only visible to your close circle. If you share an image of your progress on Instagram, you decide to post it: Reiz never posts anything on your behalf.' + (withContacts ? ' If someone has your email address in their contacts and uses "Find my contacts", they can see that you are on Reiz, with your first name, username and profile photo. Blocked users, in either direction, do not appear in these results, and an account created with Apple\'s "Hide My Email" cannot be found this way. You can also refuse to be found this way: Settings, Privacy, "Suggest me to my contacts".' : '')] },
      { h: '6. How long?', p: ['Your data is kept as long as your account exists. Deleting your account (Settings, then "Delete my account") immediately and permanently erases your account, posts, photos, videos, goals and friend connections.' + (withContacts ? ' The email fingerprints sent to find your contacts are not kept.' : '')] },
      { h: '7. Your rights (GDPR)', p: [`You have the rights of access, rectification, erasure, portability, restriction and objection. You can exercise them directly in the app (editing your profile, "Export my data", deleting your account) or by writing to ${email}. You can also contact the CNIL (cnil.fr), the French data protection authority.`] },
      { h: '8. Minors', p: ['Reiz is for people aged 15 and over. If you are under 15, the consent of a parent or guardian is required.'] },
      { h: '9. Changes', p: ['This policy may change. The date at the top shows the latest version; in case of a significant change, we will let you know in the app.'] },
    ],
  },
  {
    id: 'rules',
    title: 'Community guidelines',
    updated: 'October 3, 2026',
    intro: 'Reiz is built on trust: your circle watches you, and you watch theirs. To keep it a place that makes you want to push yourself, here is what we expect from everyone.\n\n' + NOTE,
    sections: [
      { h: 'What we encourage', list: [
        'Posting real proof of your progress, even small.',
        'Encouraging others: a sincere reaction or comment makes a difference.',
        "Respecting everyone's pace: we compare effort, not performance.",
      ] },
      { h: 'What is not accepted', list: [
        'Mockery, harassment, pressure or body shaming.',
        'Sexual, violent, hateful or discriminatory content.',
        'Fake content, impersonation, spam.',
        'Challenges or advice that are dangerous to health (deprivation, doping, overtraining).',
        "Posting someone's photo or video without their consent.",
      ] },
      { h: 'If something is wrong', list: [
        'Report a post or a comment with the "…" menu or a long press.',
        "Block a user from their profile: they won't see your posts anymore, nor you theirs.",
        `For an urgent issue, write to us: ${email}.`,
      ], p: ['Reports are reviewed. Depending on severity, we may remove content or suspend an account.'] },
      { h: 'Your safety', p: ['Reiz does not replace a coach or a doctor. If you feel pain or discomfort, stop. Never share your address or personal information in a comment.'] },
    ],
  },
];
