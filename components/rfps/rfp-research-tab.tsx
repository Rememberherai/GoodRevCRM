'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Clock, AlertCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useRfpResearch } from '@/hooks/use-rfp-research';
import { RfpResearchDisplay } from './rfp-research-display';

interface RfpResearchTabProps {
  rfpId: string;
  organizationName?: string;
}

export function RfpResearchTab({ rfpId, organizationName }: RfpResearchTabProps) {
  const { results, latest, isLoading, isRunning, error, runResearch, cancelResearch } =
    useRfpResearch(rfpId);
  const [additionalContext, setAdditionalContext] = useState('');
  const [showContextInput, setShowContextInput] = useState(false);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);

  const displayResult = selectedResultId
    ? results.find((r) => r.id === selectedResultId)
    : latest;

  const handleRunResearch = async () => {
    setShowContextInput(false);
    await runResearch(additionalContext || undefined);
    setAdditionalContext('');
    setSelectedResultId(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No research yet
  if (!latest && !isRunning) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>AI Research</CardTitle>
          <CardDescription>
            Run AI-powered research to gather competitive intelligence about this RFP
            {organizationName && ` and ${organizationName}`}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {showContextInput ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="context">Additional Context (optional)</Label>
                <Textarea
                  id="context"
                  placeholder="Add any specific areas you want the research to focus on, or additional context about your company's positioning..."
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleRunResearch}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Start Research
                </Button>
                <Button variant="outline" onClick={() => setShowContextInput(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center gap-2">
              <Button onClick={() => setShowContextInput(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Run AI Research
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Research is running
  if (isRunning) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <CardTitle>Researching...</CardTitle>
          <CardDescription>
            AI is scouring the web for information about this RFP. This may take a minute or two.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            <p>Gathering intelligence on:</p>
            <ul className="mt-2 space-y-1">
              <li>Organization profile and history</li>
              <li>Industry context and market trends</li>
              <li>Competitor analysis</li>
              <li>Similar contracts and pricing</li>
              <li>Key decision makers</li>
              <li>Recent news and press releases</li>
            </ul>
          </div>
          <div className="flex justify-center pt-2">
            <Button variant="outline" size="sm" onClick={cancelResearch}>
              Cancel Research
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Display research results
  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {results.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Clock className="mr-2 h-4 w-4" />
                  {displayResult ? formatDate(displayResult.created_at) : 'Select research'}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {results
                  .filter((r) => r.status === 'completed')
                  .map((result) => (
                    <DropdownMenuItem
                      key={result.id}
                      onClick={() => setSelectedResultId(result.id)}
                    >
                      {formatDate(result.created_at)}
                      {result.id === latest?.id && (
                        <span className="ml-2 text-muted-foreground">(Latest)</span>
                      )}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {displayResult && (
            <span className="text-sm text-muted-foreground">
              {displayResult.tokens_used?.toLocaleString()} tokens used
            </span>
          )}
        </div>
        <Button onClick={() => setShowContextInput(true)} variant="outline" size="sm">
          <Sparkles className="mr-2 h-4 w-4" />
          Run New Research
        </Button>
      </div>

      {/* Context input modal */}
      {showContextInput && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="context">Additional Context (optional)</Label>
              <Textarea
                id="context"
                placeholder="Add any specific areas you want the research to focus on..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleRunResearch}>
                <Sparkles className="mr-2 h-4 w-4" />
                Start Research
              </Button>
              <Button variant="outline" onClick={() => setShowContextInput(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Research results */}
      {displayResult && <RfpResearchDisplay research={displayResult} />}
    </div>
  );
}
