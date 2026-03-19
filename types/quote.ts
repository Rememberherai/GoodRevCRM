import type { Database } from './database';

export type Quote = Database['public']['Tables']['quotes']['Row'];
export type QuoteInsert = Database['public']['Tables']['quotes']['Insert'];
export type QuoteUpdate = Database['public']['Tables']['quotes']['Update'];

export type QuoteLineItem = Database['public']['Tables']['quote_line_items']['Row'];
export type QuoteLineItemInsert = Database['public']['Tables']['quote_line_items']['Insert'];
export type QuoteLineItemUpdate = Database['public']['Tables']['quote_line_items']['Update'];

export type QuoteStatus = Database['public']['Enums']['quote_status'];

export interface QuoteWithLineItems extends Quote {
  line_items: QuoteLineItem[];
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  expired: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
};

export interface AcceptQuoteResult {
  accepted_quote_id: string;
  accepted_quote_prev_status: string;
  auto_rejected_quote_ids: string[];
}
