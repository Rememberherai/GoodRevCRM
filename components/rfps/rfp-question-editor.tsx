'use client';

import { useState } from 'react';
import { X, Save, Sparkles, ChevronDown, ChevronUp, RotateCcw, Library, BookOpen, Copy, Check } from 'lucide-react';
import { useRfpQuestions } from '@/hooks/use-rfp-questions';
import {
  QUESTION_STATUS_LABELS,
  RFP_QUESTION_STATUSES,
  QUESTION_PRIORITIES,
  PRIORITY_LABELS,
  type RfpQuestion,
  type RfpQuestionStatus,
  type QuestionPriority,
} from '@/types/rfp-question';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RfpQuestionEditorProps {
  rfpId: string;
  question: RfpQuestion;
  onClose: () => void;
  onSaved: () => void;
}

export function RfpQuestionEditor({
  rfpId,
  question,
  onClose,
  onSaved,
}: RfpQuestionEditorProps) {
  const { update } = useRfpQuestions(rfpId);
  const [answerText, setAnswerText] = useState(question.answer_text ?? '');
  const [status, setStatus] = useState<RfpQuestionStatus>(question.status);
  const [priority, setPriority] = useState<string>(question.priority ?? '');
  const [notes, setNotes] = useState(question.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);

  // AI generation state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);
  const [lastReasoning, setLastReasoning] = useState<string | null>(null);

  // Context selection
  const [includeCompanyContext, setIncludeCompanyContext] = useState(true);
  const [includeOrgContext, setIncludeOrgContext] = useState(true);
  const [includeLibraryAnswers, setIncludeLibraryAnswers] = useState(true);
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  // Copy answer state
  const [answerCopied, setAnswerCopied] = useState(false);

  // Save to library state
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);

  // Suggest from library state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; title: string; question_text: string | null; answer_text: string }>>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await update(question.id, {
        answer_text: answerText || null,
        status,
        priority: (priority || null) as QuestionPriority | null,
        notes: notes || null,
      });
      onSaved();
    } catch {
      // Error handled by hook
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    setLastConfidence(null);
    setLastReasoning(null);
    try {
      const slug = window.location.pathname.split('/')[2];
      const response = await fetch(
        `/api/projects/${slug}/rfps/${rfpId}/questions/${question.id}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            includeCompanyContext,
            includeOrgContext,
            includeLibraryAnswers,
            additionalInstructions: additionalInstructions || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate');
      }

      const data = await response.json();
      if (data.answer_text) {
        setAnswerText(data.answer_text);
        setStatus('draft');
        setLastConfidence(data.confidence ?? null);
        setLastReasoning(data.reasoning ?? null);
        setShowAiPanel(false);
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate response');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!answerText.trim()) return;
    setIsSavingToLibrary(true);
    try {
      const slug = window.location.pathname.split('/')[2];
      const response = await fetch(`/api/projects/${slug}/content-library`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: question.question_text.slice(0, 100),
          question_text: question.question_text,
          answer_text: answerText,
          source_rfp_id: rfpId,
          source_question_id: question.id,
        }),
      });
      if (!response.ok) throw new Error('Failed to save');
      setSavedToLibrary(true);
    } catch {
      // Silently fail
    } finally {
      setIsSavingToLibrary(false);
    }
  };

  const handleLoadSuggestions = async () => {
    setIsLoadingSuggestions(true);
    setShowSuggestions(true);
    try {
      const slug = window.location.pathname.split('/')[2];
      const response = await fetch(`/api/projects/${slug}/content-library/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: question.question_text,
          limit: 5,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.entries ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const hasChanges =
    answerText !== (question.answer_text ?? '') ||
    status !== question.status ||
    priority !== (question.priority ?? '') ||
    notes !== (question.notes ?? '');

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-background border-l shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold">Edit Question</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Question text (read-only) */}
        <div>
          <Label className="text-sm text-muted-foreground">Question</Label>
          <div className="mt-1 flex items-start gap-2">
            {question.question_number && (
              <Badge variant="outline" className="font-mono text-xs shrink-0">
                {question.question_number}
              </Badge>
            )}
            <p className="text-sm">{question.question_text}</p>
          </div>
          {question.section_name && (
            <p className="text-xs text-muted-foreground mt-1">
              Section: {question.section_name}
            </p>
          )}
        </div>

        {/* Status and Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as RfpQuestionStatus)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RFP_QUESTION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {QUESTION_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Priority</Label>
            <Select value={priority || 'none'} onValueChange={(v) => setPriority(v === 'none' ? '' : v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {QUESTION_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Answer */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-sm">Answer</Label>
            <div className="flex items-center gap-1">
              {answerText.trim() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(answerText);
                    setAnswerCopied(true);
                    setTimeout(() => setAnswerCopied(false), 2000);
                  }}
                >
                  {answerCopied ? (
                    <Check className="mr-1 h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="mr-1 h-3 w-3" />
                  )}
                  {answerCopied ? 'Copied' : 'Copy'}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAiPanel(!showAiPanel)}
                disabled={isGenerating}
              >
                <Sparkles className="mr-1 h-3 w-3" />
                {showAiPanel ? 'Hide AI Panel' : 'Generate AI Draft'}
                {showAiPanel ? (
                  <ChevronUp className="ml-1 h-3 w-3" />
                ) : (
                  <ChevronDown className="ml-1 h-3 w-3" />
                )}
              </Button>
            </div>
          </div>

          {/* AI Context Selection Panel */}
          {showAiPanel && (
            <div className="rounded-md border bg-muted/30 p-3 mb-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Select context sources for AI generation:</p>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ctx-company"
                    checked={includeCompanyContext}
                    onCheckedChange={(checked) => setIncludeCompanyContext(checked === true)}
                  />
                  <label htmlFor="ctx-company" className="text-sm cursor-pointer">
                    Include company context
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ctx-org"
                    checked={includeOrgContext}
                    onCheckedChange={(checked) => setIncludeOrgContext(checked === true)}
                  />
                  <label htmlFor="ctx-org" className="text-sm cursor-pointer">
                    Include organization context
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ctx-library"
                    checked={includeLibraryAnswers}
                    onCheckedChange={(checked) => setIncludeLibraryAnswers(checked === true)}
                  />
                  <label htmlFor="ctx-library" className="text-sm cursor-pointer">
                    Include similar library answers
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Additional instructions (optional)
                </label>
                <Textarea
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  placeholder="e.g., Focus on our ISO 27001 certification, Keep it under 200 words..."
                  rows={2}
                  className="mt-1 text-sm"
                />
              </div>

              {generateError && (
                <p className="text-xs text-destructive">{generateError}</p>
              )}

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  {isGenerating ? 'Generating...' : 'Generate'}
                </Button>
                {lastConfidence !== null && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Regenerate
                  </Button>
                )}
              </div>
            </div>
          )}

          <Textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Type your answer here..."
            rows={12}
            className="mt-1"
          />
          {(question.ai_generated || lastConfidence !== null) && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">AI Generated</Badge>
              {(lastConfidence ?? question.ai_confidence) != null && (
                <span className="text-xs text-muted-foreground">
                  Confidence: {Math.round((lastConfidence ?? question.ai_confidence ?? 0) * 100)}%
                </span>
              )}
            </div>
          )}
          {lastReasoning && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              {lastReasoning}
            </p>
          )}

          {/* Action buttons below answer */}
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadSuggestions}
              disabled={isLoadingSuggestions}
            >
              <BookOpen className="mr-1 h-3 w-3" />
              {showSuggestions ? 'Refresh Suggestions' : 'Find Similar Answers'}
            </Button>
            {answerText.trim() && status === 'approved' && !savedToLibrary && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveToLibrary}
                disabled={isSavingToLibrary}
              >
                <Library className="mr-1 h-3 w-3" />
                {isSavingToLibrary ? 'Saving...' : 'Save to Library'}
              </Button>
            )}
            {savedToLibrary && (
              <span className="text-xs text-green-600 dark:text-green-400">Saved to library</span>
            )}
          </div>

          {/* Suggestions from library */}
          {showSuggestions && (
            <div className="mt-2 rounded-md border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Similar answers from library:
              </p>
              {isLoadingSuggestions ? (
                <p className="text-xs text-muted-foreground">Searching...</p>
              ) : suggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No similar answers found.</p>
              ) : (
                suggestions.map((s) => (
                  <div key={s.id} className="rounded border bg-background p-2">
                    <p className="text-xs font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {s.answer_text.slice(0, 150)}{s.answer_text.length > 150 ? '...' : ''}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-6 text-xs"
                      onClick={() => {
                        setAnswerText(s.answer_text);
                        setStatus('draft');
                        setShowSuggestions(false);
                      }}
                    >
                      Use This Answer
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <Label className="text-sm">Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes..."
            rows={3}
            className="mt-1"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
          <Save className="mr-1 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
