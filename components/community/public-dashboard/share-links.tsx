'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Copy, Link2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface ShareLinkRecord {
  id: string;
  token: string;
  label: string | null;
  expires_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
}

export function ShareLinks({ configId }: { configId: string | undefined }) {
  const params = useParams();
  const slug = params.slug as string;
  const [links, setLinks] = useState<ShareLinkRecord[]>([]);
  const [label, setLabel] = useState('');
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  useEffect(() => {
    if (!configId) return;
    const loadLinks = async () => {
      const response = await fetch(`/api/projects/${slug}/public-dashboard/${configId}/share-links`);
      const data = await response.json() as { share_links?: ShareLinkRecord[] };
      setLinks(data.share_links ?? []);
    };
    void loadLinks();
  }, [configId, slug]);

  if (!configId) return null;

  async function reload() {
    const response = await fetch(`/api/projects/${slug}/public-dashboard/${configId}/share-links`);
    const data = await response.json() as { share_links?: ShareLinkRecord[] };
    setLinks(data.share_links ?? []);
  }

  async function createLink() {
    await fetch(`/api/projects/${slug}/public-dashboard/${configId}/share-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label || null }),
    });
    setLabel('');
    await reload();
  }

  async function deleteLink(id: string) {
    await fetch(`/api/projects/${slug}/public-dashboard/${configId}/share-links?share_link_id=${id}`, { method: 'DELETE' });
    await reload();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share Links</CardTitle>
        <CardDescription>Create signed links with optional expiration and usage tracking.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Optional label" value={label} onChange={(event) => setLabel(event.target.value)} />
          <Button onClick={() => void createLink()}>
            <Link2 className="mr-2 h-4 w-4" />
            Create Link
          </Button>
        </div>

        <div className="space-y-3">
          {links.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No share links yet.</div>
          ) : (
            links.map((link) => {
              const url = origin ? `${origin}/public/link/${link.token}` : `/public/link/${link.token}`;
              return (
                <div key={link.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="font-medium">{link.label || 'Untitled link'}</div>
                      <div className="text-xs text-muted-foreground">
                        Accessed {link.access_count} time{link.access_count === 1 ? '' : 's'}
                        {link.last_accessed_at ? ` • last used ${new Date(link.last_accessed_at).toLocaleDateString()}` : ''}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(url)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void deleteLink(link.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
