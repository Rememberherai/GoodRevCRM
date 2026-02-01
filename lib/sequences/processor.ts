import { createClient } from '@supabase/supabase-js';
import { sendEmail, GmailServiceError } from '@/lib/gmail/service';
import { fetchVariableContext, substituteEmailContent } from './variables';
import type { GmailConnection } from '@/types/gmail';

interface SequenceStep {
  id: string;
  sequence_id: string;
  step_number: number;
  step_type: 'email' | 'delay' | 'condition';
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  delay_amount: number | null;
  delay_unit: 'minutes' | 'hours' | 'days' | 'weeks' | null;
}

interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  person_id: string;
  gmail_connection_id: string;
  current_step: number;
  status: string;
  next_send_at: string | null;
  created_by: string;
}

interface Sequence {
  id: string;
  project_id: string;
  name: string;
  status: string;
  settings: {
    send_as_reply: boolean;
    stop_on_reply: boolean;
    stop_on_bounce: boolean;
    track_opens: boolean;
    track_clicks: boolean;
  };
}

interface ProcessingResult {
  processed: number;
  sent: number;
  errors: number;
  completed: number;
  details: Array<{
    enrollmentId: string;
    status: 'sent' | 'delayed' | 'completed' | 'error' | 'skipped';
    message?: string;
  }>;
}

/**
 * Create admin client for sequence processing
 */
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Calculate the next send time based on delay settings
 */
function calculateNextSendAt(
  delayAmount: number,
  delayUnit: 'minutes' | 'hours' | 'days' | 'weeks'
): Date {
  const now = new Date();
  const multipliers = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
  };

  return new Date(now.getTime() + delayAmount * multipliers[delayUnit]);
}

/**
 * Process a single enrollment
 */
async function processEnrollment(
  supabase: ReturnType<typeof createAdminClient>,
  enrollment: SequenceEnrollment,
  _sequence: Sequence,
  steps: SequenceStep[],
  gmailConnection: GmailConnection
): Promise<{ status: 'sent' | 'delayed' | 'completed' | 'error' | 'skipped'; message?: string }> {
  const currentStep = steps.find(s => s.step_number === enrollment.current_step);

  if (!currentStep) {
    // No more steps, mark as completed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    await supabaseAny
      .from('sequence_enrollments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        next_send_at: null,
      })
      .eq('id', enrollment.id);

    return { status: 'completed', message: 'All steps completed' };
  }

  // Handle different step types
  if (currentStep.step_type === 'delay') {
    // This is a delay step - calculate next send time and advance to next step
    const nextStep = steps.find(s => s.step_number === currentStep.step_number + 1);

    if (!nextStep) {
      // No more steps after delay, mark as completed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;
      await supabaseAny
        .from('sequence_enrollments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          next_send_at: null,
        })
        .eq('id', enrollment.id);

      return { status: 'completed', message: 'Sequence completed after delay' };
    }

    const nextSendAt = calculateNextSendAt(
      currentStep.delay_amount ?? 1,
      currentStep.delay_unit ?? 'days'
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    await supabaseAny
      .from('sequence_enrollments')
      .update({
        current_step: nextStep.step_number,
        next_send_at: nextSendAt.toISOString(),
      })
      .eq('id', enrollment.id);

    return {
      status: 'delayed',
      message: `Delayed ${currentStep.delay_amount} ${currentStep.delay_unit}, next send at ${nextSendAt.toISOString()}`,
    };
  }

  if (currentStep.step_type === 'email') {
    // Fetch variable context
    const context = await fetchVariableContext(
      enrollment.person_id,
      enrollment.created_by
    );

    if (!context.person?.email) {
      // No email for this person, skip
      return { status: 'skipped', message: 'Person has no email address' };
    }

    // Substitute variables
    const { subject, bodyHtml, bodyText } = substituteEmailContent(
      currentStep.subject ?? 'No Subject',
      currentStep.body_html ?? '',
      currentStep.body_text,
      context
    );

    try {
      // Send the email
      const result = await sendEmail(
        gmailConnection,
        {
          to: context.person.email,
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          person_id: enrollment.person_id,
        },
        enrollment.created_by
      );

      // Update the sent email with sequence step reference
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;
      if (result.sent_email_id) {
        await supabaseAny
          .from('sent_emails')
          .update({ sequence_step_id: currentStep.id })
          .eq('id', result.sent_email_id);
      }

      // Move to next step
      const nextStep = steps.find(s => s.step_number === currentStep.step_number + 1);

      if (!nextStep) {
        // No more steps, mark as completed
        await supabaseAny
          .from('sequence_enrollments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            next_send_at: null,
            current_step: currentStep.step_number + 1,
          })
          .eq('id', enrollment.id);

        return { status: 'completed', message: 'Email sent, sequence completed' };
      }

      // Calculate next send time based on next step
      let nextSendAt = new Date();
      if (nextStep.step_type === 'delay' && nextStep.delay_amount && nextStep.delay_unit) {
        nextSendAt = calculateNextSendAt(nextStep.delay_amount, nextStep.delay_unit);
        // Skip the delay step itself
        const stepAfterDelay = steps.find(s => s.step_number === nextStep.step_number + 1);
        await supabaseAny
          .from('sequence_enrollments')
          .update({
            current_step: stepAfterDelay ? stepAfterDelay.step_number : nextStep.step_number + 1,
            next_send_at: nextSendAt.toISOString(),
          })
          .eq('id', enrollment.id);
      } else {
        // Next step is an email, process it immediately (next cron run)
        await supabaseAny
          .from('sequence_enrollments')
          .update({
            current_step: nextStep.step_number,
            next_send_at: nextSendAt.toISOString(),
          })
          .eq('id', enrollment.id);
      }

      return { status: 'sent', message: `Email sent to ${context.person.email}` };
    } catch (error) {
      if (error instanceof GmailServiceError) {
        // Mark as error status based on error type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabaseAny = supabase as any;
        await supabaseAny
          .from('sequence_enrollments')
          .update({
            status: 'bounced',
            bounce_detected_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id);

        return { status: 'error', message: error.message };
      }
      throw error;
    }
  }

  return { status: 'skipped', message: 'Unknown step type' };
}

/**
 * Process all pending sequence enrollments
 */
export async function processSequences(limit = 100): Promise<ProcessingResult> {
  const supabase = createAdminClient();
  const result: ProcessingResult = {
    processed: 0,
    sent: 0,
    errors: 0,
    completed: 0,
    details: [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;

  // Get enrollments that are due to be processed
  const { data: enrollments, error: enrollmentError } = await supabaseAny
    .from('sequence_enrollments')
    .select(`
      *,
      sequence:sequences(id, project_id, name, status, settings),
      gmail_connection:gmail_connections(*)
    `)
    .eq('status', 'active')
    .lte('next_send_at', new Date().toISOString())
    .limit(limit);

  if (enrollmentError) {
    console.error('Error fetching enrollments:', enrollmentError);
    throw new Error('Failed to fetch enrollments');
  }

  if (!enrollments || enrollments.length === 0) {
    return result;
  }

  // Group enrollments by sequence to efficiently fetch steps
  const sequenceIds = [...new Set(enrollments.map((e: { sequence_id: string }) => e.sequence_id))];

  // Fetch all steps for these sequences
  const { data: allSteps } = await supabaseAny
    .from('sequence_steps')
    .select('*')
    .in('sequence_id', sequenceIds)
    .order('step_number', { ascending: true });

  const stepsBySequence = (allSteps ?? []).reduce((acc: Record<string, SequenceStep[]>, step: SequenceStep) => {
    if (!acc[step.sequence_id]) {
      acc[step.sequence_id] = [];
    }
    acc[step.sequence_id]!.push(step);
    return acc;
  }, {} as Record<string, SequenceStep[]>);

  // Process each enrollment
  for (const enrollment of enrollments) {
    const sequence = enrollment.sequence as Sequence;
    const gmailConnection = enrollment.gmail_connection as GmailConnection;

    // Skip if sequence is not active
    if (sequence.status !== 'active') {
      result.details.push({
        enrollmentId: enrollment.id,
        status: 'skipped',
        message: 'Sequence is not active',
      });
      continue;
    }

    // Skip if Gmail connection is not valid
    if (!gmailConnection || gmailConnection.status !== 'connected') {
      result.details.push({
        enrollmentId: enrollment.id,
        status: 'error',
        message: 'Gmail connection is not valid',
      });
      result.errors++;
      continue;
    }

    const steps = stepsBySequence[enrollment.sequence_id] ?? [];

    try {
      const processResult = await processEnrollment(
        supabase,
        enrollment as SequenceEnrollment,
        sequence,
        steps,
        gmailConnection
      );

      result.processed++;
      result.details.push({
        enrollmentId: enrollment.id,
        ...processResult,
      });

      if (processResult.status === 'sent') {
        result.sent++;
      } else if (processResult.status === 'completed') {
        result.completed++;
      } else if (processResult.status === 'error') {
        result.errors++;
      }
    } catch (error) {
      console.error(`Error processing enrollment ${enrollment.id}:`, error);
      result.errors++;
      result.details.push({
        enrollmentId: enrollment.id,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Check for replies to sent sequence emails and stop sequences accordingly
 */
export async function checkForSequenceReplies(): Promise<number> {
  // This would integrate with Gmail API to check for replies
  // For now, we'll implement a basic version
  // A more complete implementation would use Gmail push notifications

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;

  // Get active enrollments that have sent at least one email
  const { data: _enrollments } = await supabaseAny
    .from('sequence_enrollments')
    .select(`
      id,
      sequence:sequences!inner(settings),
      sent_emails:sent_emails(thread_id, message_id)
    `)
    .eq('status', 'active')
    .not('sent_emails', 'is', null);

  // Implementation would check each thread for new messages
  // and mark enrollments as 'replied' if stop_on_reply is enabled
  // TODO: Implement actual reply checking with Gmail API

  return 0; // Return count of replies detected
}
