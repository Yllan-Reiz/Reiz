// Lecture des objectifs avec leurs jours d'entraînement (colonne `training_days`, ajoutée par
// supabase/phase12). Tant que le SQL n'a pas été exécuté, la colonne n'existe pas et la requête échoue :
// on se replie alors sur l'ancienne liste de colonnes, et l'app marche exactement comme avant.

let daysColumn: boolean | null = null; // null = pas encore su

type Result = { data: any[] | null; error: { message?: string } | null };

export async function selectObjectives(baseColumns: string, run: (columns: string) => PromiseLike<any>): Promise<Result> {
  if (daysColumn !== false) {
    const r = await run(`${baseColumns}, training_days`);
    if (!r.error) { daysColumn = true; return r; }
    if (!/training_days|column/i.test(r.error.message || '')) return r;
    daysColumn = false;
  }
  return run(baseColumns);
}

/** Vrai quand la base connaît les jours d'entraînement (sert à cacher le réglage tant qu'elle ne les connaît pas). */
export const knowsTrainingDays = () => daysColumn !== false;
