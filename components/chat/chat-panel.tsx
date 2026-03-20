'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { X, Plus, MessageSquare, Settings, Trash2, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { ChatSettings } from './chat-settings';
import { useChat } from '@/hooks/use-chat';
import { useChatStore } from '@/stores/chat';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  projectSlug: string;
}

export function ChatPanel({ projectSlug }: ChatPanelProps) {
  const { isOpen, panelWidth, setPanelWidth, close } = useChatStore();
  const {
    messages,
    streamingContent,
    pendingToolCalls,
    completedToolCalls,
    isStreaming,
    conversations,
    error,
    sendMessage,
    loadConversations,
    loadConversation,
    newConversation,
    deleteConversation,
    renameConversation,
    stopStreaming,
  } = useChat(projectSlug);

  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Load conversations on open
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  // Resize handler with cleanup on unmount
  const listenersRef = useRef<{ move: (e: MouseEvent) => void; up: () => void } | null>(null);

  useEffect(() => {
    return () => {
      // Clean up listeners on unmount
      if (listenersRef.current) {
        window.removeEventListener('mousemove', listenersRef.current.move);
        window.removeEventListener('mouseup', listenersRef.current.up);
      }
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startWidth: panelWidth };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startX - e.clientX;
      setPanelWidth(resizeRef.current.startWidth + delta);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
      listenersRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    listenersRef.current = { move: handleMouseMove, up: handleMouseUp };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth, setPanelWidth]);

  if (!isOpen) return null;

  if (showSettings) {
    return (
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-[60] flex animate-in slide-in-from-right duration-300',
          isResizing && 'select-none'
        )}
        style={{ width: panelWidth }}
      >
        {/* Resize handle */}
        <div
          className="w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors shrink-0"
          onMouseDown={handleMouseDown}
        />
        <div className="flex-1 flex flex-col bg-background border-l shadow-xl overflow-hidden">
          <ChatSettings onBack={() => setShowSettings(false)} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-[60] flex animate-in slide-in-from-right duration-300',
        isResizing && 'select-none'
      )}
      style={{ width: panelWidth }}
    >
      {/* Resize handle */}
      <div
        className="w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors shrink-0"
        onMouseDown={handleMouseDown}
      />

      {/* Panel content */}
      <div className="flex-1 flex flex-col bg-background border-l shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">AI Assistant</h2>
          </div>
          <div className="flex items-center gap-1">
            {/* Conversation selector */}
            {conversations.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs h-7">
                    History
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 z-[70]">
                  {conversations.map((conv) => (
                    <DropdownMenuItem
                      key={conv.id}
                      className="flex items-center justify-between gap-2"
                      onSelect={(e) => {
                        if (editingId === conv.id) e.preventDefault();
                      }}
                    >
                      {editingId === conv.id ? (
                        <form
                          className="flex-1 flex items-center gap-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (editTitle.trim()) {
                              renameConversation(conv.id, editTitle.trim());
                            }
                            setEditingId(null);
                          }}
                        >
                          <input
                            className="flex-1 text-xs bg-muted rounded px-1.5 py-0.5 outline-none border border-input"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingId(null);
                              e.stopPropagation();
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button type="submit" className="shrink-0 text-muted-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
                            <Check className="h-3 w-3" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            className="flex-1 text-left text-xs truncate"
                            onClick={() => loadConversation(conv.id)}
                          >
                            {conv.title ?? 'Untitled'}
                          </button>
                          <button
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(conv.id);
                              setEditTitle(conv.title ?? '');
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={newConversation}>
                    <Plus className="h-3 w-3 mr-2" />
                    New conversation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={newConversation} title="New conversation">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSettings(true)} title="Settings">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={close}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-xs">
            {error}
          </div>
        )}

        {/* Messages */}
        <ChatMessageList
          messages={messages}
          streamingContent={streamingContent}
          pendingToolCalls={pendingToolCalls}
          completedToolCalls={completedToolCalls}
          isStreaming={isStreaming}
        />

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          onStop={stopStreaming}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
}
