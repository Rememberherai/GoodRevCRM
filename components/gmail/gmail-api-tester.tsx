'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { FlaskConical, Play, Send, Loader2, CheckCircle2, XCircle, Clock, Info, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface TestResult {
  status: 'pass' | 'fail';
  message: string;
  duration_ms: number;
  details?: Record<string, unknown>;
}

interface TestResults {
  connection?: TestResult;
  send_permission?: TestResult;
  read_permission?: TestResult;
  send_test_email?: TestResult;
  watch_registration?: TestResult;
  history_sync?: TestResult;
  contact_matching?: TestResult;
}

interface ConnectionOption {
  id: string;
  email: string;
  status: string;
}

function TestResultRow({
  label,
  description,
  result,
  running,
}: {
  label: string;
  description: string;
  result?: TestResult;
  running?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        {result && result.status === 'fail' && (
          <p className="text-xs text-destructive mt-1">{result.message}</p>
        )}
        {result && result.status === 'pass' && (
          <p className="text-xs text-muted-foreground mt-1">{result.message}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : result ? (
          <>
            {result.status === 'pass' ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Pass
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                <XCircle className="h-3 w-3 mr-1" />
                Fail
              </Badge>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {result.duration_ms}ms
            </span>
          </>
        ) : (
          <Badge variant="secondary" className="text-muted-foreground">
            Pending
          </Badge>
        )}
      </div>
    </div>
  );
}

export function GmailApiTester() {
  const [connections, setConnections] = useState<ConnectionOption[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testingSync, setTestingSync] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [results, setResults] = useState<TestResults | null>(null);
  const [syncResults, setSyncResults] = useState<TestResults | null>(null);
  const [testEmailResult, setTestEmailResult] = useState<TestResult | null>(null);
  const [tokenRefreshed, setTokenRefreshed] = useState(false);

  useEffect(() => {
    async function fetchConnections() {
      try {
        const response = await fetch('/api/gmail/connections');
        if (response.ok) {
          const data = await response.json();
          const connected = (data.connections ?? []).filter(
            (c: ConnectionOption) => c.status === 'connected'
          );
          setConnections(connected);
          if (connected.length === 1) {
            setSelectedConnectionId(connected[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching connections:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchConnections();
  }, []);

  const selectedEmail = connections.find((c) => c.id === selectedConnectionId)?.email;

  const runDiagnostics = async () => {
    if (!selectedConnectionId) return;
    setTesting(true);
    setResults(null);
    setTokenRefreshed(false);

    try {
      const response = await fetch('/api/gmail/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_id: selectedConnectionId,
          tests: ['connection', 'send_permission', 'read_permission'],
          send_test_email: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to run diagnostics');
        return;
      }

      const data = await response.json();
      setResults(data.results);
      setTokenRefreshed(data.token_refreshed);

      const allPassed = Object.values(data.results as TestResults).every(
        (r) => r?.status === 'pass'
      );
      if (allPassed) {
        toast.success('All diagnostics passed');
      } else {
        toast.error('Some diagnostics failed');
      }
    } catch (error) {
      console.error('Error running diagnostics:', error);
      toast.error('Failed to run diagnostics');
    } finally {
      setTesting(false);
    }
  };

  const runSyncDiagnostics = async () => {
    if (!selectedConnectionId) return;
    setTestingSync(true);
    setSyncResults(null);

    try {
      const response = await fetch('/api/gmail/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_id: selectedConnectionId,
          tests: ['watch_registration', 'history_sync', 'contact_matching'],
          send_test_email: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to run sync diagnostics');
        return;
      }

      const data = await response.json();
      setSyncResults(data.results);

      const allPassed = ['watch_registration', 'history_sync', 'contact_matching'].every(
        (key) => data.results[key]?.status === 'pass'
      );
      if (allPassed) {
        toast.success('All sync diagnostics passed');
      } else {
        toast.error('Some sync diagnostics failed');
      }
    } catch (error) {
      console.error('Error running sync diagnostics:', error);
      toast.error('Failed to run sync diagnostics');
    } finally {
      setTestingSync(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!selectedConnectionId) return;
    setSendingTestEmail(true);
    setTestEmailResult(null);

    try {
      const response = await fetch('/api/gmail/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_id: selectedConnectionId,
          tests: [],
          send_test_email: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to send test email');
        return;
      }

      const data = await response.json();
      setTestEmailResult(data.results.send_test_email ?? null);

      if (data.results.send_test_email?.status === 'pass') {
        toast.success('Test email sent — check your inbox');
      } else {
        toast.error('Failed to send test email');
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      toast.error('Failed to send test email');
    } finally {
      setSendingTestEmail(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Gmail API Tester
        </CardTitle>
        <CardDescription>
          Test your Gmail connection and verify API permissions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : connections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No connected Gmail accounts</p>
            <p className="text-sm mt-1">
              Connect a Gmail account above to test the API
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {connections.length > 1 && (
              <div>
                <label className="text-sm font-medium mb-2 block">Gmail Account</label>
                <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a Gmail account" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {connections.length === 1 && (
              <p className="text-sm text-muted-foreground">
                Testing: <span className="font-medium text-foreground">{selectedEmail}</span>
              </p>
            )}

            <Button
              onClick={runDiagnostics}
              disabled={testing || !selectedConnectionId}
              size="sm"
            >
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run Diagnostics
            </Button>

            {results && (
              <div className="space-y-2">
                <TestResultRow
                  label="Connection"
                  description="Verify access token is valid"
                  result={results.connection}
                  running={testing}
                />
                <TestResultRow
                  label="Send Permission"
                  description="Verify Gmail send scope is active"
                  result={results.send_permission}
                  running={testing}
                />
                <TestResultRow
                  label="Read Permission"
                  description="Verify Gmail read scope is active"
                  result={results.read_permission}
                  running={testing}
                />
              </div>
            )}

            {tokenRefreshed && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                <Info className="h-4 w-4 flex-shrink-0" />
                Token was automatically refreshed during testing.
              </div>
            )}

            <Separator />

            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium">Inbound Email Sync</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Test Pub/Sub watch, history API, and contact matching
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={runSyncDiagnostics}
                disabled={testingSync || !selectedConnectionId}
              >
                {testingSync ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Test Inbound Sync
              </Button>
              {syncResults && (
                <div className="space-y-2">
                  <TestResultRow
                    label="Watch Registration"
                    description="Register Pub/Sub push notifications with Gmail"
                    result={syncResults.watch_registration}
                    running={testingSync}
                  />
                  <TestResultRow
                    label="History API"
                    description="Verify Gmail history and message listing works"
                    result={syncResults.history_sync}
                    running={testingSync}
                  />
                  <TestResultRow
                    label="Contact Matching"
                    description="Match recent inbox senders to CRM contacts"
                    result={syncResults.contact_matching}
                    running={testingSync}
                  />
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium">Send Test Email</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Send a test email to your own address ({selectedEmail})
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendTestEmail}
                disabled={sendingTestEmail || !selectedConnectionId}
              >
                {sendingTestEmail ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send Test Email
              </Button>
              {testEmailResult && (
                <TestResultRow
                  label="Test Email"
                  description="Send email to yourself"
                  result={testEmailResult}
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
