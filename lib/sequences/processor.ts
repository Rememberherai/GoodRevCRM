import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, GmailServiceError } from '@/lib/gmail/service';
import { sendOutboundSms } from '@/lib/telnyx/sms-service';
import { fetchVariableContext, substituteEmailContent, substituteVariables, substituteConfigVariables } from './variables';
import type { GmailConnection } from '@/types/gmail';
import type { StepConfig } from '@/types/sequence';

interface SequenceStep {
  id: string;
  sequence_id: string;
  step_number: number;
  step_type: 'email' | 'delay' | 'condition' | 'sms' | 'call' | 'task' | 'linkedin';
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  delay_amount: number | null;
  delay_unit: 'minutes' | 'hours' | 'days' | 'weeks' | null;
  sms_body: string | null;
  config: StepConfig | null;
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
  organization_id: string | null;
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
 * Log sequence completion: creates activity + follow-up task
 */
async function logSequenceCompletion(
  supabase: ReturnType<typeof createAdminClient>,
  enrollment: SequenceEnrollment,
  sequence: Sequence
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;

  try {
    // Look up the person to get their organization
    const { data: person } = await supabaseAny
      .from('people')
      .select('id, first_name, last_name, organization_id')
      .eq('id', enrollment.person_id)
      .single();

    const orgId = person?.organization_id ?? sequence.organization_id ?? null;
    const followUpDays = (sequence.settings as { follow_up_delay_days?: number })?.follow_up_delay_days ?? 3;

    // Calculate follow-up date
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + followUpDays);

    // Create follow-up task
    const { data: task } = await supabaseAny
      .from('tasks')
      .insert({
        project_id: sequence.project_id,
        title: `Follow up: ${sequence.name} completed for ${person?.first_name ?? 'Contact'} ${person?.last_name ?? ''}`.trim(),
        description: `Sequence "${sequence.name}" has completed all steps. Follow up with this contact.`,
        status: 'pending',
        priority: 'medium',
        due_date: followUpDate.toISOString(),
        person_id: enrollment.person_id,
        organization_id: orgId,
        created_by: enrollment.created_by,
        assigned_to: enrollment.created_by,
      })
      .select('id')
      .single();

    // Log the activity
    const { data: activity } = await supabaseAny
      .from('activity_log')
      .insert({
        project_id: sequence.project_id,
        user_id: enrollment.created_by,
        entity_type: 'sequence',
        entity_id: sequence.id,
        action: 'completed',
        activity_type: 'sequence_completed',
        person_id: enrollment.person_id,
        organization_id: orgId,
        subject: `Sequence "${sequence.name}" completed`,
        notes: `All steps in the sequence have been processed.`,
        follow_up_date: followUpDate.toISOString(),
        follow_up_task_id: task?.id ?? null,
        metadata: {
          sequence_id: sequence.id,
          sequence_name: sequence.name,
          enrollment_id: enrollment.id,
          follow_up_delay_days: followUpDays,
        },
      })
      .select('id')
      .single();

    // Link task back to activity
    if (task?.id && activity?.id) {
      await supabaseAny
        .from('tasks')
        .update({ source_activity_id: activity.id })
        .eq('id', task.id);
    }
  } catch (error) {
    // Don't fail the enrollment completion if logging fails
    console.error('Error logging sequence completion:', error);
  }
}

/**
 * Process a single enrollment
 */
async function processEnrollment(
  supabase: ReturnType<typeof createAdminClient>,
  enrollment: SequenceEnrollment,
  sequence: Sequence,
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

    await logSequenceCompletion(supabase, enrollment, sequence);
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

      await logSequenceCompletion(supabase, enrollment, sequence);
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
    // Fetch variable context, using sequence's target org if set
    const context = await fetchVariableContext(
      enrollment.person_id,
      enrollment.created_by,
      sequence.organization_id
    );

    if (!context.person?.email) {
      // No email for this person, skip
      return { status: 'skipped', message: 'Person has no email address' };
    }

    // Validate email format - reject control characters that could cause header injection
    const email = context.person.email;
    if (/[\r\n\x00-\x1f]/.test(email) || !email.includes('@')) {
      return { status: 'skipped', message: 'Person has invalid email address format' };
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
        enrollment.created_by,
        sequence.project_id
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

      // Log activity for this sequence email send
      try {
        const orgId = context.organization?.id ?? sequence.organization_id ?? null;
        await supabaseAny.from('activity_log').insert({
          project_id: sequence.project_id,
          user_id: enrollment.created_by,
          entity_type: 'person',
          entity_id: enrollment.person_id,
          action: 'sent',
          activity_type: 'email',
          outcome: 'email_sent',
          direction: 'outbound',
          subject,
          notes: bodyText ?? bodyHtml.replace(/<[^>]*>/g, '').slice(0, 1000),
          person_id: enrollment.person_id,
          organization_id: orgId,
          metadata: {
            sent_email_id: result.sent_email_id,
            message_id: result.message_id,
            sequence_id: sequence.id,
            sequence_name: sequence.name,
            step_number: currentStep.step_number,
            to: context.person.email,
          },
        });
      } catch (activityErr) {
        console.error('Failed to log sequence email activity:', activityErr);
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

        await logSequenceCompletion(supabase, enrollment, sequence);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;

      if (error instanceof GmailServiceError) {
        // Distinguish between transient and permanent errors
        const isTransient = error.statusCode === 429 ||
          error.statusCode === 500 ||
          error.statusCode === 503 ||
          error.code === 'TOKEN_REFRESH_FAILED';

        if (isTransient) {
          // For transient errors, keep enrollment active but delay retry
          const retryAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min delay
          await supabaseAny
            .from('sequence_enrollments')
            .update({
              next_send_at: retryAt.toISOString(),
            })
            .eq('id', enrollment.id);
          return { status: 'error', message: `Transient error, will retry: ${error.message}` };
        } else {
          // Permanent error - mark as bounced
          await supabaseAny
            .from('sequence_enrollments')
            .update({
              status: 'bounced',
              bounce_detected_at: new Date().toISOString(),
            })
            .eq('id', enrollment.id);
          return { status: 'error', message: error.message };
        }
      }

      // Non-Gmail error - mark as error to prevent infinite retry loop
      await supabaseAny
        .from('sequence_enrollments')
        .update({
          status: 'error',
        })
        .eq('id', enrollment.id);
      return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  if (currentStep.step_type === 'sms') {
    // Fetch variable context, using sequence's target org if set
    const context = await fetchVariableContext(
      enrollment.person_id,
      enrollment.created_by,
      sequence.organization_id
    );

    // Get person's phone number (prefer mobile)
    const phoneNumber = context.person?.mobile_phone || context.person?.phone;
    if (!phoneNumber) {
      return { status: 'skipped', message: 'Person has no phone number' };
    }

    // Get SMS body and substitute variables
    const smsBody = (currentStep as { sms_body?: string | null }).sms_body;
    if (!smsBody) {
      return { status: 'skipped', message: 'SMS step has no message body' };
    }

    const substitutedBody = substituteVariables(smsBody, context);

    try {
      // Send the SMS
      await sendOutboundSms({
        projectId: sequence.project_id,
        userId: enrollment.created_by,
        toNumber: phoneNumber,
        body: substitutedBody,
        personId: enrollment.person_id,
        organizationId: sequence.organization_id,
        sequenceEnrollmentId: enrollment.id,
        sequenceStepId: currentStep.id,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;

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

        await logSequenceCompletion(supabase, enrollment, sequence);
        return { status: 'completed', message: 'SMS sent, sequence completed' };
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
        // Next step is not a delay, process it on next cron run
        await supabaseAny
          .from('sequence_enrollments')
          .update({
            current_step: nextStep.step_number,
            next_send_at: nextSendAt.toISOString(),
          })
          .eq('id', enrollment.id);
      }

      return { status: 'sent', message: `SMS sent to ${phoneNumber}` };
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;

      // Mark as error to prevent infinite retry
      await supabaseAny
        .from('sequence_enrollments')
        .update({
          status: 'error',
        })
        .eq('id', enrollment.id);
      return { status: 'error', message: error instanceof Error ? error.message : 'SMS send failed' };
    }
  }

  // Handle manual action steps (call, task, linkedin)
  // These create a task for the user to complete, then advance to next step
  if (currentStep.step_type === 'call' || currentStep.step_type === 'task' || currentStep.step_type === 'linkedin') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Fetch variable context for template substitution
    const context = await fetchVariableContext(
      enrollment.person_id,
      enrollment.created_by,
      sequence.organization_id
    );

    const config = (currentStep.config || {}) as Record<string, unknown>;

    // Apply variable substitution to config strings
    const resolvedConfig = substituteConfigVariables(config, context);

    // Determine task title and description based on step type
    let taskTitle: string;
    let taskDescription: string;
    let taskPriority: string;

    const personName = [context.person?.first_name, context.person?.last_name]
      .filter(Boolean).join(' ') || 'Contact';

    if (currentStep.step_type === 'call') {
      taskTitle = String(resolvedConfig.title || `Call ${personName}`);
      const phone = context.person?.mobile_phone || context.person?.phone || 'No phone on file';
      taskDescription = String(resolvedConfig.description || `Phone: ${phone}`);
      taskPriority = String(resolvedConfig.priority || 'high');
    } else if (currentStep.step_type === 'linkedin') {
      const action = String(config.action || 'view_profile');
      const actionLabel: Record<string, string> = {
        view_profile: 'View Profile',
        send_connection: 'Send Connection Request',
        send_message: 'Send Message',
      };
      taskTitle = String(resolvedConfig.title || `LinkedIn: ${actionLabel[action] || action} - ${personName}`);
      const linkedinUrl = context.person?.linkedin_url || 'No LinkedIn URL on file';
      taskDescription = String(resolvedConfig.description || `LinkedIn: ${linkedinUrl}`);
      if (action === 'send_message' && resolvedConfig.message_template) {
        taskDescription += `\n\nSuggested message:\n${resolvedConfig.message_template}`;
      }
      taskPriority = String(resolvedConfig.priority || 'medium');
    } else {
      // Generic task
      taskTitle = String(resolvedConfig.title || `Task for ${personName}`);
      taskDescription = String(resolvedConfig.description || '');
      taskPriority = String(resolvedConfig.priority || 'medium');
    }

    // Calculate due date from due_in_hours
    const dueInHours = Number(resolvedConfig.due_in_hours) || 24;
    const dueDate = new Date(Date.now() + dueInHours * 60 * 60 * 1000);

    // Look up person to get organization_id
    const { data: person } = await supabaseAny
      .from('people')
      .select('id, organization_id')
      .eq('id', enrollment.person_id)
      .single();

    const orgId = person?.organization_id ?? sequence.organization_id ?? null;

    // Create the task
    const { error: taskError } = await supabaseAny
      .from('tasks')
      .insert({
        project_id: sequence.project_id,
        title: taskTitle,
        description: taskDescription,
        status: 'pending',
        priority: taskPriority,
        due_date: dueDate.toISOString(),
        person_id: enrollment.person_id,
        organization_id: orgId,
        assigned_to: enrollment.created_by,
        created_by: enrollment.created_by,
      })
      .select('id')
      .single();

    if (taskError) {
      console.error(`Error creating task for ${currentStep.step_type} step:`, taskError);
      return { status: 'error', message: `Failed to create task: ${taskError.message}` };
    }

    // Log activity
    try {
      await supabaseAny
        .from('activity_log')
        .insert({
          project_id: sequence.project_id,
          user_id: enrollment.created_by,
          entity_type: 'sequence',
          entity_id: sequence.id,
          action: currentStep.step_type,
          activity_type: `sequence_${currentStep.step_type}`,
          person_id: enrollment.person_id,
          organization_id: orgId,
          subject: taskTitle,
          notes: `Sequence "${sequence.name}" created a ${currentStep.step_type} task.`,
          metadata: {
            sequence_id: sequence.id,
            sequence_name: sequence.name,
            enrollment_id: enrollment.id,
            step_id: currentStep.id,
            step_type: currentStep.step_type,
          },
        });
    } catch (activityErr) {
      console.error('Failed to log manual action step activity:', activityErr);
    }

    // Advance to next step (same logic as after sending an email)
    const nextStep = steps.find(s => s.step_number === currentStep.step_number + 1);

    if (!nextStep) {
      await supabaseAny
        .from('sequence_enrollments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          next_send_at: null,
          current_step: currentStep.step_number + 1,
        })
        .eq('id', enrollment.id);

      await logSequenceCompletion(supabase, enrollment, sequence);
      return { status: 'completed', message: `${currentStep.step_type} task created, sequence completed` };
    }

    // If next step is a delay, calculate the wait and skip past it
    let nextSendAt = new Date();
    if (nextStep.step_type === 'delay' && nextStep.delay_amount && nextStep.delay_unit) {
      nextSendAt = calculateNextSendAt(nextStep.delay_amount, nextStep.delay_unit);
      const stepAfterDelay = steps.find(s => s.step_number === nextStep.step_number + 1);
      await supabaseAny
        .from('sequence_enrollments')
        .update({
          current_step: stepAfterDelay ? stepAfterDelay.step_number : nextStep.step_number + 1,
          next_send_at: nextSendAt.toISOString(),
        })
        .eq('id', enrollment.id);
    } else {
      await supabaseAny
        .from('sequence_enrollments')
        .update({
          current_step: nextStep.step_number,
          next_send_at: nextSendAt.toISOString(),
        })
        .eq('id', enrollment.id);
    }

    return { status: 'sent', message: `${currentStep.step_type} task created` };
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
      sequence:sequences(id, project_id, organization_id, name, status, settings),
      gmail_connection:gmail_connections(id, email, access_token, refresh_token, token_expires_at, status)
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
  const { data: enrollments } = await supabaseAny
    .from('sequence_enrollments')
    .select(`
      id,
      sequence:sequences!inner(settings),
      sent_emails:sent_emails(thread_id, message_id)
    `)
    .eq('status', 'active')
    .not('sent_emails', 'is', null);

  // Check each thread for new inbound messages via the emails table
  // (populated by Gmail push sync) and mark enrollments as 'replied'
  if (!enrollments || enrollments.length === 0) {
    return 0;
  }

  let repliesDetected = 0;

  for (const enrollment of enrollments) {
    const threadId = enrollment.sent_emails?.thread_id;
    if (!threadId) continue;

    // Check for inbound replies in this thread
    const { data: replies } = await supabaseAny
      .from('emails')
      .select('id')
      .eq('gmail_thread_id', threadId)
      .eq('direction', 'inbound')
      .limit(1);

    if (replies && replies.length > 0) {
      // Mark enrollment as replied
      await supabaseAny
        .from('sequence_enrollments')
        .update({ status: 'replied' })
        .eq('id', enrollment.id);

      repliesDetected++;
    }
  }

  return repliesDetected;
}
