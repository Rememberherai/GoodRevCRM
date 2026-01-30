// Dashboard statistics from RPC function
export interface DashboardStatsFromRpc {
  total_people: number;
  total_organizations: number;
  total_opportunities: number;
  total_rfps: number;
  total_tasks: number;
  pending_tasks: number;
  total_pipeline_value: number;
  won_value: number;
  emails_sent: number;
  emails_opened: number;
}

// Dashboard statistics
export interface DashboardStats {
  pipeline: PipelineStats;
  rfps: RfpStats;
  entities: EntityCounts;
  tasks: TaskStats;
  recent_activity: RecentActivity[];
}

export interface PipelineStats {
  total_value: number;
  total_count: number;
  by_stage: StageStats[];
  won_this_month: number;
}

export interface StageStats {
  stage: string;
  count: number;
  value: number;
}

export interface RfpStats {
  total_count: number;
  by_status: { status: string; count: number }[];
  upcoming_deadlines: UpcomingRfp[];
}

export interface UpcomingRfp {
  id: string;
  title: string;
  due_date: string;
  status: string;
}

export interface EntityCounts {
  organizations: number;
  people: number;
  opportunities: number;
  rfps: number;
}

export interface TaskStats {
  pending: number;
  in_progress: number;
  overdue: number;
  due_today: number;
}

export interface RecentActivity {
  type: 'organization' | 'person' | 'opportunity' | 'rfp';
  id: string;
  title: string;
  created_at: string;
}

// Search result
export interface SearchResult {
  entity_type: 'organization' | 'person' | 'opportunity' | 'rfp';
  entity_id: string;
  name: string;
  subtitle: string | null;
  match_field: string;
  relevance: number;
}
