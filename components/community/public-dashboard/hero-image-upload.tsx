'use client';

import { useCallback, useRef, useState } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Camera, ImageIcon, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const SUGGESTED_WIDTH = 1200;
const SUGGESTED_HEIGHT = 400;
const ASPECT = SUGGESTED_WIDTH / SUGGESTED_HEIGHT; // 3:1
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface HeroImageUploadProps {
  projectSlug: string;
  currentUrl: string | null;
  onUploaded: (url: string | null) => void;
}

function getCroppedCanvas(image: HTMLImageElement, crop: PixelCrop): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = Math.min(crop.width * scaleX, SUGGESTED_WIDTH);
  canvas.height = Math.min(crop.height * scaleY, SUGGESTED_HEIGHT);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

export function HeroImageUpload({ projectSlug, currentUrl, onUploaded }: HeroImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Allowed: JPEG, PNG, WebP');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum 5MB.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
  }

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    imageRef.current = e.currentTarget;
    const { width, height } = e.currentTarget;
    const cropWidth = Math.min(width, height * ASPECT);
    const cropHeight = cropWidth / ASPECT;
    setCrop({
      unit: 'px',
      x: (width - cropWidth) / 2,
      y: (height - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight,
    });
  }, []);

  async function handleCropAndUpload() {
    if (!imageRef.current || !completedCrop || !selectedFile) return;

    setIsUploading(true);
    try {
      const canvas = getCroppedCanvas(imageRef.current, completedCrop);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/webp', 0.85);
      });

      const formData = new FormData();
      formData.append('file', new File([blob], 'hero.webp', { type: 'image/webp' }));

      const res = await fetch(`/api/projects/${projectSlug}/public-dashboard/upload-hero`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      onUploaded(data.hero_image_url);
      toast.success('Hero image updated');
      setCropDialogOpen(false);
      setImageSrc(null);
      setSelectedFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload hero image');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleUploadWithoutCrop() {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch(`/api/projects/${projectSlug}/public-dashboard/upload-hero`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      onUploaded(data.hero_image_url);
      toast.success('Hero image updated');
      setCropDialogOpen(false);
      setImageSrc(null);
      setSelectedFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload hero image');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          'relative group cursor-pointer rounded-xl overflow-hidden border',
          currentUrl ? 'h-40' : 'h-24',
        )}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        title={`Click to upload hero image (suggested: ${SUGGESTED_WIDTH}x${SUGGESTED_HEIGHT}px)`}
      >
        {currentUrl ? (
          <img src={currentUrl} alt="Dashboard hero" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center bg-muted text-muted-foreground gap-1.5">
            <ImageIcon className="h-6 w-6" />
            <span className="text-xs">Click to add hero image</span>
            <span className="text-[10px] text-muted-foreground/70">{SUGGESTED_WIDTH} x {SUGGESTED_HEIGHT}px recommended</span>
          </div>
        )}

        {!isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-5 w-5 text-white" />
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </div>
        )}

        {currentUrl && !isUploading && (
          <button
            type="button"
            className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
            onClick={(e) => {
              e.stopPropagation();
              onUploaded(null);
            }}
            title="Remove hero image"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <Dialog open={cropDialogOpen} onOpenChange={(open) => {
        if (!open && !isUploading) {
          setCropDialogOpen(false);
          setImageSrc(null);
          setSelectedFile(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crop Hero Image</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Drag to adjust the crop area. Recommended size: {SUGGESTED_WIDTH} x {SUGGESTED_HEIGHT}px (3:1 ratio).
          </p>
          {imageSrc && (
            <div className="max-h-[60vh] overflow-auto">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={ASPECT}
              >
                <img
                  src={imageSrc}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  className="max-w-full"
                />
              </ReactCrop>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => {
              setCropDialogOpen(false);
              setImageSrc(null);
              setSelectedFile(null);
            }} disabled={isUploading}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleUploadWithoutCrop()} disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Upload Original
            </Button>
            <Button size="sm" onClick={() => void handleCropAndUpload()} disabled={isUploading || !completedCrop}>
              {isUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Crop & Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
