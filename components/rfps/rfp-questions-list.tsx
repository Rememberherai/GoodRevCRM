'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Printer,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { useRfpQuestions } from '@/hooks/use-rfp-questions';
import {
  QUESTION_STATUS_LABELS,
  RFP_QUESTION_STATUSES,
  PRIORITY_LABELS,
  type RfpQuestionStatus,
  type RfpQuestion,
} from '@/types/rfp-question';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RfpQuestionEditor } from './rfp-question-editor';
import { RfpQuestionForm } from './rfp-question-form';
import { RfpQuestionsBulkAdd } from './rfp-questions-bulk-add';

interface RfpQuestionsListProps {
  rfpId: string;
}

const STATUS_COLORS: Record<RfpQuestionStatus, string> = {
  unanswered: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  review: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export function RfpQuestionsList({ rfpId }: RfpQuestionsListProps) {
  const params = useParams();
  const slug = params.slug as string;

  const {
    questionsBySection,
    counts,
    sections,
    isLoading,
    error,
    statusFilter,
    sectionFilter,
    refresh,
    remove,
    filterByStatus,
    filterBySection,
  } = useRfpQuestions(rfpId);

  const [editingQuestion, setEditingQuestion] = useState<RfpQuestion | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [copiedQuestionId, setCopiedQuestionId] = useState<string | null>(null);
  const [allCopied, setAllCopied] = useState(false);

  // Bulk AI generation state
  const [showBulkGenerate, setShowBulkGenerate] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkGenResult, setBulkGenResult] = useState<{ generated: number; total: number } | null>(null);
  const [bulkGenError, setBulkGenError] = useState<string | null>(null);
  const [bgIncludeCompany, setBgIncludeCompany] = useState(true);
  const [bgIncludeOrg, setBgIncludeOrg] = useState(true);
  const [bgIncludeLibrary, setBgIncludeLibrary] = useState(true);
  const [bgInstructions, setBgInstructions] = useState('');

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await remove(deleteId);
      setDeleteId(null);
    } catch {
      // Error handled by hook
    }
  };

  const handleBulkGenerate = async () => {
    setIsBulkGenerating(true);
    setBulkGenError(null);
    setBulkGenResult(null);
    try {
      const slug = window.location.pathname.split('/')[2];
      const rfpIdFromPath = window.location.pathname.split('/')[4];
      const response = await fetch(
        `/api/projects/${slug}/rfps/${rfpIdFromPath}/questions/generate-all`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            includeCompanyContext: bgIncludeCompany,
            includeOrgContext: bgIncludeOrg,
            includeLibraryAnswers: bgIncludeLibrary,
            additionalInstructions: bgInstructions || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate');
      }

      const data = await response.json();
      setBulkGenResult({ generated: data.generated, total: data.total });
      refresh();
    } catch (err) {
      setBulkGenError(err instanceof Error ? err.message : 'Failed to generate responses');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const handleCopyAnswer = (questionId: string, answerText: string) => {
    navigator.clipboard.writeText(answerText);
    setCopiedQuestionId(questionId);
    setTimeout(() => setCopiedQuestionId(null), 2000);
  };

  const handleCopyAll = () => {
    const lines: string[] = [];
    for (const [section, sectionQuestions] of Object.entries(questionsBySection)) {
      const answered = sectionQuestions.filter((q: RfpQuestion) => q.answer_text);
      if (answered.length === 0) continue;
      lines.push(`## ${section}\n`);
      for (const q of answered) {
        const label = q.question_number
          ? `**${q.question_number}. ${q.question_text}**`
          : `**${q.question_text}**`;
        lines.push(label);
        lines.push(q.answer_text ?? '');
        lines.push('');
      }
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  };

  const progressPercent = counts.total > 0
    ? Math.round(((counts.total - counts.unanswered) / counts.total) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">
              {counts.total - counts.unanswered} of {counts.total} answered
            </span>
            <span className="text-sm text-muted-foreground">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{counts.draft} draft</span>
          <span>{counts.review} review</span>
          <span>{counts.approved} approved</span>
        </div>
      </div>

      {/* Filters and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter ?? 'all'}
            onValueChange={(value) => filterByStatus(value === 'all' ? null : value as RfpQuestionStatus)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {RFP_QUESTION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {QUESTION_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sections.length > 0 && (
            <Select
              value={sectionFilter ?? 'all'}
              onValueChange={(value) => filterBySection(value === 'all' ? null : value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {sections.map((section) => (
                  <SelectItem key={section} value={section}>
                    {section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          {counts.total > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-1 h-3 w-3" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    window.location.href = `/api/projects/${slug}/rfps/${rfpId}/export?format=docx`;
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Export as Word (.docx)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    window.location.href = `/api/projects/${slug}/rfps/${rfpId}/export?format=csv`;
                  }}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    window.open(`/projects/${slug}/rfps/${rfpId}/print`, '_blank');
                  }}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print / Save as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyAll}>
                  {allCopied ? (
                    <Check className="mr-2 h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {allCopied ? 'Copied!' : 'Copy All Answers'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {counts.unanswered > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkGenerate(true)}
            >
              <Sparkles className="mr-1 h-3 w-3" />
              Generate All Drafts
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowBulkAdd(true)}>
            Bulk Add
          </Button>
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Question
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Questions grouped by section */}
      {isLoading && counts.total === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Loading questions...</div>
      ) : counts.total === 0 ? (
        <div className="text-center py-12 border rounded-md">
          <CircleDot className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground mb-3">No questions added yet</p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowBulkAdd(true)}>
              Bulk Add
            </Button>
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add Question
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(questionsBySection).map(([section, sectionQuestions]) => (
            <div key={section} className="border rounded-md">
              <button
                onClick={() => toggleSection(section)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {collapsedSections.has(section) ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="font-medium">{section}</span>
                  <Badge variant="secondary" className="text-xs">
                    {sectionQuestions.length}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {sectionQuestions.filter(q => q.status !== 'unanswered').length}/{sectionQuestions.length} answered
                </span>
              </button>
              {!collapsedSections.has(section) && (
                <div className="border-t divide-y">
                  {sectionQuestions.map((question) => (
                    <div
                      key={question.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setEditingQuestion(question)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {question.question_number && (
                            <span className="text-xs font-mono text-muted-foreground">
                              {question.question_number}
                            </span>
                          )}
                          <p className="text-sm truncate">{question.question_text}</p>
                        </div>
                        {question.answer_text && (
                          <p className="text-xs text-muted-foreground truncate">
                            {question.answer_text.slice(0, 100)}
                            {question.answer_text.length > 100 ? '...' : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {question.ai_generated && (
                          <Badge variant="outline" className="text-xs">AI</Badge>
                        )}
                        {question.priority && (
                          <Badge className={`text-xs ${PRIORITY_COLORS[question.priority]}`} variant="secondary">
                            {PRIORITY_LABELS[question.priority as keyof typeof PRIORITY_LABELS]}
                          </Badge>
                        )}
                        <Badge className={`text-xs ${STATUS_COLORS[question.status]}`} variant="secondary">
                          {QUESTION_STATUS_LABELS[question.status]}
                        </Badge>
                        {question.answer_text && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyAnswer(question.id, question.answer_text!);
                            }}
                          >
                            {copiedQuestionId === question.id ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(question.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Question Editor Slide-over */}
      {editingQuestion && (
        <RfpQuestionEditor
          rfpId={rfpId}
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSaved={() => {
            setEditingQuestion(null);
            refresh();
          }}
        />
      )}

      {/* Add Question Form */}
      {showAddForm && (
        <RfpQuestionForm
          rfpId={rfpId}
          open={showAddForm}
          onOpenChange={setShowAddForm}
          onCreated={() => {
            setShowAddForm(false);
            refresh();
          }}
        />
      )}

      {/* Bulk Add Dialog */}
      <RfpQuestionsBulkAdd
        rfpId={rfpId}
        open={showBulkAdd}
        onOpenChange={setShowBulkAdd}
        onCreated={() => {
          setShowBulkAdd(false);
          refresh();
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk AI Generate Dialog */}
      <Dialog open={showBulkGenerate} onOpenChange={(open) => {
        if (!isBulkGenerating) {
          setShowBulkGenerate(open);
          if (!open) {
            setBulkGenResult(null);
            setBulkGenError(null);
          }
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate All AI Drafts</DialogTitle>
            <DialogDescription>
              Generate AI draft answers for all {counts.unanswered} unanswered questions.
              Select which context to include.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bg-company"
                  checked={bgIncludeCompany}
                  onCheckedChange={(checked) => setBgIncludeCompany(checked === true)}
                  disabled={isBulkGenerating}
                />
                <label htmlFor="bg-company" className="text-sm cursor-pointer">
                  Include company context
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bg-org"
                  checked={bgIncludeOrg}
                  onCheckedChange={(checked) => setBgIncludeOrg(checked === true)}
                  disabled={isBulkGenerating}
                />
                <label htmlFor="bg-org" className="text-sm cursor-pointer">
                  Include organization context
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bg-library"
                  checked={bgIncludeLibrary}
                  onCheckedChange={(checked) => setBgIncludeLibrary(checked === true)}
                  disabled={isBulkGenerating}
                />
                <label htmlFor="bg-library" className="text-sm cursor-pointer">
                  Include similar library answers
                </label>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Additional instructions (optional)</label>
              <Textarea
                value={bgInstructions}
                onChange={(e) => setBgInstructions(e.target.value)}
                placeholder="e.g., Keep answers concise, Focus on security capabilities..."
                rows={2}
                className="mt-1 text-sm"
                disabled={isBulkGenerating}
              />
            </div>

            {bulkGenError && (
              <p className="text-sm text-destructive">{bulkGenError}</p>
            )}

            {bulkGenResult && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Generated {bulkGenResult.generated} of {bulkGenResult.total} drafts.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowBulkGenerate(false)}
                disabled={isBulkGenerating}
              >
                {bulkGenResult ? 'Close' : 'Cancel'}
              </Button>
              {!bulkGenResult && (
                <Button
                  onClick={handleBulkGenerate}
                  disabled={isBulkGenerating}
                >
                  <Sparkles className="mr-1 h-4 w-4" />
                  {isBulkGenerating ? 'Generating...' : `Generate ${counts.unanswered} Drafts`}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
