import { useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useChatStore, type ChatMessage } from '@/stores/chat';

// Tool names that mutate data — trigger a page refresh after these complete
const MUTATING_TOOLS = new Set([
  'organizations_create', 'organizations_update', 'organizations_delete',
  'people_create', 'people_update', 'people_delete', 'people_link_organization',
  'opportunities_create', 'opportunities_update', 'opportunities_delete',
  'tasks_create', 'tasks_update', 'tasks_delete',
  'notes_create', 'notes_update', 'notes_delete',
  'tags_assign', 'tags_create',
  'sequences_create', 'sequences_update', 'sequences_delete',
  'sequences_enroll', 'sequences_unenroll',
  'rfps_create', 'rfps_update', 'rfps_delete',
  'meetings_create', 'meetings_update', 'meetings_delete',
  'email_send',
  'automations_create', 'automations_update', 'automations_delete',
  'content_create', 'content_update', 'content_delete',
  'news_create_keyword', 'news_delete_keyword', 'news_update_article',
  'schema_create', 'schema_update', 'schema_delete',
  'webhooks_create', 'webhooks_update', 'webhooks_delete',
  'reports_create', 'reports_delete',
  'reports_create_custom', 'reports_run',
  'templates_create', 'templates_update', 'templates_delete',
  'drafts_create', 'drafts_update', 'drafts_delete',
  'rfp_questions_create', 'rfp_questions_update', 'rfp_questions_delete',
  'widgets_create', 'widgets_update', 'widgets_delete',
  'members_update_role',
  'comments_create',
  'duplicates_resolve',
  'merge_execute',
  'enrichment_start',
  'contacts_add_to_org',
  'sms_send',
  'signatures_create', 'signatures_update', 'signatures_delete',
  'linkedin_generate_message',
  'bulk_execute',
  'sequence_steps_create', 'sequence_steps_update', 'sequence_steps_delete',
  'secrets_set', 'secrets_delete',
  'workflows_create', 'workflows_update', 'workflows_delete', 'workflows_activate', 'workflows_execute',
  'contracts_create', 'contracts_update', 'contracts_delete', 'contracts_void',
  'contracts_add_recipient', 'contracts_add_field',
  'products_create', 'products_update', 'products_delete',
  'quotes_create', 'quotes_update', 'quotes_delete', 'quotes_accept', 'quotes_reject', 'quotes_set_primary',
  'quotes_add_line_item', 'quotes_update_line_item', 'quotes_remove_line_item',
  'emails_create_contact_from_sender',
  'accounting_record_payment',
  'calendar_create_event_type', 'calendar_update_event_type', 'calendar_delete_event_type',
  'calendar_cancel_booking', 'calendar_update_profile', 'calendar_update_availability',
  'calendar_add_event_type_member', 'calendar_remove_event_type_member',
  'dispositions_create', 'dispositions_update', 'dispositions_delete',
]);

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
  const router = useRouter();
  const hadMutationRef = useRef(false);

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
    hadMutationRef.current = false;

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
                  store.setCurrentConversationId(event.conversationId);
                }
                break;

              case 'tool_call':
                store.addToolCall({
                  id: event.id,
                  name: event.name,
                  arguments: event.arguments,
                  status: 'pending',
                });
                if (MUTATING_TOOLS.has(event.name)) {
                  hadMutationRef.current = true;
                }
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
                // Move pending tool calls to completed (persistent display)
                store.finalizeToolCalls();
                // Refresh conversations list for title updates
                loadConversations();
                // Hot-refresh the page if any mutating tools were used
                if (hadMutationRef.current) {
                  router.refresh();
                }
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
