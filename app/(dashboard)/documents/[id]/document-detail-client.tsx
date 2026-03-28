'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  ArrowLeft, Download, Send, Ban, Bell, FileText, Clock, Copy,
  CheckCircle2, XCircle, Eye, Shield, Loader2, Plus, Trash2, PenTool,
  Bold, Italic, List, ListOrdered,
} from 'lucide-react';
import { DOCUMENT_STATUS_LABELS, RECIPIENT_STATUS_LABELS, type ContractDocumentStatus, type ContractRecipientStatus } from '@/types/contract';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STATUS_COLORS: Record<ContractDocumentStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  viewed: 'bg-indigo-100 text-indigo-800',
  partially_signed: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
  voided: 'bg-gray-100 text-gray-500',
};

const RECIPIENT_STATUS_COLORS: Record<ContractRecipientStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-indigo-100 text-indigo-700',
  signed: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  delegated: 'bg-purple-100 text-purple-700',
};

interface Recipient {
  id: string;
  name: string;
  email: string;
  role: string;
  signing_order: number;
  status: ContractRecipientStatus;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  actor_type: string;
  actor_name: string | null;
  ip_address: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface DocumentDetail {
  id: string;
  title: string;
  description: string | null;
  status: ContractDocumentStatus;
  original_file_name: string;
  signing_order_type: string;
  page_count: number;
  sender_email: string | null;
  created_at: string;
  sent_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  recipients: Recipient[];
  fields: unknown[];
  source: string | null;
  project_name: string | null;
  owner?: { id: string; full_name: string | null; email: string } | null;
  send_completed_copy_to_sender: boolean;
  send_completed_copy_to_recipients: boolean;
  notify_on_view: boolean;
  notify_on_sign: boolean;
  notify_on_decline: boolean;
}

export function DocumentDetailClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [gmailConnections, setGmailConnections] = useState<Array<{ id: string; email: string }>>([]);
  const [selectedConnection, setSelectedConnection] = useState('');
  const [sendMessage, setSendMessage] = useState('');

  const sendMessageEditor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({
        placeholder: 'Add a personal message to include in the signing invitation email...',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] px-3 py-2',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setSendMessage(html === '<p></p>' ? '' : html);
    },
  });

  // New recipient form
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [newRecipientRole, setNewRecipientRole] = useState<'signer'>('signer');
  const [newRecipientOrder, setNewRecipientOrder] = useState(1);

  const loadDocument = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (!res.ok) throw new Error('Failed to fetch document');
      const data = await res.json();
      setDocument(data.document ?? data.contract);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const loadAuditTrail = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${id}/audit-trail`);
      if (res.ok) {
        const data = await res.json();
        setAuditTrail(data.audit_trail);
      }
    } catch {
      // Non-critical
    }
  }, [id]);

  const loadGmailConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/gmail/connections');
      if (res.ok) {
        const data = await res.json();
        const active = (data.connections ?? []).filter(
          (c: { status: string }) => c.status === 'connected'
        );
        setGmailConnections(active);
        if (active.length > 0) {
          setSelectedConnection(active[0].id);
        }
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    loadDocument();
    loadAuditTrail();
  }, [loadDocument, loadAuditTrail]);

  const handleSend = async () => {
    if (!selectedConnection) return;
    setActionLoading('send');
    try {
      const res = await fetch(`/api/documents/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmail_connection_id: selectedConnection,
          message: sendMessage || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? 'Operation failed');
      }
      setShowSendDialog(false);
      setSendMessage('');
      sendMessageEditor?.commands.setContent('');
      loadDocument();
      loadAuditTrail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClone = async () => {
    setActionLoading('clone');
    try {
      const res = await fetch(`/api/documents/${id}/clone`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? 'Failed to clone');
      }
      const { id: newId } = await res.json();
      router.push(`/documents/${newId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone');
    } finally {
      setActionLoading(null);
    }
  };

  const handleVoid = async () => {
    setActionLoading('void');
    try {
      const res = await fetch(`/api/documents/${id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? 'Operation failed');
      }
      setShowVoidDialog(false);
      loadDocument();
      loadAuditTrail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Void failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemind = async () => {
    setActionLoading('remind');
    try {
      const res = await fetch(`/api/documents/${id}/remind`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? 'Operation failed');
      }
      loadDocument();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remind failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async (version: 'latest' | 'original' = 'latest') => {
    window.open(`/api/documents/${id}/download?version=${version}`, '_blank');
  };

  const handleAddRecipient = async () => {
    if (!newRecipientName.trim() || !newRecipientEmail.trim()) return;
    setActionLoading('add-recipient');
    try {
      const res = await fetch(`/api/documents/${id}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRecipientName.trim(),
          email: newRecipientEmail.trim(),
          role: newRecipientRole,
          signing_order: newRecipientOrder,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? 'Operation failed');
      }
      setShowAddRecipient(false);
      setNewRecipientName('');
      setNewRecipientEmail('');
      setNewRecipientRole('signer');
      setNewRecipientOrder(1);
      loadDocument();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add recipient');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveRecipient = async (rid: string) => {
    setActionLoading(`remove-recipient:${rid}`);
    try {
      const res = await fetch(`/api/documents/${id}/recipients/${rid}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? 'Failed to remove recipient');
      }
      await loadDocument();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove recipient');
    } finally {
      setActionLoading(null);
    }
  };

  const openAddRecipientDialog = () => {
    const nextOrder = Math.max(0, ...(document?.recipients?.map((r) => r.signing_order) ?? [])) + 1;
    setNewRecipientOrder(nextOrder);
    setNewRecipientName('');
    setNewRecipientEmail('');
    setShowAddRecipient(true);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!document) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground">Document not found</p>
        <Button variant="link" asChild><Link href="/documents">Back to documents</Link></Button>
      </div>
    );
  }

  const isDraft = document.status === 'draft';
  const isActive = ['sent', 'viewed', 'partially_signed'].includes(document.status);
  const signers = document.recipients.filter((r) => r.role === 'signer');
  const hasRecipients = signers.length > 0;
  const hasFields = document.fields.length > 0;
  const canSendDraft = hasRecipients && hasFields;
  const setupMessage = searchParams.get('setup') === 'recipients'
    ? 'Add at least one signer before opening the field editor.'
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/documents">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{document.title}</h1>
              <Badge className={STATUS_COLORS[document.status]}>
                {DOCUMENT_STATUS_LABELS[document.status]}
              </Badge>
            </div>
            {document.description && (
              <p className="text-sm text-muted-foreground mt-1">{document.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleDownload()}>
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
          {isDraft && (
            <>
              {hasRecipients ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/documents/${id}/edit`}>
                    <PenTool className="mr-2 h-4 w-4" /> Edit Fields
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled title="Add at least one signer first">
                  <PenTool className="mr-2 h-4 w-4" /> Edit Fields
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  loadGmailConnections();
                  setShowSendDialog(true);
                }}
                disabled={!canSendDraft}
                title={!hasRecipients ? 'Add at least one signer first' : !hasFields ? 'Place at least one field first' : undefined}
              >
                <Send className="mr-2 h-4 w-4" /> Send for Signing
              </Button>
            </>
          )}
          {isActive && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemind}
                disabled={actionLoading === 'remind'}
              >
                {actionLoading === 'remind' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                Send Reminder
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowVoidDialog(true)}
              >
                <Ban className="mr-2 h-4 w-4" /> Void
              </Button>
            </>
          )}
          {!isDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClone}
              disabled={actionLoading === 'clone'}
            >
              {actionLoading === 'clone' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
              Clone as New
            </Button>
          )}
        </div>
      </div>

      {(error || setupMessage) && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">
          {error ?? setupMessage}
          {error && (
            <Button variant="ghost" size="sm" className="ml-2" onClick={() => setError(null)}>Dismiss</Button>
          )}
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recipients">Recipients ({document.recipients.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail ({auditTrail.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {isDraft && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Draft Setup</CardTitle>
                <CardDescription>Finish these steps before sending the document for signature.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="font-medium text-sm">1. Add signer recipients</p>
                    <p className="text-sm text-muted-foreground">
                      {hasRecipients ? `${signers.length} signer${signers.length === 1 ? '' : 's'} added` : 'No signers added yet'}
                    </p>
                  </div>
                  {!hasRecipients && (
                    <Button size="sm" variant="outline" onClick={openAddRecipientDialog}>
                      <Plus className="mr-2 h-4 w-4" /> Add Recipient
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="font-medium text-sm">2. Place signing fields</p>
                    <p className="text-sm text-muted-foreground">
                      {hasFields ? `${document.fields.length} field${document.fields.length === 1 ? '' : 's'} placed` : 'No fields placed yet'}
                    </p>
                  </div>
                  {hasRecipients ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/documents/${id}/edit`}>
                        <PenTool className="mr-2 h-4 w-4" /> Edit Fields
                      </Link>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      <PenTool className="mr-2 h-4 w-4" /> Edit Fields
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="font-medium text-sm">3. Send for signing</p>
                    <p className="text-sm text-muted-foreground">
                      {canSendDraft ? 'Ready to send' : 'Complete the first two steps to unlock sending'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      loadGmailConnections();
                      setShowSendDialog(true);
                    }}
                    disabled={!canSendDraft}
                  >
                    <Send className="mr-2 h-4 w-4" /> Send
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Document Info */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Document Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">File</dt>
                    <dd className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" /> {document.original_file_name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Pages</dt>
                    <dd className="font-medium">{document.page_count}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Signing Order</dt>
                    <dd className="font-medium capitalize">{document.signing_order_type}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Fields Placed</dt>
                    <dd className="font-medium">{document.fields.length}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="font-medium">{document.project_name ?? 'Standalone'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="font-medium">{formatDate(document.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Sent</dt>
                    <dd className="font-medium">{formatDate(document.sent_at)}</dd>
                  </div>
                  {document.completed_at && (
                    <div>
                      <dt className="text-muted-foreground">Completed</dt>
                      <dd className="font-medium">{formatDate(document.completed_at)}</dd>
                    </div>
                  )}
                  {document.sender_email && (
                    <div>
                      <dt className="text-muted-foreground">Sent via</dt>
                      <dd className="font-medium">{document.sender_email}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Sidebar (right column) */}
            <div className="space-y-6 pb-20">
          {/* Completion Email Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Completion Emails</CardTitle>
              <CardDescription>Control who receives a copy of the signed document when all parties have signed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm">Send signed copy to sender</span>
                <input
                  type="checkbox"
                  checked={document.send_completed_copy_to_sender}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    const prev = document.send_completed_copy_to_sender;
                    setDocument((c) => c ? { ...c, send_completed_copy_to_sender: val } : c);
                    try {
                      const res = await fetch(`/api/documents/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ send_completed_copy_to_sender: val }),
                      });
                      if (!res.ok) throw new Error();
                    } catch {
                      setDocument((c) => c ? { ...c, send_completed_copy_to_sender: prev } : c);
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm">Send signed copy to recipients</span>
                <input
                  type="checkbox"
                  checked={document.send_completed_copy_to_recipients}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    const prev = document.send_completed_copy_to_recipients;
                    setDocument((c) => c ? { ...c, send_completed_copy_to_recipients: val } : c);
                    try {
                      const res = await fetch(`/api/documents/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ send_completed_copy_to_recipients: val }),
                      });
                      if (!res.ok) throw new Error();
                    } catch {
                      setDocument((c) => c ? { ...c, send_completed_copy_to_recipients: prev } : c);
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </label>
            </CardContent>
          </Card>

          {/* Owner Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notifications</CardTitle>
              <CardDescription>Get notified when signers interact with this document.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {([
                { key: 'notify_on_view' as const, label: 'When a signer views' },
                { key: 'notify_on_sign' as const, label: 'When a signer signs' },
                { key: 'notify_on_decline' as const, label: 'When a signer declines' },
              ]).map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <input
                    type="checkbox"
                    checked={document[key]}
                    onChange={async (e) => {
                      const val = e.target.checked;
                      const prev = document[key];
                      setDocument((c) => c ? { ...c, [key]: val } : c);
                      try {
                        const res = await fetch(`/api/documents/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ [key]: val }),
                        });
                        if (!res.ok) throw new Error();
                      } catch {
                        setDocument((c) => c ? { ...c, [key]: prev } : c);
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </label>
              ))}
            </CardContent>
          </Card>

          {/* Signing Progress */}
          {!isDraft && signers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signing Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {signers.map((signer) => (
                    <div key={signer.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        {signer.status === 'signed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : signer.status === 'declined' ? (
                          <XCircle className="h-5 w-5 text-red-600" />
                        ) : signer.status === 'viewed' ? (
                          <Eye className="h-5 w-5 text-indigo-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-gray-400" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{signer.name}</p>
                          <p className="text-xs text-muted-foreground">{signer.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {document.signing_order_type === 'sequential' && (
                          <span className="text-xs text-muted-foreground">Step {signer.signing_order}</span>
                        )}
                        <Badge className={RECIPIENT_STATUS_COLORS[signer.status]} variant="secondary">
                          {RECIPIENT_STATUS_LABELS[signer.status]}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          </div>{/* end sidebar */}
          </div>{/* end grid */}
        </TabsContent>

        <TabsContent value="recipients" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Recipients</CardTitle>
                <CardDescription>Manage who needs to sign or receive this document</CardDescription>
              </div>
              {isDraft && (
                <Button size="sm" onClick={openAddRecipientDialog}>
                  <Plus className="mr-2 h-4 w-4" /> Add Recipient
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {document.recipients.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 space-y-3">
                  <p>No recipients added yet. Add at least one signer to place fields and send this document.</p>
                  {isDraft && (
                    <Button size="sm" onClick={openAddRecipientDialog}>
                      <Plus className="mr-2 h-4 w-4" /> Add Recipient
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {document.recipients.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-3 px-4 border rounded-md">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium text-sm">{r.name}</p>
                          <p className="text-xs text-muted-foreground">{r.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="capitalize">{r.role}</Badge>
                        {document.signing_order_type === 'sequential' && (
                          <span className="text-xs text-muted-foreground">Order: {r.signing_order}</span>
                        )}
                        <Badge className={RECIPIENT_STATUS_COLORS[r.status]} variant="secondary">
                          {RECIPIENT_STATUS_LABELS[r.status]}
                        </Badge>
                        {isDraft && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            disabled={actionLoading === `remove-recipient:${r.id}`}
                            onClick={() => handleRemoveRecipient(r.id)}
                          >
                            {actionLoading === `remove-recipient:${r.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" /> Audit Trail
              </CardTitle>
              <CardDescription>Legal record of all document events</CardDescription>
            </CardHeader>
            <CardContent>
              {auditTrail.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No events recorded yet</p>
              ) : (
                <div className="space-y-4">
                  {auditTrail.map((entry) => (
                    <div key={entry.id} className="flex gap-4 text-sm border-b pb-3 last:border-0">
                      <div className="flex-shrink-0 text-muted-foreground w-36">
                        {formatDate(entry.created_at)}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{entry.action.replace(/_/g, ' ')}</p>
                        {entry.actor_name && (
                          <p className="text-xs text-muted-foreground">by {entry.actor_name} ({entry.actor_type})</p>
                        )}
                        {entry.ip_address && (
                          <p className="text-xs text-muted-foreground">IP: {entry.ip_address}</p>
                        )}
                        {entry.details && Object.keys(entry.details).length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {Object.entries(entry.details).map(([key, val]) => (
                              <span key={key} className="inline-block mr-3">
                                <span className="capitalize">{key.replace(/_/g, ' ')}</span>: {String(val)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Send Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send for Signing</DialogTitle>
            <DialogDescription>
              Choose a Gmail connection to send the signing invitations from.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md border bg-muted/40 px-3 py-3 text-sm">
              <p className="font-medium">Ready to send</p>
              <p className="text-muted-foreground mt-1">
                {signers.length} signer{signers.length === 1 ? '' : 's'} and {document.fields.length} field{document.fields.length === 1 ? '' : 's'} configured.
              </p>
            </div>
            <div>
              <Label>Send from</Label>
              {gmailConnections.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1">
                  No Gmail connections found. Connect one in Settings first.
                </p>
              ) : (
                <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select connection" />
                  </SelectTrigger>
                  <SelectContent>
                    {gmailConnections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Message (optional)</Label>
              <div className="mt-1 rounded-md border">
                {sendMessageEditor && (
                  <>
                    <div className="flex items-center gap-0.5 border-b px-1 py-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => sendMessageEditor.chain().focus().toggleBold().run()}
                        data-active={sendMessageEditor.isActive('bold') || undefined}
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => sendMessageEditor.chain().focus().toggleItalic().run()}
                        data-active={sendMessageEditor.isActive('italic') || undefined}
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => sendMessageEditor.chain().focus().toggleBulletList().run()}
                        data-active={sendMessageEditor.isActive('bulletList') || undefined}
                      >
                        <List className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => sendMessageEditor.chain().focus().toggleOrderedList().run()}
                        data-active={sendMessageEditor.isActive('orderedList') || undefined}
                      >
                        <ListOrdered className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <EditorContent editor={sendMessageEditor} />
                  </>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSend}
              disabled={!selectedConnection || actionLoading === 'send'}
            >
              {actionLoading === 'send' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Invitations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Recipient Dialog */}
      <Dialog open={showAddRecipient} onOpenChange={setShowAddRecipient}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Recipient</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input value={newRecipientName} onChange={(e) => setNewRecipientName(e.target.value)} placeholder="John Doe" className="mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={newRecipientEmail} onChange={(e) => setNewRecipientEmail(e.target.value)} placeholder="john@example.com" className="mt-1" type="email" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Role</Label>
                <Select value={newRecipientRole} onValueChange={(v) => setNewRecipientRole(v as 'signer')}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="signer">Signer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Signing Order</Label>
                <Input
                  type="number"
                  min={1}
                  value={newRecipientOrder}
                  onChange={(e) => setNewRecipientOrder(parseInt(e.target.value) || 1)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRecipient(false)}>Cancel</Button>
            <Button
              onClick={handleAddRecipient}
              disabled={!newRecipientName.trim() || !newRecipientEmail.trim() || actionLoading === 'add-recipient'}
            >
              {actionLoading === 'add-recipient' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Recipient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Document</AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate all signing tokens. Signers will no longer be able to sign. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} className="bg-destructive text-destructive-foreground">
              {actionLoading === 'void' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
              Void Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
