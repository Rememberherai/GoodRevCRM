'use client';

import { useState, useRef, useCallback, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import { ArrowUp, Camera, Loader2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  projectSlug: string;
  projectType?: string | null;
}

type UploadResponse = {
  message_text?: string;
  storage_path?: string;
  error?: string;
};

export function ChatInput({ onSend, onStop, isStreaming, projectSlug, projectType }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || isUploading) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, isStreaming, isUploading, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  // Auto-focus textarea when mounted (panel opened)
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const appendUploadMessage = useCallback((message: string) => {
    setValue((current) => {
      const next = current.trim() ? `${current.trim()}\n\n${message}` : message;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
      });
      return next;
    });
  }, []);

  const handleUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;
    if (projectType !== 'community') {
      toast.error('Receipt upload is only available for community projects.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/projects/${projectSlug}/community/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to upload receipt';
        try {
          const errData = await response.json() as UploadResponse;
          errorMessage = errData.error ?? errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      const data = await response.json() as UploadResponse;

      if (data.message_text) {
        appendUploadMessage(data.message_text);
        toast.success('Receipt uploaded. Ask the assistant to process it.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload receipt');
    } finally {
      setIsUploading(false);
    }
  }, [appendUploadMessage, projectSlug, projectType]);

  return (
    <div className="border-t p-3">
      <div className="flex items-end gap-2 bg-muted/50 rounded-lg border p-2">
        {projectType === 'community' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || isUploading}
              title="Upload receipt or invoice"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </Button>
          </>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          placeholder={projectType === 'community'
            ? 'Ask the assistant to process receipts, sync program calendars, or handle nonprofit operations...'
            : 'Ask anything about your CRM data...'}
          rows={projectType === 'community' ? 3 : 1}
          className={`flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground ${projectType === 'community' ? 'min-h-[72px]' : 'min-h-[36px]'} max-h-[120px] py-2 px-1`}
          disabled={isStreaming || isUploading}
        />
        {isStreaming ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={onStop}
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleSend}
            disabled={!value.trim() || isUploading}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
