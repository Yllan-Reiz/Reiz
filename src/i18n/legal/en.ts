import type { LegalDoc, LegalCtx } from './types';
import { legalFr } from './fr';

// Provisoire : traduction à écrire.
export const legalEn = (ctx: LegalCtx): LegalDoc[] => legalFr(ctx);
