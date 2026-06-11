export type Update = { id: string; caption: string; progress_value: number; created_at: string; photo_url?: string; user_id?: string; objectives?: { visibility: string } | null; users: any; };
export type Objective = { id: string; emoji: string; title: string; current_value: number; target_value: number; unit: string; visibility: string; duration_days?: number | null; };
export type Comment = { id: string; content: string; created_at: string; users: any; };
export type Friend = { id: string; full_name: string; username: string; friendship_id: string; status: string; is_requester: boolean; avatar_url?: string | null; };
export type PendingRequest = { id: string; full_name: string; username: string; friendship_id: string; avatar_url?: string | null; };

// Données agrégées d'un post (réactions + commentaires), chargées en lot par le feed
// pour éviter une requête par carte.
export type FeedMeta = { reactions: Record<string, number>; mine: string[]; commentCount: number };
