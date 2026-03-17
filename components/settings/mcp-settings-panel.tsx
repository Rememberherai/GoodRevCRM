'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, Copy, Key, Eye, EyeOff, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface McpApiKey {
  id: string;
  name: string;
  key_prefix: string;
  role: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface McpSettingsPanelProps {
  slug: string;
}

export function McpSettingsPanel({ slug }: McpSettingsPanelProps) {
  const [keys, setKeys] = useState<McpApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyRole, setNewKeyRole] = useState('member');
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/mcp/keys`);
      if (!res.ok) return;
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error('Key name is required');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${slug}/mcp/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName,
          role: newKeyRole,
          expires_in_days: newKeyExpiry ? parseInt(newKeyExpiry) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create key');
      }

      const data = await res.json();
      setRevealedKey(data.secret);
      setShowKey(true);
      toast.success('API key created');
      fetchKeys();
      setNewKeyName('');
      setNewKeyRole('member');
      setNewKeyExpiry('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/mcp/keys?id=${keyId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to revoke key');
      toast.success('Key revoked');
      fetchKeys();
    } catch {
      toast.error('Failed to revoke key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  const mcpEndpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/mcp`
    : '/api/mcp';

  const claudeDesktopConfig = JSON.stringify({
    mcpServers: {
      goodrev: {
        command: 'npx',
        args: ['tsx', 'bin/mcp-server.ts'],
        cwd: '/path/to/GoodRevCRM',
        env: { MCP_API_KEY: 'grv_your_key_here' },
      },
    },
  }, null, 2);

  return (
    <div className="space-y-6">
      {/* Connection Info */}
      <Card>
        <CardHeader>
          <CardTitle>MCP Server</CardTitle>
          <CardDescription>
            Connect AI assistants (Claude Desktop, Cursor, custom agents) to your CRM via the Model Context Protocol
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">HTTP Endpoint</Label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">{mcpEndpoint}</code>
              <Button variant="ghost" size="icon" onClick={() => copyToClipboard(mcpEndpoint)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Claude Desktop Config</Label>
            <div className="mt-1 relative">
              <pre className="rounded bg-muted px-3 py-2 text-xs font-mono overflow-x-auto">{claudeDesktopConfig}</pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1"
                onClick={() => copyToClipboard(claudeDesktopConfig)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Terminal className="h-4 w-4" />
            <span>stdio transport: <code className="bg-muted px-1 rounded">MCP_API_KEY=grv_xxx npx tsx bin/mcp-server.ts</code></span>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage keys for MCP client authentication. Each key is scoped to this project with a specific role.
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create MCP API Key</DialogTitle>
                  <DialogDescription>
                    Generate a new API key for MCP client access to this project.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      placeholder="e.g. Claude Desktop, Production Agent"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={newKeyRole} onValueChange={setNewKeyRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                        <SelectItem value="member">Member (read/write)</SelectItem>
                        <SelectItem value="admin">Admin (full access)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Expires in (days, optional)</Label>
                    <Input
                      type="number"
                      placeholder="Leave empty for no expiry"
                      value={newKeyExpiry}
                      onChange={(e) => setNewKeyExpiry(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Newly created key reveal */}
          {revealedKey && (
            <div className="mb-4 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  Save this key now — it cannot be retrieved later
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setRevealedKey(null); setShowKey(false); }}
                >
                  Dismiss
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                  {showKey ? revealedKey : '•'.repeat(40)}
                </code>
                <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(revealedKey)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No API keys yet. Create one to connect MCP clients.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{key.key_prefix}...</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.role === 'admin' ? 'default' : key.role === 'viewer' ? 'secondary' : 'outline'}>
                        {key.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(key.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.expires_at ? new Date(key.expires_at).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will immediately revoke the key &quot;{key.name}&quot;. Any MCP clients using it will lose access.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRevoke(key.id)}
                              className="bg-destructive text-white hover:bg-destructive/90"
                            >
                              Revoke
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {revokedKeys.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Revoked Keys ({revokedKeys.length})</p>
              <div className="space-y-1">
                {revokedKeys.map((key) => (
                  <div key={key.id} className="flex items-center gap-2 text-sm text-muted-foreground line-through">
                    <span>{key.name}</span>
                    <code className="text-xs">{key.key_prefix}...</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Tools */}
      <Card>
        <CardHeader>
          <CardTitle>Available Tools</CardTitle>
          <CardDescription>
            MCP tools exposed to connected clients. 90+ tools across all CRM features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { name: 'Organizations', count: 7, desc: 'CRUD, search, get people' },
              { name: 'People', count: 7, desc: 'CRUD, link orgs, find email' },
              { name: 'Opportunities', count: 6, desc: 'CRUD, pipeline view' },
              { name: 'RFPs', count: 8, desc: 'CRUD, questions, AI answers' },
              { name: 'Tasks', count: 5, desc: 'CRUD, completion' },
              { name: 'Emails', count: 7, desc: 'Send, draft, templates, verify' },
              { name: 'Sequences', count: 9, desc: 'CRUD, enroll, disposition' },
              { name: 'Automations', count: 5, desc: 'CRUD, test' },
              { name: 'Search', count: 1, desc: 'Global cross-entity search' },
              { name: 'Enrichment', count: 2, desc: 'Contact & org enrichment' },
              { name: 'Reports', count: 3, desc: 'Dashboard, pipeline, custom' },
              { name: 'News', count: 2, desc: 'Articles, keywords' },
              { name: 'Bounces', count: 3, desc: 'Scan, list, stats' },
              { name: 'Municipalities', count: 3, desc: 'List, scan, logs' },
              { name: 'SMS', count: 2, desc: 'Send, history' },
              { name: 'Calls', count: 4, desc: 'List, initiate, log' },
            ].map((group) => (
              <div key={group.name} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{group.name}</span>
                  <Badge variant="secondary" className="text-xs">{group.count}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{group.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
