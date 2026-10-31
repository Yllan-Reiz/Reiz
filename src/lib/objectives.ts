// Lecture des objectifs avec leurs jours d'entraînement (colonne `training_days`, ajoutée par
// supabase/phase12). Tant que le SQL n'a pas été exécuté, la colonne n'existe pas et la requête échoue :
// on se replie alors sur l'ancienne liste de colonnes, et l'app marche exactement comme avant.

let daysColumn: boolean | null = null; // null = pas encore su
// Colonnes de la phase 31 (rythme et échéance) : même repli, l'app retombe sur des objectifs « record ».
let goalColumns: boolean | null = null;
export const GOAL_COLUMNS = 'per_week, deadline, starts_at';

type Result = { data: any[] | null; error: { message?: string } | null };

export async function selectObjectives(baseColumns: string, run: (columns: string) => PromiseLike<any>): Promise<Result> {
  if (daysColumn !== false) {
    if (goalColumns !== false) {
      const g = await run(`${baseColumns}, training_days, ${GOAL_COLUMNS}`);
      if (!g.error) { daysColumn = true; goalColumns = true; return g; }
      if (!/per_week|deadline|starts_at|training_days|column/i.test(g.error.message || '')) return g;
      goalColumns = false;
    }
    const r = await run(`${baseColumns}, training_days`);
    if (!r.error) { daysColumn = true; return r; }
    if (!/training_days|column/i.test(r.error.message || '')) return r;
    daysColumn = false;
  }
  return run(baseColumns);
}

/** Vrai tant que la base n'a pas refusé les colonnes de la phase 31. */
export const knowsGoalColumns = () => goalColumns !== false;

/** Vrai quand la base connaît les jours d'entraînement (sert à cacher le réglage tant qu'elle ne les connaît pas). */
export const knowsTrainingDays = () => daysColumn !== false;
