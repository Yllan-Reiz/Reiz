// Copie supabase/functions/_shared/texts.ts dans chaque fonction qui l'importe (./texts.ts) :
// le déploiement d'une fonction n'emporte que son propre dossier. Lancer après chaque modification des textes :
//   node supabase/functions/sync-texts.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(root, '_shared', 'texts.ts'), 'utf8');
const header = '// COPIE de supabase/functions/_shared/texts.ts : ne pas modifier ici (node supabase/functions/sync-texts.mjs).\n';
for (const fn of readdirSync(root, { withFileTypes: true })) {
  if (!fn.isDirectory() || fn.name.startsWith('_')) continue;
  const index = join(root, fn.name, 'index.ts');
  if (!existsSync(index) || !readFileSync(index, 'utf8').includes("from './texts.ts'")) continue;
  writeFileSync(join(root, fn.name, 'texts.ts'), header + source);
  console.log('texts.ts copié dans', fn.name);
}
