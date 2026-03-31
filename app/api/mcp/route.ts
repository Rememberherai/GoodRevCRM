import { NextRequest } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '@/lib/mcp/server';
import { authenticateApiKey } from '@/lib/mcp/auth';
import { logUsage, redactSensitiveParams } from '@/lib/mcp/middleware';
import type { McpContext } from '@/types/mcp';

export const dynamic = 'force-dynamic';

// Store active transports keyed by session ID
const transports = new Map<string, { transport: WebStandardStreamableHTTPServerTransport; context: McpContext }>();

async function authenticate(request: NextRequest): Promise<McpContext | Response> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header. Use: Bearer grv_xxxx' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.slice(7);
  const mcpContext = await authenticateApiKey(token);
  if (!mcpContext) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired API key' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return mcpContext;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;
  const mcpContext = authResult;

  try {
    const sessionId = request.headers.get('mcp-session-id');

    // Reuse existing transport for this session
    if (sessionId && transports.has(sessionId)) {
      const { transport } = transports.get(sessionId)!;
      return await transport.handleRequest(request);
    }

    // New session — create server and transport
    const currentContext: McpContext = mcpContext;
    const getContext = () => currentContext;
    const server = createMcpServer(getContext);

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (sid) => {
        transports.set(sid, { transport, context: mcpContext });
      },
      onsessionclosed: (sid) => {
        transports.delete(sid);
      },
      enableJsonResponse: true,
    });

    await server.connect(transport);

    const response = await transport.handleRequest(request);

    // Log usage (fire-and-forget)
    try {
      const body = await request.clone().json();
      const toolName = body?.method === 'tools/call' ? body?.params?.name : body?.method;
      if (toolName) {
        logUsage(
          mcpContext,
          {
            tool_name: toolName,
            input_summary: body?.params ? redactSensitiveParams(body.params as Record<string, unknown>) : null,
            output_summary: null,
            status: 'success',
            error_message: null,
            duration_ms: Date.now() - startTime,
          },
          request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
          request.headers.get('user-agent') ?? undefined
        );
      }
    } catch {
      // Logging failure should not affect response
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';

    logUsage(
      mcpContext,
      {
        tool_name: 'unknown',
        input_summary: null,
        output_summary: null,
        status: 'error',
        error_message: message,
        duration_ms: Date.now() - startTime,
      },
      request.headers.get('x-forwarded-for') ?? undefined,
      request.headers.get('user-agent') ?? undefined
    );

    return new Response(
      JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET(request: NextRequest) {
  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;

  const sessionId = request.headers.get('mcp-session-id');
  if (!sessionId || !transports.has(sessionId)) {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing session. Send a POST first to initialize.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { transport } = transports.get(sessionId)!;
  return await transport.handleRequest(request);
}

export async function DELETE(request: NextRequest) {
  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;

  const sessionId = request.headers.get('mcp-session-id');
  if (sessionId && transports.has(sessionId)) {
    const { transport } = transports.get(sessionId)!;
    await transport.close();
    transports.delete(sessionId);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
