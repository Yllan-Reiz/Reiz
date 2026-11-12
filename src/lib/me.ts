// Ce que l'app sait de moi et dont plusieurs écrans ont besoin sans le recharger : ma photo (adresse signée) et mon
// prénom. Le fil les range ici dès qu'il les connaît (réaction qui s'envole avec ma photo, par exemple).
let me: { avatar: string | null; name: string | null } = { avatar: null, name: null };
export const setMe = (next: Partial<typeof me>) => { me = { ...me, ...next }; };
export const getMe = () => me;
