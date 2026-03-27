'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { communityResources, standardResources, RESOURCE_HIERARCHY } from '@/lib/validators/user';
import type { ProjectType } from '@/types/project';
import type { ProjectRole } from '@/types/user';

interface Override {
  id: string;
  resource: string;
  granted: boolean;
}

type OverrideState = 'default' | 'granted' | 'denied';

interface MemberPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  projectType: ProjectType;
  userId: string;
  memberName: string;
  memberRole: ProjectRole;
}

const resourceLabels: Record<string, string> = {
  // Community
  households: 'Households',
  intake: 'Intake',
  programs: 'Programs',
  contributions: 'Contributions',
  community_assets: 'Community Assets',
  risk_scores: 'Risk Scores',
  referrals: 'Referrals',
  relationships: 'Relationships',
  broadcasts: 'Broadcasts',
  jobs: 'Workforce',
  assistant_ap: 'AI Assistant',
  public_dashboard: 'Public Dashboard',
  events: 'Events',
  // Standard
  contacts: 'Contacts',
  pipelines: 'Pipelines',
  automations: 'Automations',
  // Shared
  grants: 'Grants',
  dashboard: 'Dashboard',
  reports: 'Reports',
  settings: 'Settings',
};

function OverrideToggle({
  value,
  onChange,
  disabled,
}: {
  value: OverrideState;
  onChange: (v: OverrideState) => void;
  disabled?: boolean;
}) {
  const options: { value: OverrideState; label: string }[] = [
    { value: 'default', label: 'Default' },
    { value: 'granted', label: 'Granted' },
    { value: 'denied', label: 'Denied' },
  ];

  return (
    <div className="flex rounded-md border overflow-hidden text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={[
            'px-2.5 py-1 transition-colors',
            value === opt.value
              ? opt.value === 'granted'
                ? 'bg-green-600 text-white'
                : opt.value === 'denied'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-muted text-foreground font-medium'
              : 'bg-background text-muted-foreground hover:bg-muted/60',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function MemberPermissionsDialog({
  open,
  onOpenChange,
  projectSlug,
  projectType,
  userId,
  memberName,
  memberRole,
}: MemberPermissionsDialogProps) {
  const [overrides, setOverrides] = useState<Record<string, OverrideState>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const resources = (projectType === 'community' ? communityResources : standardResources) as readonly string[];

  function toggleExpanded(resource: string) {
    setExpanded((s) => ({ ...s, [resource]: !s[resource] }));
  }

  useEffect(() => {
    if (!open) {
      setOverrides({});
      setSaving({});
      setExpanded({});
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/projects/${projectSlug}/members/${userId}/overrides`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: Override[]) => {
        const map: Record<string, OverrideState> = {};
        for (const o of data) {
          map[o.resource] = o.granted ? 'granted' : 'denied';
        }
        setOverrides(map);
      })
      .catch(() => {/* aborted or error — leave state as-is */})
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [open, projectSlug, userId]);

  const handleChange = async (resource: string, value: OverrideState) => {
    const prev = overrides[resource] ?? 'default';
    setOverrides((s) => ({ ...s, [resource]: value }));
    setSaving((s) => ({ ...s, [resource]: true }));

    try {
      if (value === 'default') {
        const res = await fetch(
          `/api/projects/${projectSlug}/members/${userId}/overrides/${resource}`,
          { method: 'DELETE' }
        );
        if (!res.ok && res.status !== 404) throw new Error();
      } else {
        const res = await fetch(
          `/api/projects/${projectSlug}/members/${userId}/overrides`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resource, granted: value === 'granted' }),
          }
        );
        if (!res.ok) throw new Error();
      }
    } catch {
      // Revert on error
      setOverrides((s) => ({ ...s, [resource]: prev }));
    } finally {
      setSaving((s) => ({ ...s, [resource]: false }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize permissions</DialogTitle>
          <DialogDescription>
            Overrides for <span className="font-medium text-foreground">{memberName}</span>{' '}
            ({memberRole}). These apply on top of their base role.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y max-h-[60vh] overflow-y-auto -mx-6 px-6">
            {resources.map((resource) => {
              const children = RESOURCE_HIERARCHY[resource];
              const hasChildren = children && children.length > 0;
              const isExpanded = expanded[resource] === true;
              const parentDenied = (overrides[resource] ?? 'default') === 'denied';

              return (
                <div key={resource}>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-1">
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(resource)}
                          className="p-0.5 -ml-1 rounded hover:bg-muted transition-colors"
                        >
                          <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                      ) : (
                        <span className="w-4.5" />
                      )}
                      <span className="text-sm font-medium">
                        {resourceLabels[resource] ?? resource}
                      </span>
                    </div>
                    <div className="relative">
                      {saving[resource] && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground absolute -left-5 top-1/2 -translate-y-1/2" />
                      )}
                      <OverrideToggle
                        value={overrides[resource] ?? 'default'}
                        onChange={(v) => void handleChange(resource, v)}
                        disabled={saving[resource]}
                      />
                    </div>
                  </div>
                  {hasChildren && isExpanded && !parentDenied && (
                    <div className="pb-2">
                      {children.map((child) => (
                        <div key={child.key} className="flex items-center justify-between py-1.5 pl-7">
                          <span className="text-sm text-muted-foreground">
                            {child.label}
                          </span>
                          <div className="relative">
                            {saving[child.key] && (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground absolute -left-5 top-1/2 -translate-y-1/2" />
                            )}
                            <OverrideToggle
                              value={overrides[child.key] ?? 'default'}
                              onChange={(v) => void handleChange(child.key, v)}
                              disabled={saving[child.key]}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {hasChildren && isExpanded && parentDenied && (
                    <div className="pb-2 pl-7">
                      <p className="text-xs text-muted-foreground italic">
                        All sub-tabs denied because {resourceLabels[resource] ?? resource} is denied.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
