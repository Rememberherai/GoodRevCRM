'use client';

import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronRight, Wrench, Bot, User, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/stores/chat';
import type { ToolCallEvent } from '@/stores/chat';

// Color map for different tool categories
const TOOL_COLORS: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
  organizations: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', icon: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  people: { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', icon: 'text-violet-600 dark:text-violet-400', badge: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' },
  search: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  opportunities: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', icon: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' },
  tasks: { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', icon: 'text-orange-600 dark:text-orange-400', badge: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' },
  notes: { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', icon: 'text-teal-600 dark:text-teal-400', badge: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300' },
  email: { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', icon: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' },
  tags: { bg: 'bg-pink-50 dark:bg-pink-950/30', border: 'border-pink-200 dark:border-pink-800', icon: 'text-pink-600 dark:text-pink-400', badge: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300' },
  sequences: { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', icon: 'text-cyan-600 dark:text-cyan-400', badge: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300' },
  rfps: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800', icon: 'text-indigo-600 dark:text-indigo-400', badge: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' },
  meetings: { bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30', border: 'border-fuchsia-200 dark:border-fuchsia-800', icon: 'text-fuchsia-600 dark:text-fuchsia-400', badge: 'bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-700 dark:text-fuchsia-300' },
  calls: { bg: 'bg-lime-50 dark:bg-lime-950/30', border: 'border-lime-200 dark:border-lime-800', icon: 'text-lime-600 dark:text-lime-400', badge: 'bg-lime-100 dark:bg-lime-900/50 text-lime-700 dark:text-lime-300' },
  dashboard: { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800', icon: 'text-sky-600 dark:text-sky-400', badge: 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300' },
  automations: { bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800', icon: 'text-yellow-600 dark:text-yellow-400', badge: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' },
  content: { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', icon: 'text-purple-600 dark:text-purple-400', badge: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' },
  news: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: 'text-red-600 dark:text-red-400', badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
  schema: { bg: 'bg-stone-50 dark:bg-stone-950/30', border: 'border-stone-200 dark:border-stone-800', icon: 'text-stone-600 dark:text-stone-400', badge: 'bg-stone-100 dark:bg-stone-900/50 text-stone-700 dark:text-stone-300' },
  webhooks: { bg: 'bg-zinc-50 dark:bg-zinc-950/30', border: 'border-zinc-200 dark:border-zinc-800', icon: 'text-zinc-600 dark:text-zinc-400', badge: 'bg-zinc-100 dark:bg-zinc-900/50 text-zinc-700 dark:text-zinc-300' },
  reports: { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800', icon: 'text-sky-600 dark:text-sky-400', badge: 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300' },
  templates: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', icon: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' },
  activity: { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', icon: 'text-orange-600 dark:text-orange-400', badge: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' },
  research: { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', icon: 'text-violet-600 dark:text-violet-400', badge: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' },
  drafts: { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', icon: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' },
  rfp: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800', icon: 'text-indigo-600 dark:text-indigo-400', badge: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' },
  widgets: { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', icon: 'text-cyan-600 dark:text-cyan-400', badge: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300' },
  members: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', icon: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  invitations: { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', icon: 'text-teal-600 dark:text-teal-400', badge: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300' },
  settings: { bg: 'bg-slate-50 dark:bg-slate-950/30', border: 'border-slate-200 dark:border-slate-800', icon: 'text-slate-600 dark:text-slate-400', badge: 'bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300' },
  duplicates: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  merge: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  enrichment: { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', icon: 'text-purple-600 dark:text-purple-400', badge: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' },
  contacts: { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', icon: 'text-violet-600 dark:text-violet-400', badge: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' },
  sms: { bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', icon: 'text-green-600 dark:text-green-400', badge: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' },
  signatures: { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', icon: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' },
  linkedin: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', icon: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  bulk: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: 'text-red-600 dark:text-red-400', badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
  sequence: { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', icon: 'text-cyan-600 dark:text-cyan-400', badge: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300' },
  secrets: { bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800', icon: 'text-yellow-600 dark:text-yellow-400', badge: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' },
  workflows: { bg: 'bg-slate-50 dark:bg-slate-950/30', border: 'border-slate-200 dark:border-slate-800', icon: 'text-slate-600 dark:text-slate-400', badge: 'bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300' },
  contracts: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  products: { bg: 'bg-lime-50 dark:bg-lime-950/30', border: 'border-lime-200 dark:border-lime-800', icon: 'text-lime-600 dark:text-lime-400', badge: 'bg-lime-100 dark:bg-lime-900/50 text-lime-700 dark:text-lime-300' },
  quotes: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800', icon: 'text-indigo-600 dark:text-indigo-400', badge: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' },
  emails: { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', icon: 'text-orange-600 dark:text-orange-400', badge: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' },
  accounting: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', icon: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' },
  calendar: { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', icon: 'text-teal-600 dark:text-teal-400', badge: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300' },
  dispositions: { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', icon: 'text-purple-600 dark:text-purple-400', badge: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' },
  service_types: { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', icon: 'text-cyan-600 dark:text-cyan-400', badge: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300' },
  contractors: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200' },
  jobs: { bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', icon: 'text-green-700 dark:text-green-300', badge: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' },
  households: { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800', icon: 'text-sky-700 dark:text-sky-300', badge: 'bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200' },
  programs: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800', icon: 'text-indigo-700 dark:text-indigo-300', badge: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200' },
  contributions: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', icon: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200' },
  assets: { bg: 'bg-stone-50 dark:bg-stone-950/30', border: 'border-stone-200 dark:border-stone-800', icon: 'text-stone-700 dark:text-stone-300', badge: 'bg-stone-100 dark:bg-stone-900/50 text-stone-800 dark:text-stone-200' },
  referrals: { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', icon: 'text-orange-700 dark:text-orange-300', badge: 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200' },
  relationships: { bg: 'bg-pink-50 dark:bg-pink-950/30', border: 'border-pink-200 dark:border-pink-800', icon: 'text-pink-700 dark:text-pink-300', badge: 'bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-200' },
  broadcasts: { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', icon: 'text-rose-700 dark:text-rose-300', badge: 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200' },
  receipts: { bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800', icon: 'text-yellow-700 dark:text-yellow-300', badge: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200' },
  grants: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200' },
  census: { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', icon: 'text-teal-700 dark:text-teal-300', badge: 'bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200' },
  bug: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: 'text-red-600 dark:text-red-400', badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
};

const DEFAULT_COLORS = { bg: 'bg-gray-50 dark:bg-gray-950/30', border: 'border-gray-200 dark:border-gray-800', icon: 'text-gray-600 dark:text-gray-400', badge: 'bg-gray-100 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300' };

function normalizeToolName(toolName: string) {
  return toolName.replace(/\./g, '_');
}

function getToolColors(toolName: string) {
  const category = normalizeToolName(toolName).split('_')[0] ?? '';
  return TOOL_COLORS[category] ?? DEFAULT_COLORS;
}

function formatToolName(name: string): string {
  const normalized = normalizeToolName(name);
  // organizations_list → Organizations > List
  const parts = normalized.split('_');
  if (parts.length >= 2) {
    const first = parts[0] ?? '';
    const category = first.charAt(0).toUpperCase() + first.slice(1);
    const action = parts.slice(1).join(' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return `${category} > ${action}`;
  }
  return name;
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  streamingContent: string;
  pendingToolCalls: ToolCallEvent[];
  completedToolCalls: ToolCallEvent[];
  isStreaming: boolean;
}

export function ChatMessageList({ messages, streamingContent, pendingToolCalls, completedToolCalls, isStreaming }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, pendingToolCalls, completedToolCalls]);

  return (
    <ScrollArea className="flex-1 px-4 overflow-hidden">
      <div className="space-y-4 py-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Ask me anything about your project data.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              I can use connected project tools and explain what I changed.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Show completed tool calls (persisted after streaming ends) */}
        {completedToolCalls.map((tc) => (
          <ToolCallCard key={`done-${tc.id}`} toolCall={tc} />
        ))}

        {/* Show pending tool calls (active during streaming) */}
        {pendingToolCalls.map((tc) => (
          <ToolCallCard key={tc.id} toolCall={tc} />
        ))}

        {/* Show streaming content */}
        {streamingContent && (
          <div className="flex gap-2">
            <div className="shrink-0 mt-1">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
            <div className="flex-1 text-sm whitespace-pre-wrap">{streamingContent}<span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" /></div>
          </div>
        )}

        {/* Loading indicator when streaming but no content yet */}
        {isStreaming && !streamingContent && pendingToolCalls.length === 0 && (
          <div className="flex gap-2">
            <div className="shrink-0 mt-1">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-1 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="flex gap-2 max-w-[85%]">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3 py-2 text-sm whitespace-pre-wrap">
            {message.content}
          </div>
          <div className="shrink-0 mt-1">
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (message.role === 'assistant') {
    if (message.tool_calls && message.tool_calls.length > 0 && !message.content) {
      return null;
    }

    return (
      <div className="flex gap-2">
        <div className="shrink-0 mt-1">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>
        <div className="flex-1 text-sm whitespace-pre-wrap max-w-[85%]">{message.content}</div>
      </div>
    );
  }

  if (message.role === 'tool') {
    return null;
  }

  return null;
}

function ToolCallCard({ toolCall }: { toolCall: ToolCallEvent }) {
  const [expanded, setExpanded] = useState(false);
  const colors = getToolColors(toolCall.name);

  return (
    <div className={cn('rounded-lg border p-2.5 transition-all', colors.bg, colors.border)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <div className={cn('h-5 w-5 rounded flex items-center justify-center shrink-0', colors.badge)}>
          <Wrench className={cn('h-3 w-3', colors.icon)} />
        </div>
        <span className={cn('text-xs font-medium flex-1', colors.icon)}>
          {formatToolName(toolCall.name)}
        </span>
        <div className="flex items-center gap-1.5">
          {toolCall.status === 'pending' && (
            <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />
          )}
          {toolCall.status === 'complete' && (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          )}
          {toolCall.status === 'error' && (
            <XCircle className="h-3.5 w-3.5 text-red-500" />
          )}
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          <div className="text-[10px] uppercase font-medium text-muted-foreground tracking-wider">Arguments</div>
          <pre className={cn(
            "text-xs rounded p-2 overflow-x-auto max-h-32 bg-background/50 border",
            "whitespace-pre-wrap break-words", colors.border
          )}>
            {JSON.stringify(toolCall.arguments, null, 2)}
          </pre>
          {toolCall.result && (
            <>
              <div className="text-[10px] uppercase font-medium text-muted-foreground tracking-wider">Result</div>
              <pre className={cn(
                "text-xs rounded p-2 overflow-x-auto max-h-48 bg-background/50 border",
                "whitespace-pre-wrap break-words", colors.border
              )}>
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(toolCall.result), null, 2);
                  } catch {
                    return toolCall.result;
                  }
                })()}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
