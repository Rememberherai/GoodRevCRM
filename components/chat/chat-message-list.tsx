'use client';

import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronRight, Wrench, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/stores/chat';
import type { ToolCallEvent } from '@/stores/chat';

interface ChatMessageListProps {
  messages: ChatMessage[];
  streamingContent: string;
  pendingToolCalls: ToolCallEvent[];
  isStreaming: boolean;
}

export function ChatMessageList({ messages, streamingContent, pendingToolCalls, isStreaming }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, pendingToolCalls]);

  return (
    <ScrollArea className="flex-1 px-4">
      <div className="space-y-4 py-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Ask me anything about your CRM data.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              I can search, create, update, and manage your organizations, contacts, and more.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Show pending tool calls */}
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
    // If this is a tool_calls-only message (no text content), show tool calls inline
    if (message.tool_calls && message.tool_calls.length > 0 && !message.content) {
      return null; // Tool calls are shown via ToolCallCard already
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
    return null; // Tool results are shown via ToolCallCard
  }

  return null;
}

function ToolCallCard({ toolCall }: { toolCall: ToolCallEvent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex gap-2">
      <div className="shrink-0 mt-1">
        <div className="h-6 w-6 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <Wrench className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
        </div>
      </div>
      <div className="flex-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className="font-mono">{toolCall.name}</span>
          {toolCall.status === 'pending' && (
            <span className="ml-1 h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
          )}
          {toolCall.status === 'complete' && (
            <span className="text-green-600 dark:text-green-400 ml-1">done</span>
          )}
          {toolCall.status === 'error' && (
            <span className="text-red-600 dark:text-red-400 ml-1">error</span>
          )}
        </button>
        {expanded && (
          <div className="mt-1 space-y-1">
            <pre className={cn(
              "text-xs bg-muted rounded p-2 overflow-x-auto max-h-32",
              "whitespace-pre-wrap break-words"
            )}>
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
            {toolCall.result && (
              <pre className={cn(
                "text-xs bg-muted rounded p-2 overflow-x-auto max-h-48",
                "whitespace-pre-wrap break-words"
              )}>
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(toolCall.result), null, 2);
                  } catch {
                    return toolCall.result;
                  }
                })()}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
