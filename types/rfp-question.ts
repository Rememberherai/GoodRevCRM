import type { Database } from './database';

export type RfpQuestion = Database['public']['Tables']['rfp_questions']['Row'];
export type RfpQuestionInsert = Database['public']['Tables']['rfp_questions']['Insert'];
export type RfpQuestionUpdate = Database['public']['Tables']['rfp_questions']['Update'];

export type RfpQuestionStatus = Database['public']['Enums']['rfp_question_status'];

export const RFP_QUESTION_STATUSES: RfpQuestionStatus[] = [
  'unanswered',
  'draft',
  'review',
  'approved',
];

export const QUESTION_STATUS_LABELS: Record<RfpQuestionStatus, string> = {
  unanswered: 'Unanswered',
  draft: 'Draft',
  review: 'In Review',
  approved: 'Approved',
};

export const QUESTION_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type QuestionPriority = (typeof QUESTION_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<QuestionPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export interface RfpQuestionCounts {
  total: number;
  unanswered: number;
  draft: number;
  review: number;
  approved: number;
}
