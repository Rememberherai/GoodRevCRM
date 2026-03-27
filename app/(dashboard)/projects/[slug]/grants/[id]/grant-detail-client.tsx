'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Award, BookOpen, CalendarClock, ChevronDown, ChevronRight, ClipboardList, DollarSign, Download, ExternalLink, FileText, Mail, Paperclip, Plus, Save, Search, Star, Trash2, Upload, UserPlus, X } from 'lucide-react';
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
import { PersonCombobox } from '@/components/ui/person-combobox';
import { OrganizationCombobox } from '@/components/ui/organization-combobox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ANSWER_BANK_CATEGORIES, type AnswerBankEntry } from '@/components/grants/answer-bank/answer-bank-page-client';

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
  // Strategic planning fields
  category: string | null;
  funding_range_min: number | null;
  funding_range_max: number | null;
  mission_fit: number | null;
  tier: number | null;
  key_intel: string | null;
  recommended_strategy: string | null;
  application_url: string | null;
  urgency: string | null;
  created_at: string;
  updated_at: string;
  // Post-award fields
  award_number: string | null;
  funder_grant_id: string | null;
  award_period_start: string | null;
  award_period_end: string | null;
  total_award_amount: number | null;
  match_required: number | null;
  match_type: string | null;
  indirect_cost_rate: number | null;
  agreement_status: string | null;
  closeout_date: string | null;
  program_id: string | null;
  contract_document_id: string | null;
  funder?: { id: string; name: string } | null;
  contact?: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
}

interface GrantDocument {
  id: string;
  grant_id: string;
  document_type: string;
  label: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  version: number;
  is_required: boolean;
  is_submitted: boolean;
  notes: string | null;
  created_at: string;
}

interface ReportSchedule {
  id: string;
  grant_id: string;
  report_type: string;
  title: string;
  due_date: string;
  submitted_at: string | null;
  status: string;
  document_id: string | null;
  notes: string | null;
  created_at: string;
}

interface OutreachRecord {
  id: string;
  subject: string;
  body_html: string | null;
  created_at: string;
  person?: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
}

interface GrantContact {
  id: string;
  role: string | null;
  notes: string | null;
  created_at: string;
  person: { id: string; first_name: string | null; last_name: string | null; email: string | null; title: string | null } | null;
}

const STANDARD_ROLES = [
  'Program Officer',
  'Internal Lead',
  'Co-Applicant',
  'Board Sponsor',
  'Fiscal Agent',
  'Evaluator',
  'Grants Writer',
  'Legal / Compliance',
  'Finance Contact',
  'Other',
];

const STATUSES = [
  { value: 'researching', label: 'Researching' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'declined', label: 'Declined' },
];

const CATEGORIES = [
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'State' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'individual', label: 'Individual' },
];

const URGENCY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' },
];

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Tier 1', color: 'bg-green-100 text-green-700' },
  2: { label: 'Tier 2', color: 'bg-yellow-100 text-yellow-700' },
  3: { label: 'Tier 3', color: 'bg-slate-100 text-slate-700' },
};

const STATUS_COLORS: Record<string, string> = {
  researching: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  preparing: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  submitted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  under_review: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  awarded: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  declined: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const DOCUMENT_TYPES = [
  { value: 'narrative', label: 'Narrative' },
  { value: 'budget', label: 'Budget' },
  { value: 'support_letter', label: 'Support Letter' },
  { value: 'irs_determination', label: 'IRS Determination' },
  { value: 'board_list', label: 'Board List' },
  { value: 'financial_audit', label: 'Financial Audit' },
  { value: 'logic_model', label: 'Logic Model' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'mou', label: 'MOU' },
  { value: 'funder_agreement', label: 'Funder Agreement' },
  { value: 'report', label: 'Report' },
  { value: 'amendment', label: 'Amendment' },
  { value: 'other', label: 'Other' },
];

const MATCH_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'in_kind', label: 'In-Kind' },
  { value: 'either', label: 'Cash or In-Kind' },
];

const AGREEMENT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'executed', label: 'Executed' },
  { value: 'amended', label: 'Amended' },
  { value: 'expired', label: 'Expired' },
];

const REPORT_TYPES = [
  { value: 'progress', label: 'Progress' },
  { value: 'financial', label: 'Financial' },
  { value: 'final', label: 'Final' },
  { value: 'interim', label: 'Interim' },
  { value: 'annual', label: 'Annual' },
  { value: 'closeout', label: 'Closeout' },
  { value: 'other', label: 'Other' },
];

const REPORT_STATUSES = [
  { value: 'upcoming', label: 'Upcoming', color: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  { value: 'submitted', label: 'Submitted', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'accepted', label: 'Accepted', color: 'bg-green-100 text-green-700' },
  { value: 'revision_requested', label: 'Revision Requested', color: 'bg-red-100 text-red-700' },
];

function formatCurrency(amount: number | null) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

/** Parse date string as local time (avoids UTC off-by-one for date-only strings like YYYY-MM-DD). */
function parseLocalDate(dateStr: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr + 'T00:00:00');
  return new Date(dateStr);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GrantDetailClient() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const router = useRouter();
  const [grant, setGrant] = useState<GrantDetail | null>(null);
  const [outreach, setOutreach] = useState<OutreachRecord[]>([]);
  const [documents, setDocuments] = useState<GrantDocument[]>([]);
  const [reports, setReports] = useState<ReportSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSendEmail, setShowSendEmail] = useState(false);
  // Grant contacts (multi-contact junction table)
  const [contacts, setContacts] = useState<GrantContact[]>([]);
  const [addContactPersonId, setAddContactPersonId] = useState<string | null>(null);
  const [addContactRole, setAddContactRole] = useState('');
  const [addContactRoleCustom, setAddContactRoleCustom] = useState('');
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [emailTargetContact, setEmailTargetContact] = useState<GrantContact | null>(null);
  const [showPostAward, setShowPostAward] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadDocType, setUploadDocType] = useState('other');
  const [uploadLabel, setUploadLabel] = useState('');
  const [showAddReport, setShowAddReport] = useState(false);
  const [newReportType, setNewReportType] = useState('progress');
  const [newReportTitle, setNewReportTitle] = useState('');
  const [newReportDueDate, setNewReportDueDate] = useState('');

  // Editable fields
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editAmountRequested, setEditAmountRequested] = useState('');
  const [editAmountAwarded, setEditAmountAwarded] = useState('');
  const [editLoiDueAt, setEditLoiDueAt] = useState('');
  const [editApplicationDueAt, setEditApplicationDueAt] = useState('');
  const [editReportDueAt, setEditReportDueAt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editFunderOrgId, setEditFunderOrgId] = useState<string | null>(null);
  // Strategic planning editable fields
  const [editCategory, setEditCategory] = useState('');
  const [editFundingRangeMin, setEditFundingRangeMin] = useState('');
  const [editFundingRangeMax, setEditFundingRangeMax] = useState('');
  const [editMissionFit, setEditMissionFit] = useState('');
  const [editTier, setEditTier] = useState('');
  const [editKeyIntel, setEditKeyIntel] = useState('');
  const [editRecommendedStrategy, setEditRecommendedStrategy] = useState('');
  const [editApplicationUrl, setEditApplicationUrl] = useState('');
  const [editUrgency, setEditUrgency] = useState('');
  // Post-award editable fields
  const [editAwardNumber, setEditAwardNumber] = useState('');
  const [editFunderGrantId, setEditFunderGrantId] = useState('');
  const [editAwardPeriodStart, setEditAwardPeriodStart] = useState('');
  const [editAwardPeriodEnd, setEditAwardPeriodEnd] = useState('');
  const [editTotalAwardAmount, setEditTotalAwardAmount] = useState('');
  const [editMatchRequired, setEditMatchRequired] = useState('');
  const [editMatchType, setEditMatchType] = useState('');
  const [editIndirectCostRate, setEditIndirectCostRate] = useState('');
  const [editAgreementStatus, setEditAgreementStatus] = useState('');
  const [editCloseoutDate, setEditCloseoutDate] = useState('');

  // Answer Bank state
  const [answerBankOpen, setAnswerBankOpen] = useState(false);
  const [answerBankTarget, setAnswerBankTarget] = useState<'notes' | 'key_intel'>('notes');
  const [answerBankSearch, setAnswerBankSearch] = useState('');
  const [answerBankEntries, setAnswerBankEntries] = useState<AnswerBankEntry[]>([]);
  const [answerBankLoading, setAnswerBankLoading] = useState(false);
  const [saveToAnswerBankOpen, setSaveToAnswerBankOpen] = useState(false);
  const [saveAnswerBankTitle, setSaveAnswerBankTitle] = useState('');
  const [saveAnswerBankCategory, setSaveAnswerBankCategory] = useState('other');

  const populateForm = (g: GrantDetail) => {
    setEditName(g.name);
    setEditStatus(g.status);
    setEditAmountRequested(g.amount_requested?.toString() ?? '');
    setEditAmountAwarded(g.amount_awarded?.toString() ?? '');
    setEditLoiDueAt(g.loi_due_at?.split('T')[0] ?? '');
    setEditApplicationDueAt(g.application_due_at?.split('T')[0] ?? '');
    setEditReportDueAt(g.report_due_at?.split('T')[0] ?? '');
    setEditNotes(g.notes ?? '');
    setEditFunderOrgId(g.funder_organization_id);
    // Strategic planning
    setEditCategory(g.category ?? '');
    setEditFundingRangeMin(g.funding_range_min?.toString() ?? '');
    setEditFundingRangeMax(g.funding_range_max?.toString() ?? '');
    setEditMissionFit(g.mission_fit?.toString() ?? '');
    setEditTier(g.tier?.toString() ?? '');
    setEditKeyIntel(g.key_intel ?? '');
    setEditRecommendedStrategy(g.recommended_strategy ?? '');
    setEditApplicationUrl(g.application_url ?? '');
    setEditUrgency(g.urgency ?? '');
    // Post-award
    setEditAwardNumber(g.award_number ?? '');
    setEditFunderGrantId(g.funder_grant_id ?? '');
    setEditAwardPeriodStart(g.award_period_start?.split('T')[0] ?? '');
    setEditAwardPeriodEnd(g.award_period_end?.split('T')[0] ?? '');
    setEditTotalAwardAmount(g.total_award_amount?.toString() ?? '');
    setEditMatchRequired(g.match_required?.toString() ?? '');
    setEditMatchType(g.match_type ?? '');
    setEditIndirectCostRate(g.indirect_cost_rate != null ? (g.indirect_cost_rate * 100).toString() : '');
    setEditAgreementStatus(g.agreement_status ?? '');
    setEditCloseoutDate(g.closeout_date?.split('T')[0] ?? '');
    // Auto-expand post-award section if any post-award fields are filled
    if (g.award_number || g.award_period_start || g.total_award_amount || g.agreement_status) {
      setShowPostAward(true);
    }
  };

  const fetchGrant = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [grantRes, outreachRes, docsRes, reportsRes, contactsRes] = await Promise.all([
        fetch(`/api/projects/${slug}/grants/${id}`),
        fetch(`/api/projects/${slug}/grants/${id}/outreach`),
        fetch(`/api/projects/${slug}/grants/${id}/documents`),
        fetch(`/api/projects/${slug}/grants/${id}/reports`),
        fetch(`/api/projects/${slug}/grants/${id}/contacts`),
      ]);

      const grantJson = await grantRes.json() as { grant?: GrantDetail; error?: string };
      if (!grantRes.ok) throw new Error(grantJson.error ?? 'Failed to fetch grant');
      setGrant(grantJson.grant ?? null);
      if (grantJson.grant) populateForm(grantJson.grant);

      const outreachJson = await outreachRes.json() as { outreach?: OutreachRecord[] };
      setOutreach(outreachJson.outreach ?? []);

      const docsJson = await docsRes.json() as { documents?: GrantDocument[] };
      setDocuments(docsJson.documents ?? []);

      const reportsJson = await reportsRes.json() as { reports?: ReportSchedule[] };
      setReports(reportsJson.reports ?? []);

      const contactsJson = await contactsRes.json() as { contacts?: GrantContact[] };
      setContacts(contactsJson.contacts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch grant');
    } finally {
      setIsLoading(false);
    }
  }, [slug, id]);

  useEffect(() => { fetchGrant(); }, [fetchGrant]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: editName,
        status: editStatus,
        notes: editNotes || null,
        loi_due_at: editLoiDueAt || null,
        application_due_at: editApplicationDueAt || null,
        report_due_at: editReportDueAt || null,
        funder_organization_id: editFunderOrgId || null,
        // Strategic planning fields
        category: editCategory || null,
        key_intel: editKeyIntel || null,
        recommended_strategy: editRecommendedStrategy || null,
        application_url: editApplicationUrl || null,
        urgency: editUrgency || null,
        // Post-award fields
        award_number: editAwardNumber || null,
        funder_grant_id: editFunderGrantId || null,
        award_period_start: editAwardPeriodStart || null,
        award_period_end: editAwardPeriodEnd || null,
        match_type: editMatchType || null,
        agreement_status: editAgreementStatus || null,
        closeout_date: editCloseoutDate || null,
      };
      if (editAmountRequested) body.amount_requested = parseFloat(editAmountRequested);
      else body.amount_requested = null;
      if (editAmountAwarded) body.amount_awarded = parseFloat(editAmountAwarded);
      else body.amount_awarded = null;
      if (editFundingRangeMin) body.funding_range_min = parseFloat(editFundingRangeMin);
      else body.funding_range_min = null;
      if (editFundingRangeMax) body.funding_range_max = parseFloat(editFundingRangeMax);
      else body.funding_range_max = null;
      if (editMissionFit) body.mission_fit = parseInt(editMissionFit, 10);
      else body.mission_fit = null;
      if (editTier) body.tier = parseInt(editTier, 10);
      else body.tier = null;
      if (editTotalAwardAmount) body.total_award_amount = parseFloat(editTotalAwardAmount);
      else body.total_award_amount = null;
      if (editMatchRequired) body.match_required = parseFloat(editMatchRequired);
      else body.match_required = null;
      if (editIndirectCostRate) body.indirect_cost_rate = parseFloat(editIndirectCostRate) / 100;
      else body.indirect_cost_rate = null;

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

  const handleUploadDocument = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify({
        document_type: uploadDocType,
        label: uploadLabel || file.name,
      }));

      const res = await fetch(`/api/projects/${slug}/grants/${id}/documents`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json() as { document?: GrantDocument; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to upload');
      if (json.document) {
        setDocuments(prev => [json.document!, ...prev]);
      }
      setUploadLabel('');
      setUploadDocType('other');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleDocFlag = async (docId: string, field: 'is_required' | 'is_submitted', value: boolean) => {
    try {
      const res = await fetch(`/api/projects/${slug}/grants/${id}/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, [field]: value } : d));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update document');
    }
  };

  const handleDownloadDocument = async (docId: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/grants/${id}/documents/${docId}`);
      const json = await res.json() as { download_url?: string; document?: GrantDocument };
      if (json.download_url) {
        const a = document.createElement('a');
        a.href = json.download_url;
        a.download = json.document?.file_name ?? 'download';
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download');
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      const res = await fetch(`/api/projects/${slug}/grants/${id}/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const handleExportPackage = async () => {
    const submittedDocs = documents.filter(d => d.is_submitted);
    if (submittedDocs.length === 0) {
      setError('No documents marked as submitted for the package');
      return;
    }
    // Download each document — for a small nonprofit, sequential downloads are fine
    for (const doc of submittedDocs) {
      await handleDownloadDocument(doc.id);
    }
  };

  const handleAddReport = async () => {
    if (!newReportTitle || !newReportDueDate) return;
    try {
      const res = await fetch(`/api/projects/${slug}/grants/${id}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: newReportType,
          title: newReportTitle,
          due_date: newReportDueDate,
        }),
      });
      const json = await res.json() as { report?: ReportSchedule; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to create');
      if (json.report) setReports(prev => [...prev, json.report!].sort((a, b) => a.due_date.localeCompare(b.due_date)));
      setNewReportTitle('');
      setNewReportDueDate('');
      setNewReportType('progress');
      setShowAddReport(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add report');
    }
  };

  const handleUpdateReportStatus = async (reportId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/grants/${id}/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json() as { report?: ReportSchedule; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to update');
      if (json.report) setReports(prev => prev.map(r => r.id === reportId ? json.report! : r));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update report');
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Delete this report from the schedule?')) return;
    try {
      const res = await fetch(`/api/projects/${slug}/grants/${id}/reports/${reportId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report');
    }
  };

  const handleAddContact = async () => {
    if (!addContactPersonId) return;
    setIsAddingContact(true);
    setContactError(null);
    try {
      const role = addContactRole === 'Other' ? (addContactRoleCustom.trim() || 'Other') : addContactRole;
      const res = await fetch(`/api/projects/${slug}/grants/${id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: addContactPersonId, role: role || null }),
      });
      const json = await res.json() as { contact?: GrantContact; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to add contact');
      if (json.contact) setContacts(prev => [...prev, json.contact!]);
      setAddContactPersonId(null);
      setAddContactRole('');
      setAddContactRoleCustom('');
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    setContactError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/grants/${id}/contacts/${contactId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? 'Failed to remove contact');
      }
      setContacts(prev => prev.filter(c => c.id !== contactId));
      if (emailTargetContact?.id === contactId) setEmailTargetContact(null);
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'Failed to remove contact');
    }
  };

  const openAnswerBank = (target: 'notes' | 'key_intel') => {
    setAnswerBankTarget(target);
    setAnswerBankSearch('');
    setAnswerBankEntries([]);
    setAnswerBankOpen(true);
    fetchAnswerBankEntries('');
  };

  const fetchAnswerBankEntries = async (q: string) => {
    setAnswerBankLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      const res = await fetch(`/api/projects/${slug}/grants/answer-bank?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setAnswerBankEntries(data.entries ?? []);
    } catch {
      // silently fail — picker is non-critical
    } finally {
      setAnswerBankLoading(false);
    }
  };

  const handleInsertFromAnswerBank = async (entry: AnswerBankEntry) => {
    if (answerBankTarget === 'notes') {
      setEditNotes((prev) => prev ? `${prev}\n\n${entry.content}` : entry.content);
    } else {
      setEditKeyIntel((prev) => prev ? `${prev}\n\n${entry.content}` : entry.content);
    }
    setAnswerBankOpen(false);
    fetch(`/api/projects/${slug}/grants/answer-bank/${entry.id}?use=true`, { method: 'PATCH' }).catch(() => {});
  };

  const handleSaveToAnswerBank = async () => {
    if (!saveAnswerBankTitle.trim() || !editNotes.trim()) return;
    try {
      const res = await fetch(`/api/projects/${slug}/grants/answer-bank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: saveAnswerBankTitle.trim(), category: saveAnswerBankCategory, content: editNotes.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save');
      setSaveToAnswerBankOpen(false);
      setSaveAnswerBankTitle('');
      setSaveAnswerBankCategory('other');
      toast.success('Saved to Answer Bank');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const handleOutreachEmailSuccess = useCallback(async () => {
    if (emailTargetContact?.person?.id) {
      try {
        await fetch(`/api/projects/${slug}/grants/${id}/outreach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_person_id: emailTargetContact.person.id,
            subject: 'Email sent',
            body: 'Outreach email sent via Gmail',
          }),
        });
      } catch {
        // Non-critical
      }
    }
    try {
      const res = await fetch(`/api/projects/${slug}/grants/${id}/outreach`);
      const json = await res.json() as { outreach?: OutreachRecord[] };
      setOutreach(json.outreach ?? []);
    } catch {
      // Silently fail
    }
  }, [slug, id, emailTargetContact?.person?.id]);

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
  if (!grant) return (
    <div className="text-center py-12 text-muted-foreground">Grant not found</div>
  );

  const isPostAward = ['awarded', 'active', 'closed'].includes(grant.status);

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
          {grant.category && (
            <Badge variant="outline">{CATEGORIES.find((c) => c.value === grant.category)?.label ?? grant.category}</Badge>
          )}
          {grant.tier && TIER_LABELS[grant.tier] && (
            <Badge className={TIER_LABELS[grant.tier]!.color}>{TIER_LABELS[grant.tier]!.label}</Badge>
          )}
          {grant.urgency && (
            <Badge className={URGENCY_LEVELS.find((u) => u.value === grant.urgency)?.color ?? ''}>
              {URGENCY_LEVELS.find((u) => u.value === grant.urgency)?.label ?? grant.urgency}
            </Badge>
          )}
          {grant.mission_fit && (
            <span className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={`h-3.5 w-3.5 ${n <= grant.mission_fit! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />
              ))}
            </span>
          )}
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
                {(() => {
                  const now = new Date();
                  const upcoming = [grant.loi_due_at, grant.application_due_at, grant.report_due_at]
                    .filter((d): d is string => !!d && parseLocalDate(d) >= now)
                    .sort((a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime());
                  return formatDate(upcoming[0] ?? null);
                })()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info"><FileText className="mr-1 h-4 w-4" />Info</TabsTrigger>
          <TabsTrigger value="documents"><Paperclip className="mr-1 h-4 w-4" />Documents</TabsTrigger>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Funder Organization</Label>
                  <OrganizationCombobox
                    value={editFunderOrgId}
                    onValueChange={setEditFunderOrgId}
                    placeholder="Select funder..."
                  />
                </div>
              </div>

              {/* Contacts */}
              <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Contacts
                </h3>

                {contacts.length > 0 && (
                  <div className="space-y-2">
                    {contacts.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded border bg-background px-3 py-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {[c.person?.first_name, c.person?.last_name].filter(Boolean).join(' ') || 'Unknown'}
                            </p>
                            {c.role && <p className="text-xs text-muted-foreground">{c.role}</p>}
                            {c.person?.email && <p className="text-xs text-muted-foreground">{c.person.email}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {c.person?.email && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Send email"
                              onClick={() => { setEmailTargetContact(c); setShowSendEmail(true); }}
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveContact(c.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add contact form */}
                <div className="flex flex-col gap-2">
                  <PersonCombobox
                    value={addContactPersonId}
                    onValueChange={(v) => { setAddContactPersonId(v); setContactError(null); }}
                    placeholder="Add a contact person..."
                  />
                  {addContactPersonId && (
                    <div className="flex gap-2">
                      <Select value={addContactRole || '__none__'} onValueChange={(v) => setAddContactRole(v === '__none__' ? '' : v)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select role..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No role</SelectItem>
                          {STANDARD_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {addContactRole === 'Other' && (
                        <Input
                          className="flex-1"
                          placeholder="Describe role..."
                          value={addContactRoleCustom}
                          onChange={(e) => setAddContactRoleCustom(e.target.value)}
                          maxLength={200}
                        />
                      )}
                      <Button size="sm" onClick={handleAddContact} disabled={isAddingContact}>
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>
                  )}
                  {contactError && <p className="text-xs text-destructive">{contactError}</p>}
                </div>
              </div>

              {/* Strategic Planning */}
              <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Star className="h-4 w-4" /> Strategic Planning
                </h3>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={editCategory || '__none__'} onValueChange={(v) => setEditCategory(v === '__none__' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tier</Label>
                    <Select value={editTier || '__none__'} onValueChange={(v) => setEditTier(v === '__none__' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        <SelectItem value="1">Tier 1 — Top Priority</SelectItem>
                        <SelectItem value="2">Tier 2 — Strong Fit</SelectItem>
                        <SelectItem value="3">Tier 3 — Worth Watching</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Urgency</Label>
                    <Select value={editUrgency || '__none__'} onValueChange={(v) => setEditUrgency(v === '__none__' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {URGENCY_LEVELS.map((u) => (
                          <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Mission Fit (1–5)</Label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className="p-0.5"
                          onClick={() => setEditMissionFit(editMissionFit === n.toString() ? '' : n.toString())}
                        >
                          <Star className={`h-5 w-5 ${(Number(editMissionFit) || 0) >= n ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Funding Range Min</Label>
                    <Input type="number" min="0" step="1" value={editFundingRangeMin} onChange={(e) => setEditFundingRangeMin(e.target.value)} placeholder="$0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Funding Range Max</Label>
                    <Input type="number" min="0" step="1" value={editFundingRangeMax} onChange={(e) => setEditFundingRangeMax(e.target.value)} placeholder="$0" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Application URL</Label>
                  <div className="flex gap-2">
                    <Input value={editApplicationUrl} onChange={(e) => setEditApplicationUrl(e.target.value)} placeholder="https://..." maxLength={2000} />
                    {editApplicationUrl && (
                      <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => window.open(editApplicationUrl, '_blank')}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Key Intel</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 text-muted-foreground" onClick={() => openAnswerBank('key_intel')}>
                      <BookOpen className="h-3 w-3" />
                      Insert from Answer Bank
                    </Button>
                  </div>
                  <Textarea value={editKeyIntel} onChange={(e) => setEditKeyIntel(e.target.value)} rows={3} maxLength={10000} placeholder="Strategic insights about this funder, recent shifts in priorities, key contacts..." />
                </div>

                <div className="space-y-2">
                  <Label>Recommended Strategy</Label>
                  <Textarea value={editRecommendedStrategy} onChange={(e) => setEditRecommendedStrategy(e.target.value)} rows={3} maxLength={5000} placeholder="Action plan: submit LOI by X, leverage Y connection..." />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Notes</Label>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 text-muted-foreground" onClick={() => openAnswerBank('notes')}>
                      <BookOpen className="h-3 w-3" />
                      Insert from Answer Bank
                    </Button>
                    {editNotes.trim() && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 text-muted-foreground" onClick={() => { setSaveAnswerBankTitle(''); setSaveAnswerBankCategory('other'); setSaveToAnswerBankOpen(true); }}>
                        <Save className="h-3 w-3" />
                        Save to Answer Bank
                      </Button>
                    )}
                  </div>
                </div>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={4} maxLength={5000} />
              </div>

              {/* Post-Award Details (collapsible) */}
              <div className="border rounded-lg">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full p-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
                  onClick={() => setShowPostAward(!showPostAward)}
                >
                  {showPostAward ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Post-Award Details
                  {isPostAward && <Badge variant="outline" className="ml-2 text-xs">Active</Badge>}
                </button>
                {showPostAward && (
                  <div className="p-3 pt-0 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Award Number</Label>
                        <Input value={editAwardNumber} onChange={(e) => setEditAwardNumber(e.target.value)} placeholder="e.g. AWD-2026-001" />
                      </div>
                      <div className="space-y-2">
                        <Label>Funder Grant ID</Label>
                        <Input value={editFunderGrantId} onChange={(e) => setEditFunderGrantId(e.target.value)} placeholder="Funder's internal reference" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Award Period Start</Label>
                        <Input type="date" value={editAwardPeriodStart} onChange={(e) => setEditAwardPeriodStart(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Award Period End</Label>
                        <Input type="date" value={editAwardPeriodEnd} onChange={(e) => setEditAwardPeriodEnd(e.target.value)} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Total Award Amount</Label>
                        <Input type="number" min="0" step="0.01" value={editTotalAwardAmount} onChange={(e) => setEditTotalAwardAmount(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Indirect Cost Rate (%)</Label>
                        <Input type="number" min="0" max="100" step="0.01" value={editIndirectCostRate} onChange={(e) => setEditIndirectCostRate(e.target.value)} placeholder="e.g. 10" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Match Required</Label>
                        <Input type="number" min="0" step="0.01" value={editMatchRequired} onChange={(e) => setEditMatchRequired(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Match Type</Label>
                        <Select value={editMatchType || '__none__'} onValueChange={(v) => setEditMatchType(v === '__none__' ? '' : v)}>
                          <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {MATCH_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Agreement Status</Label>
                        <Select value={editAgreementStatus || '__none__'} onValueChange={(v) => setEditAgreementStatus(v === '__none__' ? '' : v)}>
                          <SelectTrigger><SelectValue placeholder="Select status..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {AGREEMENT_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Closeout Date</Label>
                        <Input type="date" value={editCloseoutDate} onChange={(e) => setEditCloseoutDate(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Documents</CardTitle>
                <CardDescription>Attach and manage grant documents</CardDescription>
              </div>
              <div className="flex gap-2">
                {documents.some(d => d.is_submitted) && (
                  <Button size="sm" variant="outline" onClick={handleExportPackage}>
                    <Download className="mr-1 h-4 w-4" /> Export Package
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload form */}
              <div className="rounded-lg border border-dashed p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Document Type</Label>
                    <Select value={uploadDocType} onValueChange={setUploadDocType}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Label (optional)</Label>
                    <Input className="h-8 text-sm" value={uploadLabel} onChange={(e) => setUploadLabel(e.target.value)} placeholder="Document label" />
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadDocument(file);
                    e.target.value = '';
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="mr-1 h-4 w-4" />
                  {isUploading ? 'Uploading...' : 'Choose File & Upload'}
                </Button>
              </div>

              {/* Document list */}
              {documents.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No documents attached yet. Upload files above.
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {DOCUMENT_TYPES.find(t => t.value === doc.document_type)?.label ?? doc.document_type}
                            {doc.file_size_bytes ? ` · ${formatFileSize(doc.file_size_bytes)}` : ''}
                            {' · '}{formatDate(doc.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={doc.is_required}
                            onChange={(e) => handleToggleDocFlag(doc.id, 'is_required', e.target.checked)}
                            className="h-3 w-3"
                          />
                          Required
                        </label>
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={doc.is_submitted}
                            onChange={(e) => handleToggleDocFlag(doc.id, 'is_submitted', e.target.checked)}
                            className="h-3 w-3"
                          />
                          Submitted
                        </label>
                        <Button size="sm" variant="ghost" onClick={() => handleDownloadDocument(doc.id)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteDocument(doc.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
              {contacts.some(c => c.person?.email) && (
                <div className="flex gap-2 flex-wrap">
                  {contacts.filter(c => c.person?.email).map(c => (
                    <Button
                      key={c.id}
                      size="sm"
                      variant="outline"
                      onClick={() => { setEmailTargetContact(c); setShowSendEmail(true); }}
                    >
                      <Mail className="mr-1 h-4 w-4" />
                      {[c.person?.first_name, c.person?.last_name].filter(Boolean).join(' ')}
                      {c.role ? ` (${c.role})` : ''}
                    </Button>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {contacts.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground mb-4">
                  Add contacts to this grant on the Info tab to send outreach emails.
                </div>
              )}
              {contacts.length > 0 && !contacts.some(c => c.person?.email) && (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground mb-4">
                  None of the contacts have email addresses. Add emails to their profiles to send outreach.
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
          <div className="space-y-4">
            {/* Application Deadlines */}
            <Card>
              <CardHeader>
                <CardTitle>Application Deadlines</CardTitle>
                <CardDescription>LOI and application due dates</CardDescription>
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
                    <Label>Report Deadline (legacy)</Label>
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

            {/* Report Schedule */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Report Schedule</CardTitle>
                  <CardDescription>Track required reports and their due dates</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowAddReport(!showAddReport)}>
                  <Plus className="mr-1 h-4 w-4" /> Add Report
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {showAddReport && (
                  <div className="rounded-lg border border-dashed p-3 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select value={newReportType} onValueChange={setNewReportType}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {REPORT_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Title</Label>
                        <Input className="h-8 text-sm" value={newReportTitle} onChange={(e) => setNewReportTitle(e.target.value)} placeholder="e.g. Q1 Progress Report" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Due Date</Label>
                        <Input className="h-8 text-sm" type="date" value={newReportDueDate} onChange={(e) => setNewReportDueDate(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddReport} disabled={!newReportTitle || !newReportDueDate}>Add</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowAddReport(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {reports.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No reports scheduled. Click &quot;Add Report&quot; to create a reporting schedule.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reports.map((report) => {
                      const dueEnd = parseLocalDate(report.due_date); dueEnd.setHours(23, 59, 59, 999);
                      const isOverdue = dueEnd < new Date() && !['submitted', 'accepted'].includes(report.status);
                      const statusConfig = REPORT_STATUSES.find(s => s.value === report.status);
                      return (
                        <div key={report.id} className={`flex items-center justify-between rounded-lg border p-3 ${isOverdue ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950' : ''}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{report.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {REPORT_TYPES.find(t => t.value === report.report_type)?.label ?? report.report_type}
                                {' · Due '}{formatDate(report.due_date)}
                                {report.submitted_at && ` · Submitted ${formatDate(report.submitted_at)}`}
                                {isOverdue && ' · OVERDUE'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={statusConfig?.color ?? ''} variant="outline">
                              {statusConfig?.label ?? report.status}
                            </Badge>
                            <Select value={report.status} onValueChange={(val) => handleUpdateReportStatus(report.id, val)}>
                              <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {REPORT_STATUSES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteReport(report.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {emailTargetContact?.person?.email && (
        <SendEmailModal
          open={showSendEmail}
          onOpenChange={(open) => { setShowSendEmail(open); if (!open) setEmailTargetContact(null); }}
          projectSlug={slug}
          defaultTo={emailTargetContact.person.email}
          personId={emailTargetContact.person.id}
          organizationId={grant.funder_organization_id ?? undefined}
          onSuccess={handleOutreachEmailSuccess}
        />
      )}

      {/* Answer Bank picker sheet */}
      <Sheet open={answerBankOpen} onOpenChange={setAnswerBankOpen}>
        <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Insert from Answer Bank
            </SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground">
            Click an entry to append it to {answerBankTarget === 'notes' ? 'Notes' : 'Key Intel'}.
          </p>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search entries..."
              value={answerBankSearch}
              onChange={(e) => {
                setAnswerBankSearch(e.target.value);
                fetchAnswerBankEntries(e.target.value);
              }}
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 mt-3">
            {answerBankLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : answerBankEntries.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                {answerBankSearch ? 'No entries match your search' : 'No entries in Answer Bank yet'}
              </div>
            ) : (
              answerBankEntries.map((entry) => (
                <button
                  key={entry.id}
                  className="w-full text-left rounded-lg border p-3 hover:bg-accent transition-colors space-y-1"
                  onClick={() => handleInsertFromAnswerBank(entry)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{entry.title}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {ANSWER_BANK_CATEGORIES.find((c) => c.value === entry.category)?.label ?? entry.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{entry.content}</p>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Save to Answer Bank dialog */}
      <Dialog open={saveToAnswerBankOpen} onOpenChange={setSaveToAnswerBankOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save to Answer Bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={saveAnswerBankTitle}
                onChange={(e) => setSaveAnswerBankTitle(e.target.value)}
                placeholder="e.g. Mission Statement"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={saveAnswerBankCategory} onValueChange={setSaveAnswerBankCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANSWER_BANK_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Content (from Notes)</Label>
              <p className="text-sm text-muted-foreground line-clamp-4 rounded border p-2 bg-muted/40">
                {editNotes}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveToAnswerBankOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveToAnswerBank} disabled={!saveAnswerBankTitle.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
