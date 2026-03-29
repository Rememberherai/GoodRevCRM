import type { WorkflowValidationError } from '@/types/workflow';

export function assertWorkflowTriggerSupported(_triggerType: string) {
  // All trigger types are supported. This function is kept as a hook
  // for future unsupported trigger types.
}

export function normalizeWorkflowTriggerConfig(
  triggerType: string,
  triggerConfig?: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = { ...(triggerConfig ?? {}) };

  if (triggerType !== 'schedule') {
    return normalized;
  }

  const cronExpression =
    typeof normalized.cron_expression === 'string' ? normalized.cron_expression.trim() : '';
  const legacyCron = typeof normalized.cron === 'string' ? normalized.cron.trim() : '';

  if (cronExpression) {
    normalized.cron_expression = cronExpression;
  } else if (legacyCron) {
    normalized.cron_expression = legacyCron;
  }

  delete normalized.cron;

  if (typeof normalized.interval_minutes === 'string') {
    const trimmed = normalized.interval_minutes.trim();
    if (!trimmed) {
      delete normalized.interval_minutes;
    } else {
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed)) {
        normalized.interval_minutes = parsed;
      }
    }
  }

  return normalized;
}

export function validateWorkflowTriggerConfig(
  triggerType: string,
  triggerConfig?: Record<string, unknown>,
): WorkflowValidationError[] {
  const config = normalizeWorkflowTriggerConfig(triggerType, triggerConfig);
  const errors: WorkflowValidationError[] = [];

  if (triggerType === 'schedule') {
    const cronExpression = typeof config.cron_expression === 'string' ? config.cron_expression.trim() : '';
    const intervalMinutes =
      typeof config.interval_minutes === 'number'
        ? config.interval_minutes
        : typeof config.interval_minutes === 'string'
          ? Number(config.interval_minutes)
          : undefined;

    if (!cronExpression && (!intervalMinutes || intervalMinutes < 1)) {
      errors.push({
        code: 'SCHEDULE_TRIGGER_MISSING_CONFIG',
        message: 'Schedule trigger requires a cron expression or an interval in minutes.',
        severity: 'error',
      });
    }
  }

  if (triggerType === 'webhook_inbound' && !config.webhook_secret_enc) {
    errors.push({
      code: 'WEBHOOK_TRIGGER_MISSING_SECRET',
      message: 'Inbound webhook trigger requires a generated secret token before activation.',
      severity: 'error',
    });
  }

  return errors;
}
