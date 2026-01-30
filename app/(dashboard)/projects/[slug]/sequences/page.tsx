import { Mail, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SequencesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Sequences</h2>
          <p className="text-muted-foreground">
            Automate your outreach with multi-step email sequences
          </p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          New Sequence
        </Button>
      </div>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Mail className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Email sequences will allow you to create automated multi-step outreach campaigns.
            This feature is currently under development.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            Features planned: sequence builder, enrollment rules, A/B testing, and analytics.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
