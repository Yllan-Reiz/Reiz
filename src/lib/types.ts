export type Update = { id: string; caption: string; progress_value: number; created_at: string; photo_url?: string; user_id?: string; pinned_at?: string | null; with_user_ids?: string[]; with_users?: { id: string; full_name: string; avatar_url?: string | null }[]; objectives?: { visibility: string; unit?: string; target_value?: number; emoji?: string; title?: string } | null; users: any; };
export type Objective = { id: string; emoji: string; title: string; current_value: number; target_value: number; unit: string; visibility: string; duration_days?: number | null; };
export type Comment = { id: string; content: string; created_at: string; user_id: string; parent_id?: string | null; users: any; };

// Ligne du fil d'activité (cœur en haut à droite), écrite par les triggers SQL.
export type ActivityItem = {
  id: string; type: string; created_at: string; read_at: string | null;
  actor_id: string | null; update_id: string | null; comment_id: string | null; objective_id: string | null;
  emoji: string | null; preview: string | null;
  actor: { full_name: string; avatar_url?: string | null } | null;
};
export type Friend = { id: string; full_name: string; username: string; friendship_id: string; status: string; is_requester: boolean; avatar_url?: string | null; };
export type PendingRequest = { id: string; full_name: string; username: string; friendship_id: string; avatar_url?: string | null; };

// Données agrégées d'un post (réactions + commentaires), chargées en lot par le feed
// pour éviter une requête par carte.
// Qui a réagi avec quoi, pour la pile de visages sur la photo (façon BeReal).
export type Reactor = { user_id: string; emoji: string; name: string; avatar_url?: string | null };
export type FeedMeta = { reactions: Record<string, number>; mine: string[]; commentCount: number; reactors?: Reactor[] };
