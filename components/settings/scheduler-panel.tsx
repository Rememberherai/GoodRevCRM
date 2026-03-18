'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Pause,
  CircleDot,
  ExternalLink,
  RefreshCw,
  Wand2,
  Info,
  Database,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { type CronTemplate, type CronJobSchedule, SCHEDULE_PRESETS, describeSchedule } from '@/lib/scheduler/templates';
import { isJobStatusOk } from '@/lib/scheduler/cronjob-org';
import type { SchedulerProviderType } from '@/lib/scheduler/provider';

// ---------- Types ----------

interface SchedulerJob {
  template: CronTemplate;
  job: {
    jobId: string;
    enabled: boolean;
    url: string;
    schedule: CronJobSchedule;
    lastStatus: number;
    lastDuration: number;
    lastExecution: number;
    nextExecution: number | null;
  } | null;
}

interface HistoryEntry {
  identifier: string;
  date: number;
  datePlanned: number;
  duration: number;
  status: number;
  statusText: string;
  httpStatus: number;
}

interface SchedulerPanelProps {
  slug: string;
}

const PROVIDER_OPTIONS: { value: SchedulerProviderType; label: string; description: string; icon: typeof Globe }[] = [
  {
    value: 'cronjob_org',
    label: 'cron-job.org',
    description: 'External service, free tier (100 API calls/day)',
    icon: Globe,
  },
  {
    value: 'supabase_pgcron',
    label: 'Supabase pg_cron',
    description: 'Built-in database scheduler, no external service needed',
    icon: Database,
  },
];

// ---------- Component ----------

export function SchedulerPanel({ slug }: SchedulerPanelProps) {
  // Provider state
  const [selectedProvider, setSelectedProvider] = useState<SchedulerProviderType>('cronjob_org');
  const [activeProvider, setActiveProvider] = useState<SchedulerProviderType | null>(null);

  // Setup state
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [cronSecret, setCronSecret] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);

  // Jobs state
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Per-job action state
  const [creatingJob, setCreatingJob] = useState<string | null>(null);
  const [togglingJob, setTogglingJob] = useState<string | null>(null);
  const [deletingJob, setDeletingJob] = useState<string | null>(null);
  const [changingSchedule, setChangingSchedule] = useState<string | null>(null);

  // History state
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);

  // ---------- Fetch jobs ----------

  const fetchJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/projects/${slug}/scheduler/jobs`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setConfigured(data.configured);
      setJobs(data.jobs ?? []);
      if (data.providerType) {
        setActiveProvider(data.providerType);
        setSelectedProvider(data.providerType);
      }
      if (data.configured) setSetupOpen(false);
    } catch {
      toast.error('Failed to load scheduler jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // ---------- Fetch existing config for setup display ----------

  const [existingConfig, setExistingConfig] = useState<{
    apiKeySet: boolean;
    cronSecretSet: boolean;
    baseUrlSet: boolean;
    providerSet: boolean;
  } | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(`/api/projects/${slug}/secrets?include_hidden=true`);
        if (!res.ok) return;
        const data = await res.json();
        const secrets: Array<{ key_name: string; is_set: boolean }> = data.secrets ?? [];
        setExistingConfig({
          apiKeySet: secrets.find((s) => s.key_name === 'cronjob_org_api_key')?.is_set ?? false,
          cronSecretSet: secrets.find((s) => s.key_name === 'cron_secret')?.is_set ?? false,
          baseUrlSet: secrets.find((s) => s.key_name === 'scheduler_base_url')?.is_set ?? false,
          providerSet: secrets.find((s) => s.key_name === 'scheduler_provider')?.is_set ?? false,
        });
      } catch {
        // ignore
      }
    }
    loadConfig();
  }, [slug]);

  // ---------- Save setup ----------

  const saveSecret = async (keyName: string, value: string) => {
    const res = await fetch(`/api/projects/${slug}/secrets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key_name: keyName, value }),
    });
    if (!res.ok) throw new Error(`Failed to save ${keyName}`);
  };

  const handleSaveSetup = async () => {
    // Validate before starting any saves
    if (selectedProvider === 'cronjob_org' && !apiKey && !existingConfig?.apiKeySet) {
      toast.error('API key is required for cron-job.org');
      return;
    }

    setSavingSetup(true);
    try {
      const saves: Promise<void>[] = [];

      // Always save the provider choice
      saves.push(saveSecret('scheduler_provider', selectedProvider));

      if (selectedProvider === 'cronjob_org' && apiKey) {
        saves.push(saveSecret('cronjob_org_api_key', apiKey));
      }
      if (cronSecret) saves.push(saveSecret('cron_secret', cronSecret));
      if (baseUrl) saves.push(saveSecret('scheduler_base_url', baseUrl));

      await Promise.all(saves);
      toast.success('Scheduler configuration saved');
      setApiKey('');
      setCronSecret('');
      setBaseUrl('');
      // Re-fetch everything
      setLoading(true);
      await fetchJobs();
      // Reload config state
      const res = await fetch(`/api/projects/${slug}/secrets?include_hidden=true`);
      if (res.ok) {
        const data = await res.json();
        const secrets: Array<{ key_name: string; is_set: boolean }> = data.secrets ?? [];
        setExistingConfig({
          apiKeySet: secrets.find((s) => s.key_name === 'cronjob_org_api_key')?.is_set ?? false,
          cronSecretSet: secrets.find((s) => s.key_name === 'cron_secret')?.is_set ?? false,
          baseUrlSet: secrets.find((s) => s.key_name === 'scheduler_base_url')?.is_set ?? false,
          providerSet: secrets.find((s) => s.key_name === 'scheduler_provider')?.is_set ?? false,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSavingSetup(false);
    }
  };

  const generateCronSecret = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const hex = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    setCronSecret(hex);
  };

  // ---------- Job actions ----------

  const handleCreateJob = async (templateKey: string) => {
    setCreatingJob(templateKey);
    try {
      const res = await fetch(`/api/projects/${slug}/scheduler/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create job');
      }
      toast.success('Cron job created');
      await fetchJobs(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setCreatingJob(null);
    }
  };

  const handleToggleJob = async (jobId: string, enabled: boolean) => {
    setTogglingJob(jobId);
    try {
      const res = await fetch(`/api/projects/${slug}/scheduler/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update job');
      }
      toast.success(enabled ? 'Job enabled' : 'Job paused');
      await fetchJobs(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update job');
    } finally {
      setTogglingJob(null);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    setDeletingJob(jobId);
    try {
      const res = await fetch(`/api/projects/${slug}/scheduler/jobs/${jobId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete job');
      }
      toast.success('Cron job deleted');
      setHistory((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      await fetchJobs(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete job');
    } finally {
      setDeletingJob(null);
    }
  };

  const handleChangeSchedule = async (jobId: string, presetLabel: string) => {
    const preset = SCHEDULE_PRESETS.find((p) => p.label === presetLabel);
    if (!preset) return;

    setChangingSchedule(jobId);
    try {
      const res = await fetch(`/api/projects/${slug}/scheduler/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule: {
            hours: preset.schedule.hours,
            minutes: preset.schedule.minutes,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update schedule');
      }
      toast.success(`Schedule updated to ${presetLabel}`);
      await fetchJobs(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update schedule');
    } finally {
      setChangingSchedule(null);
    }
  };

  // ---------- History ----------

  const handleToggleHistory = async (jobId: string) => {
    if (expandedJob === jobId) {
      setExpandedJob(null);
      return;
    }

    setExpandedJob(jobId);

    if (history[jobId]) return; // Already loaded

    setLoadingHistory(jobId);
    try {
      const res = await fetch(`/api/projects/${slug}/scheduler/jobs/${jobId}/history`);
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();
      setHistory((prev) => ({ ...prev, [jobId]: data.history ?? [] }));
    } catch {
      toast.error('Failed to load execution history');
    } finally {
      setLoadingHistory(null);
    }
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
  const providerLabel = activeProvider === 'supabase_pgcron' ? 'pg_cron' : 'cron-job.org';

  return (
    <div className="space-y-6">
      {/* Setup Section */}
      <Card>
        <Collapsible open={setupOpen} onOpenChange={setSetupOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Scheduler Configuration
                    {activeProvider && configured && (
                      <Badge variant="outline" className="text-xs font-normal ml-1">
                        {providerLabel}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Configure a cron provider to manage scheduled tasks
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {configured && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                  {setupOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6 border-t pt-6">
              {/* Provider Selector */}
              <div className="space-y-3">
                <Label>Cron Provider</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROVIDER_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = selectedProvider === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedProvider(option.value)}
                        className={`flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/30'
                        }`}
                      >
                        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div>
                          <div className={`font-medium text-sm ${isSelected ? 'text-primary' : ''}`}>
                            {option.label}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {option.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Instructions — provider-specific */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {selectedProvider === 'cronjob_org' ? (
                      <>
                        <p className="font-medium text-foreground">How to set up with cron-job.org:</p>
                        <ol className="list-decimal list-inside space-y-1.5">
                          <li>
                            Create a free account at{' '}
                            <a
                              href="https://cron-job.org"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline inline-flex items-center gap-1"
                            >
                              cron-job.org <ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                          <li>
                            Go to <strong>Settings</strong> in your cron-job.org dashboard and generate an <strong>API Key</strong>
                          </li>
                          <li>Paste the API key below</li>
                          <li>Set a <strong>Cron Secret</strong> to authenticate callbacks</li>
                          <li>Verify the <strong>Base URL</strong> matches your deployed app</li>
                          <li>Click <strong>Save Configuration</strong>, then create your cron jobs below</li>
                        </ol>
                        <p className="text-xs mt-2">
                          Free tier: 100 management API calls/day. Actual cron executions are <strong>unlimited</strong>.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-foreground">How to set up with Supabase pg_cron:</p>
                        <ol className="list-decimal list-inside space-y-1.5">
                          <li>
                            Ensure the <strong>pg_cron</strong> and <strong>pg_net</strong> extensions are enabled in your{' '}
                            <a
                              href="https://supabase.com/dashboard/project/_/database/extensions"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline inline-flex items-center gap-1"
                            >
                              Supabase dashboard <ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                          <li>Set a <strong>Cron Secret</strong> to authenticate callbacks (or auto-generate one)</li>
                          <li>Verify the <strong>Base URL</strong> matches your deployed app</li>
                          <li>Click <strong>Save Configuration</strong>, then create your cron jobs below</li>
                        </ol>
                        <p className="text-xs mt-2">
                          pg_cron runs inside your database. No external service or API key required.
                          Jobs execute SQL that calls your endpoints via pg_net HTTP requests.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* API Key — only for cron-job.org */}
              {selectedProvider === 'cronjob_org' && (
                <div className="space-y-2">
                  <Label htmlFor="cronjob-api-key">cron-job.org API Key</Label>
                  <Input
                    id="cronjob-api-key"
                    type="password"
                    placeholder="Your cron-job.org API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  {existingConfig?.apiKeySet && !apiKey && (
                    <p className="text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 inline mr-1 text-green-600" />
                      API key is configured. Enter a new value to replace it.
                    </p>
                  )}
                </div>
              )}

              {/* Cron Secret */}
              <div className="space-y-2">
                <Label htmlFor="cron-secret">Cron Secret</Label>
                <div className="flex gap-2">
                  <Input
                    id="cron-secret"
                    type="text"
                    placeholder="Bearer token for cron endpoint auth"
                    value={cronSecret}
                    onChange={(e) => setCronSecret(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateCronSecret}
                    className="shrink-0"
                  >
                    <Wand2 className="h-4 w-4 mr-1" />
                    Generate
                  </Button>
                </div>
                {existingConfig?.cronSecretSet && !cronSecret && (
                  <p className="text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 inline mr-1 text-green-600" />
                    Cron secret is configured. Enter a new value to replace it.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  This token is sent as a Bearer token when the cron provider calls your endpoints to verify authenticity.
                </p>
              </div>

              {/* Base URL */}
              <div className="space-y-2">
                <Label htmlFor="base-url">Base URL</Label>
                <Input
                  id="base-url"
                  type="url"
                  placeholder={process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
                {isLocalhost && baseUrl && (
                  <p className="text-xs text-amber-600">
                    Localhost URLs won&apos;t work with external cron providers. Use your deployed app URL.
                  </p>
                )}
                {existingConfig?.baseUrlSet && !baseUrl && (
                  <p className="text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 inline mr-1 text-green-600" />
                    Base URL is configured. Enter a new value to replace it.
                  </p>
                )}
                {!existingConfig?.baseUrlSet && !baseUrl && process.env.NEXT_PUBLIC_APP_URL && (
                  <p className="text-xs text-muted-foreground">
                    Defaults to: {process.env.NEXT_PUBLIC_APP_URL}
                  </p>
                )}
              </div>

              {/* Save */}
              <Button
                onClick={handleSaveSetup}
                disabled={savingSetup}
              >
                {savingSetup && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Configuration
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Cron Jobs Section */}
      {configured && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Scheduled Jobs</CardTitle>
                <CardDescription>
                  Create and manage cron jobs for your app endpoints
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchJobs(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobs.map(({ template, job }) => (
              <JobCard
                key={template.key}
                template={template}
                job={job}
                providerType={activeProvider}
                isCreating={creatingJob === template.key}
                isToggling={togglingJob === job?.jobId}
                isDeleting={deletingJob === job?.jobId}
                isChangingSchedule={changingSchedule === job?.jobId}
                isExpanded={expandedJob === job?.jobId}
                historyEntries={job?.jobId ? history[job.jobId] : undefined}
                isLoadingHistory={loadingHistory === job?.jobId}
                onCreateJob={() => handleCreateJob(template.key)}
                onToggleJob={(enabled) => job && handleToggleJob(job.jobId, enabled)}
                onDeleteJob={() => job && handleDeleteJob(job.jobId)}
                onChangeSchedule={(preset) => job && handleChangeSchedule(job.jobId, preset)}
                onToggleHistory={() => job && handleToggleHistory(job.jobId)}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- Job Card ----------

interface JobCardProps {
  template: CronTemplate;
  job: SchedulerJob['job'];
  providerType: SchedulerProviderType | null;
  isCreating: boolean;
  isToggling: boolean | null;
  isDeleting: boolean | null;
  isChangingSchedule: boolean | null;
  isExpanded: boolean;
  historyEntries?: HistoryEntry[];
  isLoadingHistory: boolean | null;
  onCreateJob: () => void;
  onToggleJob: (enabled: boolean) => void;
  onDeleteJob: () => void;
  onChangeSchedule: (preset: string) => void;
  onToggleHistory: () => void;
}

function JobCard({
  template,
  job,
  providerType,
  isCreating,
  isToggling,
  isDeleting,
  isChangingSchedule,
  isExpanded,
  historyEntries,
  isLoadingHistory,
  onCreateJob,
  onToggleJob,
  onDeleteJob,
  onChangeSchedule,
  onToggleHistory,
}: JobCardProps) {
  const providerName = providerType === 'supabase_pgcron' ? 'pg_cron' : 'cron-job.org';

  return (
    <div className="rounded-lg border p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{template.title}</h4>
            {job ? (
              job.enabled ? (
                <Badge variant="default" className="bg-green-600 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-yellow-600 text-xs">
                  <Pause className="h-3 w-3 mr-1" />
                  Paused
                </Badge>
              )
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-xs">
                <CircleDot className="h-3 w-3 mr-1" />
                Not Created
              </Badge>
            )}
            {job && !isJobStatusOk(job.lastStatus) && job.lastStatus !== 0 && (
              <Badge variant="destructive" className="text-xs">
                <XCircle className="h-3 w-3 mr-1" />
                Error
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{template.description}</p>
          <p className="text-xs text-muted-foreground font-mono">{template.path}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {job ? (
            <>
              <Switch
                checked={job.enabled}
                onCheckedChange={onToggleJob}
                disabled={!!isToggling}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete cron job?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the &quot;{template.title}&quot; job from {providerName}.
                      You can recreate it later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDeleteJob}
                      className="bg-destructive text-white hover:bg-destructive/90"
                      disabled={!!isDeleting}
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <Button size="sm" onClick={onCreateJob} disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Create
            </Button>
          )}
        </div>
      </div>

      {/* Schedule & details (only for created jobs) */}
      {job && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {/* Schedule selector */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Schedule:</span>
            {(() => {
              const currentLabel = describeSchedule(job.schedule);
              const matchingPreset = SCHEDULE_PRESETS.find((p) => p.label === currentLabel);
              return (
                <Select
                  value={matchingPreset ? matchingPreset.label : '__custom__'}
                  onValueChange={(val) => {
                    if (val !== '__custom__') onChangeSchedule(val);
                  }}
                  disabled={!!isChangingSchedule}
                >
                  <SelectTrigger className="h-8 w-[180px]">
                    <SelectValue>
                      {matchingPreset ? matchingPreset.label : currentLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {!matchingPreset && (
                      <SelectItem value="__custom__" disabled>
                        {currentLabel}
                      </SelectItem>
                    )}
                    {SCHEDULE_PRESETS.map((preset) => (
                      <SelectItem key={preset.label} value={preset.label}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            })()}
            {isChangingSchedule && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>

          {/* Last execution */}
          {job.lastExecution > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <span>Last run:</span>
              <span className={isJobStatusOk(job.lastStatus) ? 'text-green-600' : 'text-red-600'}>
                {new Date(job.lastExecution * 1000).toLocaleString()} ({job.lastDuration}ms)
              </span>
            </div>
          )}

          {/* Next execution */}
          {job.nextExecution && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <span>Next:</span>
              <span>{new Date(job.nextExecution * 1000).toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* History (expandable) */}
      {job && (
        <Collapsible open={isExpanded} onOpenChange={() => onToggleHistory()}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 px-2">
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 mr-1" />
              ) : (
                <ChevronRight className="h-3 w-3 mr-1" />
              )}
              Execution History
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 rounded border">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : historyEntries && historyEntries.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">Time</th>
                      <th className="text-left p-2 font-medium">Status</th>
                      <th className="text-left p-2 font-medium">HTTP</th>
                      <th className="text-right p-2 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyEntries.map((entry) => (
                      <tr key={entry.identifier} className="border-b last:border-0">
                        <td className="p-2 text-muted-foreground">
                          {new Date(entry.date * 1000).toLocaleString()}
                        </td>
                        <td className="p-2">
                          <span
                            className={
                              isJobStatusOk(entry.status)
                                ? 'text-green-600'
                                : 'text-red-600'
                            }
                          >
                            {entry.statusText}
                          </span>
                        </td>
                        <td className="p-2 text-muted-foreground">{entry.httpStatus || '-'}</td>
                        <td className="p-2 text-right text-muted-foreground">
                          {entry.duration}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center py-4 text-muted-foreground text-xs">
                  No execution history yet
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
