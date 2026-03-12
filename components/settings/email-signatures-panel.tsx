'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { SignatureEditor } from './signature-editor';
import type { EmailSignature } from '@/types/sequence';

interface EmailSignaturesPanelProps {
  slug: string;
}

export function EmailSignaturesPanel({ slug }: EmailSignaturesPanelProps) {
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSignature, setEditingSignature] = useState<EmailSignature | null>(null);
  const [deletingSignature, setDeletingSignature] = useState<EmailSignature | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const fetchSignatures = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/signatures`);
      if (!res.ok) throw new Error('Failed to fetch signatures');
      const data = await res.json();
      setSignatures(data.data ?? []);
    } catch (error) {
      console.error('Error fetching signatures:', error);
      toast.error('Failed to load signatures');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  const openCreateDialog = () => {
    setEditingSignature(null);
    setName('');
    setSenderName('');
    setContentHtml('');
    setIsDefault(signatures.length === 0); // Auto-default if first signature
    setEditDialogOpen(true);
  };

  const openEditDialog = (sig: EmailSignature) => {
    setEditingSignature(sig);
    setName(sig.name);
    setSenderName(sig.sender_name ?? '');
    setContentHtml(sig.content_html);
    setIsDefault(sig.is_default);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !contentHtml.trim()) {
      toast.error('Name and content are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        sender_name: senderName.trim() || null,
        content_html: contentHtml,
        is_default: isDefault,
      };

      if (editingSignature) {
        const res = await fetch(`/api/projects/${slug}/signatures/${editingSignature.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update signature');
        toast.success('Signature updated');
      } else {
        const res = await fetch(`/api/projects/${slug}/signatures`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create signature');
        toast.success('Signature created');
      }

      setEditDialogOpen(false);
      fetchSignatures();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save signature');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSignature) return;

    try {
      const res = await fetch(`/api/projects/${slug}/signatures/${deletingSignature.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete signature');
      toast.success('Signature deleted');
      setDeleteDialogOpen(false);
      setDeletingSignature(null);
      fetchSignatures();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete signature');
    }
  };

  const handleSetDefault = async (sig: EmailSignature) => {
    try {
      const res = await fetch(`/api/projects/${slug}/signatures/${sig.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) throw new Error('Failed to set default');
      toast.success(`"${sig.name}" set as default signature`);
      fetchSignatures();
    } catch (error) {
      toast.error('Failed to set default signature');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
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
              <CardTitle>Email Signatures</CardTitle>
              <CardDescription>
                Manage email signatures for this project. Your default signature is automatically
                appended to emails sent from this project.
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Signature
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {signatures.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No signatures yet.</p>
              <p className="text-sm mt-1">
                Create a signature to automatically append it to your outgoing emails.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {signatures.map((sig) => (
                <div
                  key={sig.id}
                  className="flex items-start justify-between border rounded-lg p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{sig.name}</span>
                      {sig.is_default && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3" />
                          Default
                        </Badge>
                      )}
                    </div>
                    {sig.sender_name && (
                      <p className="text-sm text-muted-foreground">
                        From: {sig.sender_name}
                      </p>
                    )}
                    <div
                      className="text-sm mt-2 max-h-24 overflow-hidden border rounded p-2 bg-white [&_*]:!text-black [&]:text-black"
                      dangerouslySetInnerHTML={{ __html: sig.content_html }}
                    />
                  </div>
                  <div className="flex items-center gap-1 ml-4 shrink-0">
                    {!sig.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(sig)}
                        title="Set as default"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(sig)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeletingSignature(sig);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingSignature ? 'Edit Signature' : 'New Signature'}
            </DialogTitle>
            <DialogDescription>
              {editingSignature
                ? 'Update your email signature.'
                : 'Create a new email signature. Use the toolbar to format text.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="sig-name">Name</Label>
              <Input
                id="sig-name"
                placeholder="e.g. Work Signature"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="sig-sender-name">From Name</Label>
              <Input
                id="sig-sender-name"
                placeholder="e.g. Evan Carr"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Display name shown in the From field. Leave blank to send from the bare email address.
              </p>
            </div>

            <div>
              <Label>Signature</Label>
              <div className="mt-1">
                <SignatureEditor value={contentHtml} onChange={setContentHtml} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="sig-default"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
              <Label htmlFor="sig-default">Set as default signature</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingSignature ? 'Save Changes' : 'Create Signature'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete signature?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deletingSignature?.name}&quot;. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
