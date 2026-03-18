'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Download, PenTool, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SigningPageData, ContractFieldType } from '@/types/contract';

type SigningStep = 'loading' | 'consent' | 'signing' | 'submitted' | 'completed' | 'declined' | 'delegated' | 'error';
type DownloadState = 'idle' | 'generating' | 'ready' | 'error';

export default function SigningPage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<SigningStep>('loading');
  const [data, setData] = useState<SigningPageData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureType, setSignatureType] = useState<'draw' | 'type'>('type');
  const [typedSignature, setTypedSignature] = useState('');
  const [initialsData, setInitialsData] = useState<string | null>(null);
  const [typedInitials, setTypedInitials] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showDelegateDialog, setShowDelegateDialog] = useState(false);
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [delegateName, setDelegateName] = useState('');
  const [delegateEmail, setDelegateEmail] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [signatureFont, setSignatureFont] = useState<string>('Dancing Script');
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const initialsCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<'signature' | 'initials' | null>(null);
  const hasDrawnStrokeRef = useRef(false);

  const SIGNATURE_FONTS = [
    { name: 'Dancing Script', label: 'Elegant' },
    { name: 'Caveat', label: 'Casual' },
    { name: 'Great Vibes', label: 'Formal' },
    { name: 'Kalam', label: 'Handwritten' },
    { name: 'Pacifico', label: 'Bold' },
  ];

  // Load Google Fonts for signature options
  useEffect(() => {
    const families = SIGNATURE_FONTS.map((f) => f.name.replace(/ /g, '+')).join('&family=');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/sign/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to load document');
      }
      const signingData: SigningPageData = await res.json();
      setData(signingData);

      // Pre-fill field values
      const values: Record<string, string> = {};
      signingData.fields.forEach((f) => {
        if (f.value) values[f.id] = f.value;
      });
      setFieldValues(values);

      if (signingData.document_status === 'completed') {
        setStep('completed');
      } else if (signingData.document_status === 'declined') {
        setStep('declined');
      } else if (signingData.recipient_status === 'delegated') {
        setStep('delegated');
      } else if (signingData.recipient_status === 'signed') {
        setStep('submitted');
      } else if (!signingData.consent_given) {
        setStep('consent');
      } else {
        setStep('signing');
      }

      // Load PDF
      const pdfRes = await fetch(`/api/sign/${token}/document`);
      if (pdfRes.ok) {
        const blob = await pdfRes.blob();
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        const url = URL.createObjectURL(blob);
        pdfUrlRef.current = url;
        setPdfUrl(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, []);

  const handleConsent = async () => {
    try {
      const res = await fetch(`/api/sign/${token}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent_given: true }),
      });
      if (!res.ok) throw new Error('Failed to record consent');
      setStep('signing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Consent failed');
    }
  };

  const handleFieldChange = async (fieldId: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    // Auto-save
    try {
      await fetch(`/api/sign/${token}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: [{ field_id: fieldId, value }] }),
      });
    } catch {
      // Silent save failure
    }
  };

  const handleSubmit = async () => {
    if (!data) return;

    // Validate required fields
    const missingFields = data.fields.filter(
      (f) => f.is_required && !fieldValues[f.id] && f.field_type !== 'signature' && f.field_type !== 'initials'
    );
    if (missingFields.length > 0) {
      setError(`Please fill in all required fields (${missingFields.length} remaining)`);
      return;
    }

    // Get signature
    let sigData: string;
    if (signatureType === 'type') {
      if (!typedSignature.trim()) {
        setError('Please provide your signature');
        return;
      }
      sigData = typedSignature.trim();
    } else {
      if (!signatureData) {
        setError('Please draw your signature');
        return;
      }
      sigData = signatureData;
    }

    // Get initials (if any initials fields exist)
    const needsInitials = data.fields.some((f) => f.field_type === 'initials');
    let initialsPayload: { type: string; data: string; font?: string } | null = null;
    if (needsInitials) {
      if (signatureType === 'type') {
        if (!typedInitials.trim()) {
          setError('Please provide your initials');
          return;
        }
        initialsPayload = { type: 'type', data: typedInitials.trim(), font: signatureFont };
      } else {
        if (!initialsData) {
          setError('Please draw your initials');
          return;
        }
        initialsPayload = { type: 'draw', data: initialsData };
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const fieldsToSubmit = data.fields.map((f) => ({
        field_id: f.id,
        value: f.field_type === 'signature' || f.field_type === 'initials' ? 'adopted' : (fieldValues[f.id] ?? ''),
      }));

      const res = await fetch(`/api/sign/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: fieldsToSubmit,
          signature_data: {
            type: signatureType,
            data: sigData,
            ...(signatureType === 'type' ? { font: signatureFont } : {}),
          },
          ...(initialsPayload ? { initials_data: initialsPayload } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Submit failed');
      }

      const submitResult = await res.json();
      setStep(submitResult.completed ? 'completed' : 'submitted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    try {
      const res = await fetch(`/api/sign/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason || undefined }),
      });
      if (!res.ok) throw new Error('Decline failed');
      setStep('declined');
      setShowDeclineDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decline failed');
    }
  };

  const handleDelegate = async () => {
    if (!delegateName.trim() || !delegateEmail.trim()) return;
    try {
      const res = await fetch(`/api/sign/${token}/delegate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: delegateName.trim(), email: delegateEmail.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Delegate failed');
      }
      setShowDelegateDialog(false);
      setStep('delegated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delegate failed');
    }
  };

  const handleDownload = async () => {
    setDownloadState('generating');
    let attempts = 0;
    const maxAttempts = 12; // ~60 seconds
    while (attempts < maxAttempts) {
      try {
        const res = await fetch(`/api/sign/${token}/download`);
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ?? 'signed_document.pdf';
          a.click();
          URL.revokeObjectURL(url);
          setDownloadState('ready');
          return;
        }
        if (res.status === 409) {
          // Still generating — wait and retry
          attempts++;
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        throw new Error('Download failed');
      } catch {
        setDownloadState('error');
        return;
      }
    }
    setDownloadState('error');
  };

  // Drawing canvas handlers
  const initCanvas = useCallback(() => {
    const initOne = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    initOne(signatureCanvasRef.current);
    initOne(initialsCanvasRef.current);
  }, []);

  useEffect(() => {
    if (signatureType === 'draw') {
      initCanvas();
      setSignatureData(null);
      setInitialsData(null);
    }
  }, [signatureType, initCanvas]);

  // Unified coordinate extraction for mouse and touch events
  const getCanvasCoords = (
    canvas: HTMLCanvasElement | null,
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0] ?? e.changedTouches[0];
      if (!touch) return null;
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDrawing = (
    kind: 'signature' | 'initials',
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault();
    activeCanvasRef.current = kind;
    hasDrawnStrokeRef.current = false;
    const canvas = kind === 'signature' ? signatureCanvasRef.current : initialsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const coords = getCanvasCoords(canvas, e);
    if (!coords) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (
    kind: 'signature' | 'initials',
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault();
    if (activeCanvasRef.current !== kind) return;
    const canvas = kind === 'signature' ? signatureCanvasRef.current : initialsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const coords = getCanvasCoords(canvas, e);
    if (!coords) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    hasDrawnStrokeRef.current = true;
  };

  const stopDrawing = (kind: 'signature' | 'initials') => {
    if (activeCanvasRef.current !== kind) return;
    const canvas = kind === 'signature' ? signatureCanvasRef.current : initialsCanvasRef.current;
    activeCanvasRef.current = null;
    if (!canvas) return;

    if (!hasDrawnStrokeRef.current) {
      if (kind === 'signature') {
        setSignatureData(null);
      } else {
        setInitialsData(null);
      }
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    if (kind === 'signature') {
      setSignatureData(dataUrl);
    } else {
      setInitialsData(dataUrl);
    }
  };

  const clearCanvas = (kind: 'signature' | 'initials') => {
    const canvas = kind === 'signature' ? signatureCanvasRef.current : initialsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (kind === 'signature') {
      setSignatureData(null);
    } else {
      setInitialsData(null);
    }
    if (activeCanvasRef.current === kind) {
      activeCanvasRef.current = null;
    }
    hasDrawnStrokeRef.current = false;
  };

  const renderField = (field: SigningPageData['fields'][0]) => {
    const value = fieldValues[field.id] ?? '';

    switch (field.field_type as ContractFieldType) {
      case 'signature':
      case 'initials':
        return null; // Handled in signature section
      case 'checkbox':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value === 'true'}
              onChange={(e) => handleFieldChange(field.id, e.target.checked ? 'true' : 'false')}
              className="rounded"
            />
            <span className="text-sm text-gray-700">{field.label ?? field.field_type}</span>
            {field.is_required && <span className="text-red-500">*</span>}
          </label>
        );
      case 'dropdown':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label ?? field.field_type}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm text-gray-900 bg-white"
            >
              <option value="">Select...</option>
              {(field.options as string[] ?? []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        );
      default:
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label ?? field.field_type.replace(/_/g, ' ')}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type={field.field_type === 'email' ? 'email' : 'text'}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder ?? ''}
              className="w-full border rounded-md px-3 py-2 text-sm text-gray-900 bg-white"
            />
          </div>
        );
    }
  };

  // Loading
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  // Error
  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-bold mb-2 text-gray-900">Unable to Load Document</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Completed
  if (step === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-gray-900">Document Signed</h1>
          <p className="text-gray-600 mb-6">Thank you! The document has been signed successfully.</p>
          {downloadState === 'idle' && (
            <button
              onClick={handleDownload}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Download className="mr-2 h-4 w-4" /> Download Signed Copy
            </button>
          )}
          {downloadState === 'generating' && (
            <div className="space-y-3">
              <div className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-md">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating signed PDF...
              </div>
              <p className="text-sm text-gray-500">This may take a moment while the document is finalized.</p>
            </div>
          )}
          {downloadState === 'ready' && (
            <div className="space-y-3">
              <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-md">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Download complete
              </div>
              <button
                onClick={handleDownload}
                className="block mx-auto text-sm text-blue-600 hover:underline"
              >
                Download again
              </button>
            </div>
          )}
          {downloadState === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-red-600">Download failed. The document may still be processing.</p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Download className="mr-2 h-4 w-4" /> Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-gray-900">Signature Submitted</h1>
          <p className="text-gray-600">
            Your signature has been recorded. The completed PDF will be available after all required signers finish.
          </p>
        </div>
      </div>
    );
  }

  // Declined
  if (step === 'declined') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-gray-900">Document Declined</h1>
          <p className="text-gray-600">The document has been declined. The sender has been notified.</p>
        </div>
      </div>
    );
  }

  if (step === 'delegated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <CheckCircle2 className="h-16 w-16 mx-auto text-blue-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-gray-900">Signing Delegated</h1>
          <p className="text-gray-600">The delegate has been notified and can continue the signing process.</p>
        </div>
      </div>
    );
  }

  // Consent
  if (step === 'consent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-lg mx-auto bg-white rounded-xl shadow-lg p-8">
          <PenTool className="h-10 w-10 text-blue-600 mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-gray-900">{data?.document_title}</h1>
          <p className="text-gray-600 mb-6">
            Hi {data?.recipient_name}, you have been asked to review and sign this document.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">E-Signature Consent</h3>
            <p className="text-sm text-blue-800">
              By clicking &quot;I Agree&quot; below, you consent to conduct business electronically,
              including signing documents using electronic signatures. Your electronic signature
              will be legally binding with the same effect as a handwritten signature under the
              E-SIGN Act and UETA.
            </p>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleConsent}
              className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              I Agree - Continue to Sign
            </button>
            <button
              onClick={() => setShowDeclineDialog(true)}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Decline
            </button>
          </div>
        </div>

        {/* Decline dialog */}
        {showDeclineDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-lg font-bold mb-2 text-gray-900">Decline to Sign</h2>
              <p className="text-sm text-gray-600 mb-4">The sender will be notified.</p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full border rounded-md px-3 py-2 text-sm mb-4"
                rows={3}
              />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowDeclineDialog(false)} className="px-4 py-2 border rounded-md text-sm text-gray-700">Cancel</button>
                <button onClick={handleDecline} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700">Decline</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Signing
  const hasInitialsFields = (data?.fields ?? []).some((f) => f.field_type === 'initials');
  const nonSignatureFields = (data?.fields ?? []).filter(
    (f) => f.field_type !== 'signature' && f.field_type !== 'initials'
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg text-gray-900">{data?.document_title}</h1>
            <p className="text-sm text-gray-500">Signing as {data?.recipient_name}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDelegateDialog(true)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Delegate
            </button>
            <button
              onClick={() => setShowDeclineDialog(true)}
              className="px-3 py-2 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50"
            >
              Decline
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PDF Preview with field overlays */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Document Preview</h2>
                {data && data.page_count > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-600"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {data.page_count}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(data.page_count, p + 1))}
                      disabled={currentPage >= data.page_count}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-600"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="relative overflow-hidden" style={{ height: 'min(700px, 60vh)' }}>
                {pdfUrl ? (
                  <>
                    <iframe
                      src={`${pdfUrl}#page=${currentPage}`}
                      className="absolute inset-0 w-full h-full rounded border pointer-events-none select-none"
                      style={{ zIndex: 1 }}
                      title="Document Preview"
                    />
                    {/* Field position overlays — z-index above iframe */}
                    {(data?.fields ?? [])
                      .filter((f) => f.page_number === currentPage)
                      .map((field) => {
                        const isSig = field.field_type === 'signature';
                        const isInitials = field.field_type === 'initials';
                        const sigFilled = signatureType === 'type' ? !!typedSignature : !!signatureData;
                        const initialsFilled = signatureType === 'type' ? !!typedInitials : !!initialsData;
                        const isFilled = !!fieldValues[field.id] || (isSig && sigFilled) || (isInitials && initialsFilled);
                        return (
                          <div
                            key={field.id}
                            className={`absolute rounded flex items-center justify-center text-xs font-medium pointer-events-none ${
                              isFilled
                                ? 'bg-green-100/80 border-2 border-green-400 text-green-700'
                                : 'bg-blue-100/80 border-2 border-blue-400 text-blue-700 animate-pulse'
                            }`}
                            style={{
                              left: `${field.x}%`,
                              top: `${field.y}%`,
                              width: `${field.width}%`,
                              height: `${field.height}%`,
                              zIndex: 10,
                            }}
                          >
                            {isSig ? (
                              <PenTool className="h-4 w-4" />
                            ) : (
                              <span className="truncate px-1">
                                {field.label ?? field.field_type.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-100 rounded">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fields + Signature */}
          <div className="space-y-6">
            {/* Fields */}
            {nonSignatureFields.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h2 className="font-semibold mb-3 text-gray-900">Required Information</h2>
                <div className="space-y-4">
                  {nonSignatureFields.map((field) => (
                    <div key={field.id}>{renderField(field)}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Signature */}
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h2 className="font-semibold mb-3 text-gray-900">Your Signature</h2>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setSignatureType('type')}
                  className={`px-3 py-1.5 text-sm rounded-md ${signatureType === 'type' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  Type
                </button>
                <button
                  onClick={() => setSignatureType('draw')}
                  className={`px-3 py-1.5 text-sm rounded-md ${signatureType === 'draw' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  Draw
                </button>
              </div>

              {signatureType === 'type' ? (
                <div>
                  <input
                    type="text"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    placeholder="Type your full name"
                    className="w-full border rounded-md px-3 py-2 text-sm text-gray-900 bg-white"
                  />
                  {typedSignature && (
                    <>
                      <div className="mt-3 grid grid-cols-1 gap-2">
                        {SIGNATURE_FONTS.map((font) => (
                          <button
                            key={font.name}
                            onClick={() => setSignatureFont(font.name)}
                            className={`text-left p-3 rounded-lg border-2 transition-colors ${
                              signatureFont === font.name
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <span className="text-xs text-gray-500 block mb-0.5">{font.label}</span>
                            <span
                              className="text-2xl text-gray-900 block"
                              style={{ fontFamily: `'${font.name}', cursive` }}
                            >
                              {typedSignature}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <canvas
                    ref={signatureCanvasRef}
                    width={600}
                    height={240}
                    className="w-full border rounded-md bg-white cursor-crosshair"
                    style={{ touchAction: 'none' }}
                    onMouseDown={(e) => startDrawing('signature', e)}
                    onMouseMove={(e) => draw('signature', e)}
                    onMouseUp={() => stopDrawing('signature')}
                    onMouseLeave={() => stopDrawing('signature')}
                    onTouchStart={(e) => startDrawing('signature', e)}
                    onTouchMove={(e) => draw('signature', e)}
                    onTouchEnd={() => stopDrawing('signature')}
                    onTouchCancel={() => stopDrawing('signature')}
                  />
                  <button
                    onClick={() => clearCanvas('signature')}
                    className="mt-2 text-sm text-blue-600 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Initials (only if document has initials fields) */}
            {hasInitialsFields && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h2 className="font-semibold mb-3 text-gray-900">Your Initials</h2>
                {signatureType === 'type' ? (
                  <input
                    type="text"
                    value={typedInitials}
                    onChange={(e) => setTypedInitials(e.target.value)}
                    placeholder="Type your initials"
                    maxLength={5}
                    className="w-full border rounded-md px-3 py-2 text-sm text-gray-900 bg-white"
                  />
                ) : (
                  <div>
                    <canvas
                      ref={initialsCanvasRef}
                      width={300}
                      height={120}
                      className="w-full border rounded-md bg-white cursor-crosshair"
                      style={{ touchAction: 'none', maxWidth: '300px' }}
                      onMouseDown={(e) => startDrawing('initials', e)}
                      onMouseMove={(e) => draw('initials', e)}
                      onMouseUp={() => stopDrawing('initials')}
                      onMouseLeave={() => stopDrawing('initials')}
                      onTouchStart={(e) => startDrawing('initials', e)}
                      onTouchMove={(e) => draw('initials', e)}
                      onTouchEnd={() => stopDrawing('initials')}
                      onTouchCancel={() => stopDrawing('initials')}
                    />
                    <button
                      onClick={() => clearCanvas('initials')}
                      className="mt-2 text-sm text-blue-600 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
                {signatureType === 'type' && typedInitials && (
                  <p
                    className="mt-2 text-xl text-gray-900"
                    style={{ fontFamily: `'${signatureFont}', cursive` }}
                  >
                    {typedInitials}
                  </p>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing...
                </>
              ) : (
                <>
                  <PenTool className="h-4 w-4" />
                  Sign Document
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center">
              By clicking &quot;Sign Document&quot;, you agree that your electronic signature is
              the legal equivalent of your handwritten signature.
            </p>
          </div>
        </div>
      </div>

      {/* Decline Dialog */}
      {showDeclineDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold mb-2 text-gray-900">Decline to Sign</h2>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason (optional)"
              className="w-full border rounded-md px-3 py-2 text-sm mb-4"
              rows={3}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeclineDialog(false)} className="px-4 py-2 border rounded-md text-sm text-gray-700">Cancel</button>
              <button onClick={handleDecline} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm">Decline</button>
            </div>
          </div>
        </div>
      )}

      {/* Delegate Dialog */}
      {showDelegateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold mb-2 text-gray-900">Delegate Signing</h2>
            <p className="text-sm text-gray-600 mb-4">Assign someone else to sign on your behalf.</p>
            <div className="space-y-3 mb-4">
              <input
                type="text"
                value={delegateName}
                onChange={(e) => setDelegateName(e.target.value)}
                placeholder="Delegate's full name"
                className="w-full border rounded-md px-3 py-2 text-sm text-gray-900 bg-white"
              />
              <input
                type="email"
                value={delegateEmail}
                onChange={(e) => setDelegateEmail(e.target.value)}
                placeholder="Delegate's email"
                className="w-full border rounded-md px-3 py-2 text-sm text-gray-900 bg-white"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDelegateDialog(false)} className="px-4 py-2 border rounded-md text-sm text-gray-700">Cancel</button>
              <button
                onClick={handleDelegate}
                disabled={!delegateName.trim() || !delegateEmail.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50"
              >
                Delegate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
