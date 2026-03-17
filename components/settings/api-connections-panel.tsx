'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bolt,
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

const SERVICE_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  zapier: {
    label: 'Zapier',
    icon: <Bolt className="h-4 w-4 text-orange-500" />,
    description: 'Connect to Zapier MCP for automated workflows',
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
        toast.error(`Connection test failed: ${data.error || 'Unknown error'}`);
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
                onCreated={() => {
                  setCreateOpen(false);
                  fetchConnections();
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

                return (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
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
  onCreated: () => void;
}

function CreateConnectionDialog({ slug, onCreated }: CreateConnectionDialogProps) {
  const [saving, setSaving] = useState(false);
  const [serviceType, setServiceType] = useState('zapier');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [headerName, setHeaderName] = useState('Authorization');

  async function handleCreate() {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    // Per-service-type validation
    if ((serviceType === 'webhook' || serviceType === 'mcp') && !serverUrl.trim()) {
      toast.error('Server URL is required');
      return;
    }
    if (serviceType === 'oauth2' && (!apiKey.trim() || !clientSecret.trim())) {
      toast.error('Client ID and Client Secret are required');
      return;
    }
    if (serviceType === 'api_key' && !apiKey.trim()) {
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
        toast.success('Connection created');
        onCreated();
        setName('');
        setApiKey('');
        setServerUrl('');
        setClientSecret('');
        setHeaderName('Authorization');
        setServiceType('zapier');
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
          <Select value={serviceType} onValueChange={setServiceType}>
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

        {(serviceType === 'zapier' || serviceType === 'webhook' || serviceType === 'mcp') && (
          <div className="space-y-2">
            <Label>{serviceType === 'zapier' ? 'MCP Server URL' : serviceType === 'mcp' ? 'Server URL' : 'Webhook URL'}</Label>
            <Input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder={serviceType === 'zapier' ? 'https://actions.zapier.com/mcp' : 'https://...'}
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
