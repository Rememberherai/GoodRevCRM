'use client';

import { useState, useRef } from 'react';
import { Camera, ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EventCoverUploadProps {
  projectSlug: string;
  eventId: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
}

export function EventCoverUpload({ projectSlug, eventId, currentUrl, onUploaded }: EventCoverUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Allowed: JPEG, PNG, WebP, GIF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum 5MB.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/projects/${projectSlug}/events/${eventId}/upload-cover`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      onUploaded(data.cover_image_url);
      toast.success('Cover image updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload cover image');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div
      className={cn(
        'relative group cursor-pointer rounded-xl overflow-hidden border',
        currentUrl ? 'h-48' : 'h-32',
      )}
      onClick={() => !isUploading && fileInputRef.current?.click()}
      title="Click to upload cover image"
    >
      {currentUrl ? (
        <img src={currentUrl} alt="Event cover" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center bg-muted text-muted-foreground gap-2">
          <ImageIcon className="h-8 w-8" />
          <span className="text-sm">Click to add cover image</span>
        </div>
      )}

      {!isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera className="h-6 w-6 text-white" />
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 className="h-6 w-6 text-white animate-spin" />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
