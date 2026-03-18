'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bolt,
  ChevronDown,
  ChevronRight,
  Globe,
  Key,
  Plug2,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Server,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface ApiConnection {
  id: string;
  name: string;
  service_type: string;
  status: string;
  last_used_at: string | null;
  last_health_check: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiConnectionsPanelProps {
  slug: string;
}

interface ZapierTool {
  name: string;
  description?: string;
}

const SERVICE_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  zapier: {
    label: 'Zapier',
    icon: <Bolt className="h-4 w-4 text-orange-500" />,
    description: 'Connect to Zapier for automated workflows. Supports MCP actions in workflows, outgoing webhooks to Zapier triggers, and incoming webhooks from Zapier actions.',
  },
  webhook: {
    label: 'Webhook',
    icon: <Globe className="h-4 w-4 text-teal-500" />,
    description: 'External webhook endpoint with authentication',
  },
  api_key: {
    label: 'API Key',
    icon: <Key className="h-4 w-4 text-yellow-600" />,
    description: 'API key authentication for external services',
  },
  oauth2: {
    label: 'OAuth 2.0',
    icon: <Plug2 className="h-4 w-4 text-blue-500" />,
    description: 'OAuth 2.0 client credentials or authorization code flow',
  },
  mcp: {
    label: 'MCP Server',
    icon: <Server className="h-4 w-4 text-purple-500" />,
    description: 'Model Context Protocol server connection',
  },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', icon: <CheckCircle2 className="h-3 w-3 text-green-500" />, variant: 'outline' },
  inactive: { label: 'Inactive', icon: <AlertCircle className="h-3 w-3 text-yellow-500" />, variant: 'secondary' },
  expired: { label: 'Expired', icon: <XCircle className="h-3 w-3 text-red-500" />, variant: 'destructive' },
  error: { label: 'Error', icon: <XCircle className="h-3 w-3 text-red-500" />, variant: 'destructive' },
};

export function ApiConnectionsPanel({ slug }: ApiConnectionsPanelProps) {
  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toolsMap, setToolsMap] = useState<Record<string, { tools: ZapierTool[]; loading: boolean; cached: boolean }>>({});

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/api-connections`);
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch {
      toast.error('Failed to load API connections');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const res = await fetch(`/api/projects/${slug}/api-connections/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Connection test passed');
        fetchConnections();
      } else {
        toast.error(`Connection test failed: ${data.message || 'Unknown error'}`);
      }
    } catch {
      toast.error('Failed to test connection');
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/projects/${slug}/api-connections/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Connection deleted');
        setConnections((prev) => prev.filter((c) => c.id !== deleteId));
      } else {
        toast.error('Failed to delete connection');
      }
    } catch {
      toast.error('Failed to delete connection');
    } finally {
      setDeleteId(null);
    }
  }

  async function fetchTools(id: string, refresh = false) {
    setToolsMap((prev) => ({ ...prev, [id]: { tools: prev[id]?.tools ?? [], loading: true, cached: false } }));
    try {
      const res = await fetch(`/api/projects/${slug}/api-connections/${id}/tools${refresh ? '?refresh=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        setToolsMap((prev) => ({ ...prev, [id]: { tools: data.tools ?? [], loading: false, cached: !!data.cached } }));
        return data.tools?.length ?? 0;
      }
    } catch {
      // ignore
    }
    setToolsMap((prev) => ({ ...prev, [id]: { tools: [], loading: false, cached: false } }));
    return 0;
  }

  function toggleExpand(conn: ApiConnection) {
    if (expandedId === conn.id) {
      setExpandedId(null);
    } else {
      setExpandedId(conn.id);
      if (!toolsMap[conn.id]) {
        fetchTools(conn.id);
      }
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Connections</CardTitle>
              <CardDescription>
                Manage external service connections for Zapier, webhooks, MCP servers, and API keys used in workflows.
              </CardDescription>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  Add Connection
                </Button>
              </DialogTrigger>
              <CreateConnectionDialog
                slug={slug}
                onCreated={(newId, serviceType) => {
                  setCreateOpen(false);
                  fetchConnections();
                  // Auto-fetch tools for Zapier/MCP connections
                  if (newId && (serviceType === 'zapier' || serviceType === 'mcp')) {
                    setExpandedId(newId);
                    fetchTools(newId).then((count) => {
                      if (count > 0) {
                        toast.success(`Found ${count} available action${count !== 1 ? 's' : ''}`);
                      }
                    });
                  }
                }}
              />
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Plug2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No API connections yet</p>
              <p className="text-sm mt-1">Add a connection to enable external integrations in your workflows.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => {
                const svc = SERVICE_TYPE_CONFIG[conn.service_type] ?? SERVICE_TYPE_CONFIG['api_key']!;
                const status = STATUS_CONFIG[conn.status] ?? STATUS_CONFIG['inactive']!;
                const supportsTools = conn.service_type === 'zapier' || conn.service_type === 'mcp';
                const isExpanded = expandedId === conn.id;
                const connTools = toolsMap[conn.id];

                return (
                  <div key={conn.id} className="rounded-lg border">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          {svc.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{conn.name}</span>
                            <Badge variant={status.variant} className="gap-1 text-xs">
                              {status.icon}
                              {status.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {svc.label}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {conn.last_used_at
                              ? `Last used ${new Date(conn.last_used_at).toLocaleDateString()}`
                              : 'Never used'}
                            {' · '}
                            Created {new Date(conn.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {supportsTools && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => toggleExpand(conn)}
                          >
                            <Wrench className="h-3 w-3" />
                            Actions
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleTest(conn.id)}
                          disabled={testingId === conn.id}
                          title="Test connection"
                        >
                          {testingId === conn.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(conn.id)}
                          title="Delete connection"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Expandable tools list */}
                    {supportsTools && isExpanded && (
                      <div className="border-t px-4 py-3 bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium">Available Actions</span>
                          <div className="flex items-center gap-2">
                            {connTools && !connTools.loading && (
                              <span className="text-[10px] text-muted-foreground">
                                {connTools.tools.length} action{connTools.tools.length !== 1 ? 's' : ''}
                                {connTools.cached ? ' (cached)' : ''}
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => fetchTools(conn.id, true)}
                              disabled={connTools?.loading}
                              title="Refresh actions"
                            >
                              {connTools?.loading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {connTools?.loading && connTools.tools.length === 0 ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Fetching available actions...
                          </div>
                        ) : connTools && connTools.tools.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">
                            No actions found. Make sure the connection is active and has actions configured in Zapier.
                          </p>
                        ) : connTools ? (
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {connTools.tools.map((tool) => (
                              <div
                                key={tool.name}
                                className="flex items-start gap-2 rounded p-2 text-xs hover:bg-muted/50"
                              >
                                <Bolt className="h-3 w-3 mt-0.5 text-orange-500 shrink-0" />
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{tool.name}</div>
                                  {tool.description && (
                                    <div className="text-muted-foreground line-clamp-2">{tool.description}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {/* Integration help for Zapier connections */}
                        {conn.service_type === 'zapier' && (
                          <div className="mt-3 pt-3 border-t space-y-1.5 text-[11px] text-muted-foreground">
                            <p className="font-medium text-foreground text-xs">Integration options:</p>
                            <p><strong>Workflows:</strong> Use the workflow editor to call Zapier actions on-demand via the Zapier node.</p>
                            <p><strong>Outgoing:</strong> Create an outgoing webhook to send CRM events to a Zapier &quot;Catch Hook&quot; trigger.</p>
                            <p><strong>Incoming:</strong> Use <code className="text-[10px] bg-muted px-1 rounded">POST /api/projects/{'{'}<em>slug</em>{'}'}/webhooks/incoming/zapier</code> with your API key as a Bearer token to push data from Zapier into the CRM.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this connection. Any workflows using it will fail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Create Connection Dialog ───────────────────────────────────────────────

interface CreateConnectionDialogProps {
  slug: string;
  onCreated: (newId?: string, serviceType?: string) => void;
}

interface ZapierPreviewAction {
  name: string;
  description?: string;
}

function CreateConnectionDialog({ slug, onCreated }: CreateConnectionDialogProps) {
  const [saving, setSaving] = useState(false);
  const [serviceType, setServiceType] = useState('zapier');
  const [name, setName] = useState('Zapier');
  const [apiKey, setApiKey] = useState('');
  const [serverUrl, setServerUrl] = useState('https://actions.zapier.com/mcp');
  const [clientSecret, setClientSecret] = useState('');
  const [headerName, setHeaderName] = useState('Authorization');

  // Zapier preview state
  const [previewActions, setPreviewActions] = useState<ZapierPreviewAction[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewed, setPreviewed] = useState(false);

  function handleServiceTypeChange(type: string) {
    setServiceType(type);
    const label = SERVICE_TYPE_CONFIG[type]?.label || 'API';
    if (!name || name.startsWith('Zapier') || name === 'Webhook' || name === 'API Key' || name === 'OAuth 2.0' || name === 'MCP Server') {
      setName(label);
    }
    if (type === 'zapier') {
      setServerUrl('https://actions.zapier.com/mcp');
    } else if (serverUrl === 'https://actions.zapier.com/mcp') {
      setServerUrl('');
    }
    setPreviewActions([]);
    setPreviewError(null);
    setPreviewed(false);
  }

  async function handleTestZapier() {
    if (!apiKey.trim()) {
      toast.error('Enter your Zapier API key first');
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewActions([]);
    try {
      const url = serverUrl || 'https://actions.zapier.com/mcp';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      });
      if (!res.ok) {
        setPreviewError(
          res.status === 401 || res.status === 403
            ? 'Invalid API key. Check your key at actions.zapier.com/credentials'
            : `Zapier returned ${res.status}. Check the MCP Server URL.`
        );
        setPreviewed(true);
        return;
      }
      const data = await res.json();
      const tools: ZapierPreviewAction[] = data.result?.tools || data.tools || [];
      setPreviewActions(tools);
      setPreviewed(true);
      if (tools.length === 0) {
        setPreviewError('Connected successfully, but no actions are enabled yet. Enable actions at actions.zapier.com');
      }
    } catch {
      setPreviewError('Could not reach Zapier. Check the MCP Server URL and try again.');
      setPreviewed(true);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    if ((serviceType === 'webhook' || serviceType === 'mcp') && !serverUrl.trim()) {
      toast.error('Server URL is required');
      return;
    }
    if (serviceType === 'oauth2' && (!apiKey.trim() || !clientSecret.trim())) {
      toast.error('Client ID and Client Secret are required');
      return;
    }
    if ((serviceType === 'api_key' || serviceType === 'zapier') && !apiKey.trim()) {
      toast.error('API Key is required');
      return;
    }

    setSaving(true);
    try {
      const config: Record<string, string> = {};
      switch (serviceType) {
        case 'zapier':
          config.api_key = apiKey;
          config.server_url = serverUrl || 'https://actions.zapier.com/mcp';
          break;
        case 'webhook':
          config.url = serverUrl;
          config.header_name = headerName;
          config.api_key = apiKey;
          break;
        case 'api_key':
          config.api_key = apiKey;
          config.header_name = headerName;
          config.service_name = name;
          break;
        case 'mcp':
          config.server_url = serverUrl;
          config.api_key = apiKey;
          config.transport_type = 'http';
          break;
        case 'oauth2':
          config.client_id = apiKey;
          config.client_secret = clientSecret;
          break;
      }

      const res = await fetch(`/api/projects/${slug}/api-connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, service_type: serviceType, config }),
      });

      if (res.ok) {
        const result = await res.json();
        toast.success('Connection created');
        onCreated(result.connection?.id, serviceType);
        // Reset
        setName('Zapier');
        setApiKey('');
        setServerUrl('https://actions.zapier.com/mcp');
        setClientSecret('');
        setHeaderName('Authorization');
        setServiceType('zapier');
        setPreviewActions([]);
        setPreviewed(false);
        setPreviewError(null);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create connection');
      }
    } catch {
      toast.error('Failed to create connection');
    } finally {
      setSaving(false);
    }
  }

  // ── Zapier-specific dialog ────────────────────────────────────────────────
  if (serviceType === 'zapier') {
    return (
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bolt className="h-5 w-5 text-orange-500" />
            Connect to Zapier
          </DialogTitle>
          <DialogDescription>
            Enter your Zapier API key to authenticate and discover available actions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
            {/* Connection name */}
            <div className="space-y-1.5">
              <Label className="text-xs">Connection Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Zapier connection"
                className="h-8 text-sm"
              />
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <Label className="text-xs">Zapier API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setPreviewed(false); setPreviewError(null); }}
                placeholder="sk-ak-..."
                className="h-8 text-sm"
                autoFocus={!selectedApp}
              />
              <p className="text-[11px] text-muted-foreground">
                Get your key at{' '}
                <a href="https://actions.zapier.com/credentials/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  actions.zapier.com/credentials
                </a>
                {' '}— this key authenticates both MCP actions and incoming webhooks.
              </p>
            </div>

            {/* Test + Preview */}
            {apiKey.trim() && (
              <div className="space-y-2">
                {!previewed && !previewLoading && (
                  <Button type="button" variant="outline" className="w-full gap-2 h-9" onClick={handleTestZapier}>
                    <Bolt className="h-4 w-4 text-orange-500" />
                    Test Connection
                  </Button>
                )}
                {previewLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting to Zapier...
                  </div>
                )}
                {previewError && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-xs text-destructive">
                    {previewError}
                  </div>
                )}
                {previewed && previewActions.length > 0 && (
                  <div className="rounded-lg border bg-green-500/5 border-green-500/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-green-600">
                        {previewActions.length} action{previewActions.length !== 1 ? 's' : ''} available
                      </span>
                      <Button type="button" variant="ghost" size="sm" className="h-5 text-[10px]" onClick={handleTestZapier}>
                        Refresh
                      </Button>
                    </div>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {previewActions.map((a) => (
                        <div key={a.name} className="flex items-start gap-2 text-xs">
                          <Bolt className="h-3 w-3 mt-0.5 text-orange-500 shrink-0" />
                          <span className="truncate">{a.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Advanced */}
            <details className="text-xs">
              <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                Advanced settings
              </summary>
              <div className="mt-2 space-y-1.5">
                <Label className="text-[10px]">MCP Server URL</Label>
                <Input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://actions.zapier.com/mcp"
                  className="text-xs h-7"
                />
              </div>
            </details>
          </div>

        <DialogFooter>
          <Button onClick={handleCreate} disabled={saving || !apiKey.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Connection
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  // ── Generic connection dialog (non-Zapier) ────────────────────────────────
  return (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>Add API Connection</DialogTitle>
        <DialogDescription>
          Configure an external service connection for use in workflows.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label>Service Type</Label>
          <Select value={serviceType} onValueChange={handleServiceTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SERVICE_TYPE_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    {config.icon}
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {SERVICE_TYPE_CONFIG[serviceType]?.description}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Connection Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`My ${SERVICE_TYPE_CONFIG[serviceType]?.label || 'API'} connection`}
          />
        </div>

        {(serviceType === 'webhook' || serviceType === 'mcp') && (
          <div className="space-y-2">
            <Label>{serviceType === 'mcp' ? 'Server URL' : 'Webhook URL'}</Label>
            <Input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        )}

        {serviceType === 'oauth2' ? (
          <>
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Client ID"
              />
            </div>
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <Input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Client secret"
              />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label>API Key / Token</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... or bearer token"
            />
          </div>
        )}

        {(serviceType === 'webhook' || serviceType === 'api_key') && (
          <div className="space-y-2">
            <Label>Header Name</Label>
            <Input
              value={headerName}
              onChange={(e) => setHeaderName(e.target.value)}
              placeholder="Authorization"
            />
            <p className="text-xs text-muted-foreground">
              The HTTP header to send the API key in (default: Authorization with Bearer prefix)
            </p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button onClick={handleCreate} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Create Connection
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
