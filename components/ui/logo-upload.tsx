'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Camera, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LogoUploadProps {
  currentUrl: string | null | undefined;
  fallbackInitials: string;
  entityType: 'project' | 'organization';
  entityId?: string;
  onUploaded: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

const iconSizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
};

export function LogoUpload({
  currentUrl,
  fallbackInitials,
  entityType,
  entityId,
  onUploaded,
  size = 'md',
  className,
}: LogoUploadProps) {
  const params = useParams();
  const projectSlug = params.slug as string;
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setIsUploading(true);

    try {
      // Compress and resize client-side (skip for SVGs)
      let processedFile: File | Blob = file;
      if (file.type !== 'image/svg+xml') {
        processedFile = await imageCompression(file, {
          maxWidthOrHeight: 256,
          maxSizeMB: 0.5,
          fileType: 'image/webp',
          useWebWorker: true,
        });
      }

      const formData = new FormData();
      formData.append('file', processedFile, file.name);
      formData.append('entityType', entityType);
      if (entityId) {
        formData.append('entityId', entityId);
      }

      const res = await fetch(`/api/projects/${projectSlug}/upload-logo`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      onUploaded(data.logo_url);
      toast.success('Logo updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className={cn('relative group cursor-pointer', className)}
      onClick={handleClick}
      title="Click to upload logo"
    >
      <Avatar className={cn(sizeClasses[size], 'transition-opacity', isUploading && 'opacity-50')}>
        <AvatarImage src={currentUrl ?? undefined} alt="Logo" />
        <AvatarFallback className={textSizeClasses[size]}>{fallbackInitials}</AvatarFallback>
      </Avatar>

      {/* Upload overlay */}
      {!isUploading && (
        <div className={cn(
          'absolute inset-0 flex items-center justify-center rounded-full',
          'bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity'
        )}>
          <Camera className={cn(iconSizeClasses[size], 'text-white')} />
        </div>
      )}

      {/* Loading spinner */}
      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
          <Loader2 className={cn(iconSizeClasses[size], 'text-white animate-spin')} />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
