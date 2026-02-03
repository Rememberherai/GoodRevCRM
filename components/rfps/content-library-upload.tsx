'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, X, Trash2, Check } from 'lucide-react';
import { useContentLibrary } from '@/hooks/use-content-library';
import { CONTENT_CATEGORIES, CATEGORY_LABELS, type ContentCategory } from '@/types/rfp-content-library';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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

interface ExtractedEntry {
  title: string;
  question_text?: string | null;
  answer_text: string;
  category?: string | null;
  tags?: string[];
  source_document_name?: string;
}

interface ContentLibraryUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}

export function ContentLibraryUpload({
  open,
  onOpenChange,
  onUploaded,
}: ContentLibraryUploadProps) {
  const { bulkCreate } = useContentLibrary();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedEntries, setExtractedEntries] = useState<ExtractedEntry[]>([]);
  const [documentName, setDocumentName] = useState<string>('');
  const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set());

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
    setExtractedEntries([]);
    setRemovedIndices(new Set());
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
      const slug = window.location.pathname.split('/')[2];
      const formData = new FormData();
      formData.append('file', file);
      if (category) formData.append('category', category);

      const response = await fetch(`/api/projects/${slug}/content-library/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to extract content');
      }

      const data = await response.json();
      setExtractedEntries(data.entries ?? []);
      setDocumentName(data.documentName ?? file.name);

      if (data.entries?.length === 0) {
        setError('No Q&A pairs could be extracted from this document.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract content');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    const entriesToSave = extractedEntries.filter((_, i) => !removedIndices.has(i));
    if (entriesToSave.length === 0) return;

    setIsSaving(true);
    setError(null);

    try {
      await bulkCreate(
        entriesToSave.map((e) => ({
          title: e.title,
          question_text: e.question_text ?? null,
          answer_text: e.answer_text,
          category: (e.category as ContentCategory) ?? null,
          tags: e.tags ?? [],
          source_document_name: documentName,
        }))
      );
      onUploaded();
      resetState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entries');
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

  const resetState = () => {
    setFile(null);
    setCategory('');
    setExtractedEntries([]);
    setRemovedIndices(new Set());
    setDocumentName('');
    setError(null);
  };

  const activeEntries = extractedEntries.filter((_, i) => !removedIndices.has(i));

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
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a PDF or text file to extract reusable Q&A content for your library.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {extractedEntries.length === 0 ? (
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

              {/* Category */}
              <div>
                <Label>Category (optional)</Label>
                <Select value={category || 'none'} onValueChange={(v) => setCategory(v === 'none' ? '' : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Auto-detect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Auto-detect</SelectItem>
                    {CONTENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              {/* Preview extracted entries */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Extracted {activeEntries.length} entries from {documentName}
                </p>
                <Button variant="ghost" size="sm" onClick={resetState}>
                  Upload Different File
                </Button>
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {extractedEntries.map((entry, index) => (
                  <div
                    key={index}
                    className={`rounded-md border p-3 ${
                      removedIndices.has(index) ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{entry.title}</p>
                        {entry.question_text && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            Q: {entry.question_text}
                          </p>
                        )}
                        <p className="text-xs mt-1 line-clamp-2">
                          {entry.answer_text.slice(0, 200)}
                          {entry.answer_text.length > 200 ? '...' : ''}
                        </p>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {entry.category && (
                            <Badge variant="outline" className="text-xs">
                              {CATEGORY_LABELS[entry.category as ContentCategory] ?? entry.category}
                            </Badge>
                          )}
                          {entry.tags?.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => toggleRemove(index)}
                      >
                        {removedIndices.has(index) ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
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
          {extractedEntries.length === 0 ? (
            <Button
              onClick={handleExtract}
              disabled={!file || isExtracting}
            >
              {isExtracting ? 'Extracting...' : 'Extract Content'}
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={isSaving || activeEntries.length === 0}
            >
              {isSaving ? 'Saving...' : `Save ${activeEntries.length} Entries to Library`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
