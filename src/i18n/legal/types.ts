export type LegalSection = { h: string; p?: string[]; list?: string[] };
export type LegalDoc = { id: 'cgu' | 'privacy' | 'rules'; title: string; updated: string; intro?: string; sections: LegalSection[] };
// withContacts : la version de l'app embarque « Retrouver mes contacts » (voir lib/legal.ts).
export type LegalCtx = { withContacts: boolean; email: string };
