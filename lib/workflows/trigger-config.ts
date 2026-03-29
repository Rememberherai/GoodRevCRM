const UNSUPPORTED_INBOUND_WEBHOOK_ERROR =
  'Inbound webhook workflow triggers are not supported yet because no public receiver route is wired.';

export function assertWorkflowTriggerSupported(triggerType: string) {
  if (triggerType === 'webhook_inbound') {
    throw new Error(UNSUPPORTED_INBOUND_WEBHOOK_ERROR);
  }
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
