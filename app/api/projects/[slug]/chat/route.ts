import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { getProjectOpenRouterClient } from '@/lib/openrouter/client';
import type { ChatMessageWithTools, ToolCallFunction } from '@/lib/openrouter/client';
import { getToolDefinitions, executeTool } from '@/lib/chat/tool-registry';
import { getCommunityToolDefinitions, executeCommunityTool } from '@/lib/chat/community-tool-registry';
import { buildSystemPrompt } from '@/lib/chat/system-prompt';
import { isMcpRole, isStandardMcpRole, type McpContext } from '@/types/mcp';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const pageContextSchema = z.object({
  entityType: z.enum(['organization', 'person']),
  entityId: z.string().uuid(),
}).nullish();

const sendMessageSchema = z.object({
  conversationId: z.string().uuid().nullish(),
  message: z.string().min(1).max(10000),
  pageContext: pageContextSchema.optional(),
});

const MAX_TOOL_ITERATIONS = 10;

// POST /api/projects/[slug]/chat — Send a message, get SSE stream back
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, name, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data: membership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();
    if (!membership) return NextResponse.json({ error: 'Not a project member' }, { status: 403 });

    if (!isMcpRole(membership.role)) {
      return NextResponse.json({ error: 'Unsupported project role' }, { status: 403 });
    }
    if (project.project_type !== 'community' && !isStandardMcpRole(membership.role)) {
      return NextResponse.json({ error: 'Unsupported project role' }, { status: 403 });
    }
    if (
      project.project_type === 'community'
      && ['board_viewer', 'member', 'viewer'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Community chat tools for this role are not enabled in this phase' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = sendMessageSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { conversationId, message, pageContext } = validation.data;

    // Fetch page context entity data if provided
    let pageContextPrompt = '';
    if (pageContext) {
      const table = pageContext.entityType === 'organization' ? 'organizations' : 'people';
      const { data: entity } = await supabase
        .from(table)
        .select('*')
        .eq('id', pageContext.entityId)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();

      if (entity) {
        const label = pageContext.entityType === 'organization'
          ? (entity as Record<string, unknown>).name
          : `${(entity as Record<string, unknown>).first_name} ${(entity as Record<string, unknown>).last_name}`;
        pageContextPrompt = `\n\n## Current Page Context\nThe user is currently viewing the ${pageContext.entityType} detail page for **${label}** (ID: ${pageContext.entityId}).\nFull record:\n\`\`\`json\n${JSON.stringify(entity, null, 2)}\n\`\`\`\nIf the user's message seems to relate to this ${pageContext.entityType}, use this context rather than asking for clarification.`;
      }
    }

    // Build MCP context for tool execution (use admin client for full access within project scope)
    const adminSupabase = createAdminClient();
    const mcpContext: McpContext = {
      projectId: project.id,
      projectType: project.project_type as 'standard' | 'community',
      userId: user.id,
      role: membership.role,
      apiKeyId: 'chat-session',
      supabase: adminSupabase,
    };

    // Use admin client for chat table operations (auth + membership already verified above)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = adminSupabase as any;

    // Load or create conversation
    let convId = conversationId;
    if (!convId) {
      const { data: conv, error: convError } = await db
        .from('chat_conversations')
        .insert({
          project_id: project.id,
          user_id: user.id,
          title: message.slice(0, 100),
        })
        .select('id')
        .single();
      if (convError) return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
      convId = conv.id as string;
    }

    // Save user message
    await db.from('chat_messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    // Load conversation history
    const { data: dbMessages } = await db
      .from('chat_messages')
      .select('role, content, tool_calls, tool_call_id, tool_name')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(100);

    // Build message history for OpenRouter
    const systemPrompt = buildSystemPrompt(project.name, project.project_type) + pageContextPrompt;
    const messages: ChatMessageWithTools[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of dbMessages ?? []) {
      if (msg.role === 'tool') {
        messages.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.tool_call_id,
        });
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        messages.push({
          role: 'assistant',
          content: msg.content,
          tool_calls: msg.tool_calls as ToolCallFunction[],
        });
      } else {
        messages.push({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        });
      }
    }

    const isCommunityProject = project.project_type === 'community';
    const toolDefs = isCommunityProject ? getCommunityToolDefinitions(membership.role) : getToolDefinitions();
    const openrouter = await getProjectOpenRouterClient(project.id);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        // Send conversation ID so the client can track it
        send({ type: 'conversation', conversationId: convId });

        try {
          let iterations = 0;

          // Agent loop: call LLM → execute tools → repeat until final text
          while (iterations < MAX_TOOL_ITERATIONS) {
            iterations++;

            const result = await openrouter.chatWithTools(messages, toolDefs, {
              temperature: 0.3,
              maxTokens: 4096,
            });

            // If the model wants to call tools
            if (result.tool_calls && result.tool_calls.length > 0) {
              // Save assistant message with tool_calls to DB
              await db.from('chat_messages').insert({
                conversation_id: convId,
                role: 'assistant',
                content: result.content,
                tool_calls: result.tool_calls,
              });

              // Add assistant message to history
              messages.push({
                role: 'assistant',
                content: result.content,
                tool_calls: result.tool_calls,
              });

              // Execute each tool call
              for (const toolCall of result.tool_calls) {
                let parsedArgs: Record<string, unknown> = {};
                try {
                  parsedArgs = JSON.parse(toolCall.function.arguments);
                } catch {
                  parsedArgs = {};
                }

                send({
                  type: 'tool_call',
                  id: toolCall.id,
                  name: toolCall.function.name,
                  arguments: parsedArgs,
                });

                let toolResult: string;
                try {
                  toolResult = isCommunityProject
                    ? await executeCommunityTool(toolCall.function.name, parsedArgs, mcpContext)
                    : await executeTool(toolCall.function.name, parsedArgs, mcpContext);
                } catch (err) {
                  toolResult = JSON.stringify({ error: err instanceof Error ? err.message : 'Tool execution failed' });
                }

                send({
                  type: 'tool_result',
                  id: toolCall.id,
                  name: toolCall.function.name,
                  result: toolResult,
                });

                // Save tool result to DB
                await db.from('chat_messages').insert({
                  conversation_id: convId,
                  role: 'tool',
                  content: toolResult,
                  tool_call_id: toolCall.id,
                  tool_name: toolCall.function.name,
                });

                // Add tool result to history
                messages.push({
                  role: 'tool',
                  content: toolResult,
                  tool_call_id: toolCall.id,
                });
              }

              // Continue the loop — LLM will process tool results
              continue;
            }

            // Final text response — stream it
            const finalContent = result.content ?? '';

            // For the final response, use streaming
            const streamResponse = await openrouter.chatStream(messages, {
              temperature: 0.3,
              maxTokens: 4096,
            });

            if (!streamResponse.body) {
              // Fallback: send the non-streamed content
              send({ type: 'text_delta', content: finalContent });

              // Save final assistant message to DB
              await db.from('chat_messages').insert({
                conversation_id: convId,
                role: 'assistant',
                content: finalContent,
                token_usage: result.usage,
              });
            } else {
              const reader = streamResponse.body.getReader();
              const decoder = new TextDecoder();
              let buffer = '';
              let fullContent = '';

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                  if (!line.startsWith('data: ')) continue;
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') continue;

                  try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                      fullContent += delta;
                      send({ type: 'text_delta', content: delta });
                    }
                  } catch {
                    // Skip malformed SSE chunks
                  }
                }
              }

              // Use streamed content if we got any, otherwise use the non-streamed content
              const contentToSave = fullContent || finalContent;

              // Save final assistant message to DB
              await db.from('chat_messages').insert({
                conversation_id: convId,
                role: 'assistant',
                content: contentToSave,
                token_usage: result.usage,
              });
            }

            send({ type: 'done', conversationId: convId });
            break;
          }

          if (iterations >= MAX_TOOL_ITERATIONS) {
            send({ type: 'error', message: 'Maximum tool call iterations reached' });
          }
        } catch (err) {
          send({ type: 'error', message: err instanceof Error ? err.message : 'An error occurred' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/projects/[slug]/chat — List conversations or get messages
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Verify membership
    const { data: membership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();
    if (!membership) return NextResponse.json({ error: 'Not a project member' }, { status: 403 });

    // Use admin client for chat table operations (auth + membership verified above)
    const adminSupabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = adminSupabase as any;
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (conversationId) {
      // Verify the conversation belongs to this user and project
      const { data: conv } = await db
        .from('chat_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('project_id', project.id)
        .eq('user_id', user.id)
        .single();
      if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

      // Get messages for a conversation
      const { data: messages, error } = await db
        .from('chat_messages')
        .select('id, role, content, tool_calls, tool_call_id, tool_name, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
      return NextResponse.json({ messages });
    }

    // List conversations
    const { data: conversations, error } = await db
      .from('chat_conversations')
      .select('id, title, model, created_at, updated_at')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: 'Failed to list conversations' }, { status: 500 });
    return NextResponse.json({ conversations });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
