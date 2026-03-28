import { FileSignature } from 'lucide-react';

export default function DocumentsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
      <div className="rounded-full bg-muted p-6">
        <FileSignature className="h-12 w-12 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Upload, send, and track documents for signature. All your documents from every project — plus standalone signing — in one place.
        </p>
      </div>
    </div>
  );
}
