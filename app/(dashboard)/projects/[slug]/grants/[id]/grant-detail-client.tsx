'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Award, CalendarClock, DollarSign, FileText, Mail, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GrantComplianceCard } from '@/components/community/reports/grant-compliance';
import { SendEmailModal } from '@/components/gmail';

interface GrantDetail {
  id: string;
  name: string;
  status: string;
  amount_requested: number | null;
  amount_awarded: number | null;
  loi_due_at: string | null;
  application_due_at: string | null;
  report_due_at: string | null;
  funder_organization_id: string | null;
  contact_person_id: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  funder?: { id: string; name: string } | null;
  contact?: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
}

interface OutreachRecord {
  id: string;
  subject: string;
  body_html: string | null;
  created_at: string;
  person?: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
}

const STATUSES = [
  { value: 'researching', label: 'Researching' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'declined', label: 'Declined' },
];

const STATUS_COLORS: Record<string, string> = {
  researching: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  preparing: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  submitted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  under_review: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  awarded: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  declined: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

function formatCurrency(amount: number | null) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function GrantDetailClient() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const router = useRouter();
  const [grant, setGrant] = useState<GrantDetail | null>(null);
  const [outreach, setOutreach] = useState<OutreachRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSendEmail, setShowSendEmail] = useState(false);

  // Editable fields
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editAmountRequested, setEditAmountRequested] = useState('');
  const [editAmountAwarded, setEditAmountAwarded] = useState('');
  const [editLoiDueAt, setEditLoiDueAt] = useState('');
  const [editApplicationDueAt, setEditApplicationDueAt] = useState('');
  const [editReportDueAt, setEditReportDueAt] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const populateForm = (g: GrantDetail) => {
    setEditName(g.name);
    setEditStatus(g.status);
    setEditAmountRequested(g.amount_requested?.toString() ?? '');
    setEditAmountAwarded(g.amount_awarded?.toString() ?? '');
    setEditLoiDueAt(g.loi_due_at?.split('T')[0] ?? '');
    setEditApplicationDueAt(g.application_due_at?.split('T')[0] ?? '');
    setEditReportDueAt(g.report_due_at?.split('T')[0] ?? '');
    setEditNotes(g.notes ?? '');
  };

  const fetchGrant = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [grantRes, outreachRes] = await Promise.all([
        fetch(`/api/projects/${slug}/grants/${id}`),
        fetch(`/api/projects/${slug}/grants/${id}/outreach`),
      ]);

      const grantJson = await grantRes.json() as { grant?: GrantDetail; error?: string };
      if (!grantRes.ok) throw new Error(grantJson.error ?? 'Failed to fetch grant');
      setGrant(grantJson.grant ?? null);
      if (grantJson.grant) populateForm(grantJson.grant);

      const outreachJson = await outreachRes.json() as { outreach?: OutreachRecord[] };
      setOutreach(outreachJson.outreach ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch grant');
    } finally {
      setIsLoading(false);
    }
  }, [slug, id]);

  useEffect(() => { fetchGrant(); }, [fetchGrant]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editName,
        status: editStatus,
        notes: editNotes || null,
        loi_due_at: editLoiDueAt || null,
        application_due_at: editApplicationDueAt || null,
        report_due_at: editReportDueAt || null,
      };
      if (editAmountRequested) body.amount_requested = parseFloat(editAmountRequested);
      else body.amount_requested = null;
      if (editAmountAwarded) body.amount_awarded = parseFloat(editAmountAwarded);
      else body.amount_awarded = null;

      const res = await fetch(`/api/projects/${slug}/grants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json() as { grant?: GrantDetail; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to save');
      if (json.grant) {
        setGrant(json.grant);
        populateForm(json.grant);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this grant?')) return;
    try {
      const res = await fetch(`/api/projects/${slug}/grants/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? 'Failed to delete');
      }
      router.push(`/projects/${slug}/grants`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleOutreachEmailSuccess = useCallback(async () => {
    // Also log the sent email as grant outreach so it appears in the history
    if (grant?.contact?.id) {
      try {
        await fetch(`/api/projects/${slug}/grants/${id}/outreach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_person_id: grant.contact.id,
            subject: 'Email sent',
            body: 'Outreach email sent via Gmail',
          }),
        });
      } catch {
        // Non-critical — email was already sent
      }
    }
    // Refresh outreach list
    try {
      const res = await fetch(`/api/projects/${slug}/grants/${id}/outreach`);
      const json = await res.json() as { outreach?: OutreachRecord[] };
      setOutreach(json.outreach ?? []);
    } catch {
      // Silently fail — outreach list will refresh on next page load
    }
  }, [slug, id, grant?.contact?.id]);

  if (isLoading) return null;
  if (!grant) return (
    <div className="text-center py-12 text-muted-foreground">Grant not found</div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${slug}/grants`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" /> Grants
            </Button>
          </Link>
          <Award className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-2xl font-bold">{grant.name}</h2>
          <Badge className={STATUS_COLORS[grant.status] ?? ''}>
            {STATUSES.find((s) => s.value === grant.status)?.label ?? grant.status}
          </Badge>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-1 h-4 w-4" /> Delete
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Requested</p>
              <p className="text-xl font-bold">{formatCurrency(grant.amount_requested)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Awarded</p>
              <p className="text-xl font-bold">{formatCurrency(grant.amount_awarded)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CalendarClock className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Next Deadline</p>
              <p className="text-xl font-bold">
                {formatDate(grant.loi_due_at ?? grant.application_due_at ?? grant.report_due_at)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info"><FileText className="mr-1 h-4 w-4" />Info</TabsTrigger>
          <TabsTrigger value="outreach"><Mail className="mr-1 h-4 w-4" />Outreach</TabsTrigger>
          <TabsTrigger value="compliance"><Award className="mr-1 h-4 w-4" />Compliance</TabsTrigger>
          <TabsTrigger value="deadlines"><CalendarClock className="mr-1 h-4 w-4" />Deadlines</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Grant Details</CardTitle>
              <CardDescription>Edit grant information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Grant Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={200} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount Requested</Label>
                  <Input type="number" min="0" step="0.01" value={editAmountRequested} onChange={(e) => setEditAmountRequested(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount Awarded</Label>
                  <Input type="number" min="0" step="0.01" value={editAmountAwarded} onChange={(e) => setEditAmountAwarded(e.target.value)} />
                </div>
              </div>

              {grant.funder && (
                <div className="space-y-2">
                  <Label>Funder</Label>
                  <p className="text-sm">{grant.funder.name}</p>
                </div>
              )}

              {grant.contact && (
                <div className="space-y-2">
                  <Label>Contact</Label>
                  <p className="text-sm">
                    {[grant.contact.first_name, grant.contact.last_name].filter(Boolean).join(' ')}
                    {grant.contact.email && <span className="text-muted-foreground ml-2">({grant.contact.email})</span>}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={4} maxLength={5000} />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outreach">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Outreach History</CardTitle>
                <CardDescription>Communication with grantor contacts</CardDescription>
              </div>
              {grant.contact?.email && (
                <Button size="sm" onClick={() => setShowSendEmail(true)}>
                  <Mail className="mr-1 h-4 w-4" /> Send Email
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!grant.contact?.email && (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground mb-4">
                  Add a contact person with an email address to this grant to send outreach emails.
                </div>
              )}
              {outreach.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No outreach recorded yet. Send an email above or use the chat assistant to draft outreach.
                </div>
              ) : (
                <div className="space-y-3">
                  {outreach.map((item) => (
                    <div key={item.id} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{item.subject}</h4>
                        <span className="text-sm text-muted-foreground">{formatDate(item.created_at)}</span>
                      </div>
                      {item.person && (
                        <p className="text-sm text-muted-foreground mt-1">
                          To: {[item.person.first_name, item.person.last_name].filter(Boolean).join(' ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <GrantComplianceCard grantId={grant.id} />
        </TabsContent>

        <TabsContent value="deadlines">
          <Card>
            <CardHeader>
              <CardTitle>Deadlines</CardTitle>
              <CardDescription>Track key grant milestones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>LOI Deadline</Label>
                  <Input type="date" value={editLoiDueAt} onChange={(e) => setEditLoiDueAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Application Deadline</Label>
                  <Input type="date" value={editApplicationDueAt} onChange={(e) => setEditApplicationDueAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Report Deadline</Label>
                  <Input type="date" value={editReportDueAt} onChange={(e) => setEditReportDueAt(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Deadlines'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {grant.contact?.email && (
        <SendEmailModal
          open={showSendEmail}
          onOpenChange={setShowSendEmail}
          projectSlug={slug}
          defaultTo={grant.contact.email}
          personId={grant.contact.id}
          organizationId={grant.funder_organization_id ?? undefined}
          onSuccess={handleOutreachEmailSuccess}
        />
      )}
    </div>
  );
}
