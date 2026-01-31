'use client';

import { useState } from 'react';
import { Mail, Phone, Briefcase, Linkedin, MapPin, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { EnrichmentPerson } from '@/lib/fullenrich/client';

interface EnrichmentReviewModalProps {
  open: boolean;
  onClose: () => void;
  enrichmentData: EnrichmentPerson | null;
  currentPerson: {
    email?: string | null;
    phone?: string | null;
    job_title?: string | null;
    linkedin_url?: string | null;
    address_city?: string | null;
    address_state?: string | null;
    address_country?: string | null;
  };
  onApply: (selectedFields: Record<string, string | null>) => Promise<void>;
  isApplying?: boolean;
}

interface SelectableField {
  key: string;
  label: string;
  value: string;
  type?: string;
  status?: string;
  icon: React.ReactNode;
  currentValue?: string | null;
}

export function EnrichmentReviewModal({
  open,
  onClose,
  enrichmentData,
  currentPerson,
  onApply,
  isApplying = false,
}: EnrichmentReviewModalProps) {
  const [selectedFields, setSelectedFields] = useState<Record<string, string>>({});

  if (!enrichmentData) return null;

  // Build selectable fields from enrichment data
  const emailFields: SelectableField[] = [];
  const phoneFields: SelectableField[] = [];
  const otherFields: SelectableField[] = [];

  // Process emails
  if (enrichmentData.all_emails && enrichmentData.all_emails.length > 0) {
    enrichmentData.all_emails.forEach((e, i) => {
      emailFields.push({
        key: `email_${i}`,
        label: e.type ? `${e.type} email` : 'Email',
        value: e.email,
        type: e.type,
        status: e.status,
        icon: <Mail className="h-4 w-4" />,
        currentValue: currentPerson.email,
      });
    });
  } else if (enrichmentData.email) {
    emailFields.push({
      key: 'email_0',
      label: 'Email',
      value: enrichmentData.email,
      icon: <Mail className="h-4 w-4" />,
      currentValue: currentPerson.email,
    });
  }

  // Process phones
  if (enrichmentData.all_phones && enrichmentData.all_phones.length > 0) {
    enrichmentData.all_phones.forEach((p, i) => {
      phoneFields.push({
        key: `phone_${i}`,
        label: p.type ? `${p.type} phone` : 'Phone',
        value: p.phone,
        type: p.type,
        icon: <Phone className="h-4 w-4" />,
        currentValue: currentPerson.phone,
      });
    });
  } else if (enrichmentData.phone) {
    phoneFields.push({
      key: 'phone_0',
      label: 'Phone',
      value: enrichmentData.phone,
      icon: <Phone className="h-4 w-4" />,
      currentValue: currentPerson.phone,
    });
  }

  // Process other fields
  if (enrichmentData.job_title) {
    otherFields.push({
      key: 'job_title',
      label: 'Job Title',
      value: enrichmentData.job_title,
      icon: <Briefcase className="h-4 w-4" />,
      currentValue: currentPerson.job_title,
    });
  }

  if (enrichmentData.linkedin_url) {
    otherFields.push({
      key: 'linkedin_url',
      label: 'LinkedIn',
      value: enrichmentData.linkedin_url,
      icon: <Linkedin className="h-4 w-4" />,
      currentValue: currentPerson.linkedin_url,
    });
  }

  if (enrichmentData.location?.city || enrichmentData.location?.state || enrichmentData.location?.country) {
    const locationParts = [
      enrichmentData.location.city,
      enrichmentData.location.state,
      enrichmentData.location.country,
    ].filter(Boolean);

    if (locationParts.length > 0) {
      otherFields.push({
        key: 'location',
        label: 'Location',
        value: locationParts.join(', '),
        icon: <MapPin className="h-4 w-4" />,
        currentValue: [currentPerson.address_city, currentPerson.address_state, currentPerson.address_country]
          .filter(Boolean)
          .join(', ') || null,
      });
    }
  }

  const allFields = [...emailFields, ...phoneFields, ...otherFields];
  const hasData = allFields.length > 0;

  const toggleField = (field: SelectableField) => {
    setSelectedFields((prev) => {
      const newSelected = { ...prev };
      if (newSelected[field.key]) {
        delete newSelected[field.key];
      } else {
        newSelected[field.key] = field.value;
      }
      return newSelected;
    });
  };

  const handleApply = async () => {
    // Convert selected fields to the format expected by the API
    const updates: Record<string, string | null> = {};

    Object.entries(selectedFields).forEach(([key, value]) => {
      if (key.startsWith('email_')) {
        updates.email = value;
      } else if (key.startsWith('phone_')) {
        updates.phone = value;
      } else if (key === 'job_title') {
        updates.job_title = value;
      } else if (key === 'linkedin_url') {
        updates.linkedin_url = value;
      } else if (key === 'location' && enrichmentData?.location) {
        if (enrichmentData.location.city) updates.address_city = enrichmentData.location.city;
        if (enrichmentData.location.state) updates.address_state = enrichmentData.location.state;
        if (enrichmentData.location.country) updates.address_country = enrichmentData.location.country;
      }
    });

    await onApply(updates);
  };

  const renderFieldRow = (field: SelectableField) => {
    const isSelected = !!selectedFields[field.key];
    const willOverwrite = field.currentValue && field.currentValue !== field.value;

    return (
      <div
        key={field.key}
        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
          isSelected
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-muted-foreground/50'
        }`}
        onClick={() => toggleField(field)}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleField(field)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {field.icon}
            <Label className="text-sm font-medium capitalize cursor-pointer">
              {field.label}
            </Label>
            {field.type && (
              <Badge variant="secondary" className="text-xs">
                {field.type}
              </Badge>
            )}
            {field.status && (
              <Badge
                variant={field.status === 'DELIVERABLE' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {field.status.toLowerCase()}
              </Badge>
            )}
          </div>
          <p className="text-sm text-foreground mt-1 truncate">{field.value}</p>
          {field.currentValue && (
            <p className="text-xs text-muted-foreground mt-1">
              {willOverwrite ? (
                <span className="text-amber-600">
                  Will replace: {field.currentValue}
                </span>
              ) : (
                <span className="text-green-600 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Same as current
                </span>
              )}
            </p>
          )}
          {!field.currentValue && (
            <p className="text-xs text-green-600 mt-1">New field</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Enrichment Data</DialogTitle>
          <DialogDescription>
            Select which fields you want to save to this person's record.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {!hasData ? (
            <div className="text-center py-8 text-muted-foreground">
              No enrichment data found for this person.
            </div>
          ) : (
            <>
              {emailFields.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Emails ({emailFields.length})
                  </h4>
                  <div className="space-y-2">
                    {emailFields.map(renderFieldRow)}
                  </div>
                </div>
              )}

              {phoneFields.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Phone Numbers ({phoneFields.length})
                  </h4>
                  <div className="space-y-2">
                    {phoneFields.map(renderFieldRow)}
                  </div>
                </div>
              )}

              {otherFields.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Other Information
                  </h4>
                  <div className="space-y-2">
                    {otherFields.map(renderFieldRow)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isApplying}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={Object.keys(selectedFields).length === 0 || isApplying}
          >
            {isApplying ? 'Applying...' : `Apply ${Object.keys(selectedFields).length} Field${Object.keys(selectedFields).length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
