'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Upload, FileText, X, Trash2, Check, Loader2 } from 'lucide-react';
import { useRfpQuestions } from '@/hooks/use-rfp-questions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import type { CreateRfpQuestionInput } from '@/lib/validators/rfp-question';

interface ExtractedQuestion {
  question_text: string;
  section_name?: string | null;
  question_number?: string | null;
  priority?: 'low' | 'medium' | 'high';
}

interface RfpDocumentImportProps {
  rfpId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export function RfpDocumentImport({
  rfpId,
  open,
  onOpenChange,
  onImported,
}: RfpDocumentImportProps) {
  const params = useParams();
  const slug = params.slug as string;
  const { bulkCreate } = useRfpQuestions(rfpId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[]>([]);
  const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [documentSummary, setDocumentSummary] = useState<string | null>(null);

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = ['application/pdf', 'text/plain'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Only PDF and TXT files are supported.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File must be less than 10MB.');
      return;
    }
    setFile(selectedFile);
    setError(null);
    setExtractedQuestions([]);
    setRemovedIndices(new Set());
    setDocumentSummary(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleExtract = async () => {
    if (!file) return;
    setIsExtracting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `/api/projects/${slug}/rfps/${rfpId}/questions/parse-document`,
        { method: 'POST', body: formData }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to extract questions');
      }

      const data = await response.json();
      setExtractedQuestions(data.questions ?? []);
      setDocumentSummary(data.documentSummary ?? null);

      if (data.questions?.length === 0) {
        setError(data.message || 'No questions could be extracted from this document.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract questions');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleImport = async () => {
    const activeQuestions = extractedQuestions.filter((_, i) => !removedIndices.has(i));
    if (activeQuestions.length === 0) return;

    setIsSaving(true);
    setError(null);

    try {
      const questionsToImport: CreateRfpQuestionInput[] = activeQuestions.map((q) => ({
        question_text: q.question_text,
        section_name: q.section_name ?? null,
        question_number: q.question_number ?? null,
        priority: q.priority ?? null,
        status: 'unanswered' as const,
      }));

      await bulkCreate(questionsToImport);
      toast.success(`Imported ${questionsToImport.length} questions`);
      onImported();
      resetState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import questions');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRemove = (index: number) => {
    setRemovedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const updateQuestion = (index: number, field: keyof ExtractedQuestion, value: string) => {
    setExtractedQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value || null } : q))
    );
  };

  const resetState = () => {
    setFile(null);
    setExtractedQuestions([]);
    setRemovedIndices(new Set());
    setEditingIndex(null);
    setDocumentSummary(null);
    setError(null);
  };

  const activeQuestions = extractedQuestions.filter((_, i) => !removedIndices.has(i));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!isExtracting && !isSaving) {
          onOpenChange(o);
          if (!o) resetState();
        }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Questions from Document</DialogTitle>
          <DialogDescription>
            Upload an RFP document (PDF or TXT) and AI will extract the questions for you to review.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {extractedQuestions.length === 0 ? (
            <>
              {/* File upload zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium">Drop a file here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports PDF and TXT files (max 10MB)
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
              </div>

              {isExtracting && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing document and extracting questions...
                </div>
              )}
            </>
          ) : (
            <>
              {/* Document summary */}
              {documentSummary && (
                <div className="rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{documentSummary}</p>
                </div>
              )}

              {/* Preview header */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {activeQuestions.length} of {extractedQuestions.length} questions selected
                </p>
                <Button variant="ghost" size="sm" onClick={resetState}>
                  Upload Different File
                </Button>
              </div>

              {/* Extracted questions list */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {extractedQuestions.map((q, index) => {
                  const isRemoved = removedIndices.has(index);
                  const isEditing = editingIndex === index;

                  return (
                    <div
                      key={index}
                      className={`rounded-md border p-3 ${isRemoved ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {isEditing && !isRemoved ? (
                            <div className="space-y-2">
                              <Input
                                value={q.question_text}
                                onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                                placeholder="Question text"
                                className="text-sm"
                              />
                              <div className="flex gap-2">
                                <Input
                                  value={q.section_name ?? ''}
                                  onChange={(e) => updateQuestion(index, 'section_name', e.target.value)}
                                  placeholder="Section name"
                                  className="text-sm flex-1"
                                />
                                <Input
                                  value={q.question_number ?? ''}
                                  onChange={(e) => updateQuestion(index, 'question_number', e.target.value)}
                                  placeholder="#"
                                  className="text-sm w-20"
                                />
                                <Select
                                  value={q.priority ?? 'medium'}
                                  onValueChange={(v) => updateQuestion(index, 'priority', v)}
                                >
                                  <SelectTrigger className="w-28 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PRIORITY_OPTIONS.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingIndex(null)}
                              >
                                Done Editing
                              </Button>
                            </div>
                          ) : (
                            <div
                              className="cursor-pointer"
                              onClick={() => !isRemoved && setEditingIndex(index)}
                            >
                              <p className="text-sm">
                                {q.question_number && (
                                  <span className="font-medium text-muted-foreground mr-1">
                                    {q.question_number}.
                                  </span>
                                )}
                                {q.question_text}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                {q.section_name && (
                                  <Badge variant="outline" className="text-xs">
                                    {q.section_name}
                                  </Badge>
                                )}
                                {q.priority && (
                                  <Badge variant="secondary" className="text-xs">
                                    {q.priority}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => toggleRemove(index)}
                        >
                          {isRemoved ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              resetState();
            }}
            disabled={isExtracting || isSaving}
          >
            Cancel
          </Button>
          {extractedQuestions.length === 0 ? (
            <Button onClick={handleExtract} disabled={!file || isExtracting}>
              {isExtracting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                'Extract Questions'
              )}
            </Button>
          ) : (
            <Button
              onClick={handleImport}
              disabled={isSaving || activeQuestions.length === 0}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${activeQuestions.length} Questions`
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
