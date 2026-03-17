import { useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useChatStore, type ChatMessage } from '@/stores/chat';

export interface PageContext {
  entityType: 'organization' | 'person';
  entityId: string;
}

function detectPageContext(pathname: string): PageContext | null {
  // Match /projects/[slug]/organizations/[uuid]
  const orgMatch = pathname.match(/\/projects\/[^/]+\/organizations\/([0-9a-f-]{36})/);
  if (orgMatch?.[1]) return { entityType: 'organization', entityId: orgMatch[1] };

  // Match /projects/[slug]/people/[uuid]
  const personMatch = pathname.match(/\/projects\/[^/]+\/people\/([0-9a-f-]{36})/);
  if (personMatch?.[1]) return { entityType: 'person', entityId: personMatch[1] };

  return null;
}

export function useChat(projectSlug: string) {
  const store = useChatStore();
  const abortRef = useRef<AbortController | null>(null);
  const pathname = usePathname();

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/chat`);
      if (!res.ok) return;
      const data = await res.json();
      store.setConversations(data.conversations ?? []);
    } catch {
      // Silently fail
    }
  }, [projectSlug, store]);

  const loadConversation = useCallback(async (conversationId: string) => {
    store.setCurrentConversation(conversationId);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/chat?conversationId=${conversationId}`);
      if (!res.ok) return;
      const data = await res.json();
      store.setMessages(data.messages ?? []);
    } catch {
      store.setError('Failed to load conversation');
    }
  }, [projectSlug, store]);

  const sendMessage = useCallback(async (text: string) => {
    if (store.isStreaming) return;

    store.setError(null);
    store.setStreaming(true);
    store.resetStreamingContent();
    store.clearToolCalls();

    // Add user message optimistically
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    store.addMessage(userMsg);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const pageContext = detectPageContext(pathname);
      const res = await fetch(`/api/projects/${projectSlug}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: store.currentConversationId,
          message: text,
          pageContext,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        store.setError(err.error ?? 'Request failed');
        store.setStreaming(false);
        return;
      }

      if (!res.body) {
        store.setError('No response body');
        store.setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);

            switch (event.type) {
              case 'conversation':
                if (!store.currentConversationId && event.conversationId) {
                  store.setCurrentConversation(event.conversationId);
                }
                break;

              case 'tool_call':
                store.addToolCall({
                  id: event.id,
                  name: event.name,
                  arguments: event.arguments,
                  status: 'pending',
                });
                break;

              case 'tool_result':
                store.updateToolCallResult(
                  event.id,
                  event.result,
                  'complete'
                );
                break;

              case 'text_delta':
                store.appendStreamingContent(event.content);
                break;

              case 'done':
                // Finalize: move streaming content into a message
                {
                  const finalContent = useChatStore.getState().streamingContent;
                  if (finalContent) {
                    const assistantMsg: ChatMessage = {
                      id: `msg-${Date.now()}`,
                      role: 'assistant',
                      content: finalContent,
                      created_at: new Date().toISOString(),
                    };
                    store.addMessage(assistantMsg);
                    store.resetStreamingContent();
                  }
                }
                // Refresh conversations list for title updates
                loadConversations();
                break;

              case 'error':
                store.setError(event.message);
                break;
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled
      } else {
        store.setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      store.setStreaming(false);
      store.resetStreamingContent();
      abortRef.current = null;
    }
  }, [projectSlug, store, loadConversations, pathname]);

  const newConversation = useCallback(() => {
    store.reset();
  }, [store]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      await fetch(`/api/projects/${projectSlug}/chat/${conversationId}`, { method: 'DELETE' });
      store.setConversations(store.conversations.filter((c) => c.id !== conversationId));
      if (store.currentConversationId === conversationId) {
        store.reset();
      }
    } catch {
      // Silently fail
    }
  }, [projectSlug, store]);

  const renameConversation = useCallback(async (conversationId: string, title: string) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/chat/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) return;
      store.setConversations(
        store.conversations.map((c) =>
          c.id === conversationId ? { ...c, title } : c
        )
      );
    } catch {
      // Silently fail
    }
  }, [projectSlug, store]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    ...store,
    sendMessage,
    loadConversations,
    loadConversation,
    newConversation,
    deleteConversation,
    renameConversation,
    stopStreaming,
  };
}
