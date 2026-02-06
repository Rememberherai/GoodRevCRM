import type { AutomationCondition, ConditionOperator } from '@/types/automation';

// Blocklist of prototype-polluting keys
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Get a nested field value from an object using dot notation
 * Supports custom_fields.field_name access
 */
function getFieldValue(data: Record<string, unknown>, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (BLOCKED_KEYS.has(part)) return undefined;
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Evaluate a single condition against entity data
 */
function evaluateCondition(
  condition: AutomationCondition,
  data: Record<string, unknown>
): boolean {
  const fieldValue = getFieldValue(data, condition.field);
  const compareValue = condition.value;

  return evaluateOperator(condition.operator, fieldValue, compareValue);
}

/**
 * Evaluate an operator against field and compare values
 */
function evaluateOperator(
  operator: ConditionOperator,
  fieldValue: unknown,
  compareValue: unknown
): boolean {
  switch (operator) {
    case 'equals':
      return String(fieldValue) === String(compareValue);

    case 'not_equals':
      return String(fieldValue) !== String(compareValue);

    case 'contains':
      if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
        return fieldValue.toLowerCase().includes(compareValue.toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(compareValue);
      }
      return false;

    case 'not_contains':
      if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
        return !fieldValue.toLowerCase().includes(compareValue.toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(compareValue);
      }
      return true;

    case 'greater_than': {
      const numField = Number(fieldValue);
      const numCompare = Number(compareValue);
      if (isNaN(numField) || isNaN(numCompare)) return false;
      return numField > numCompare;
    }

    case 'less_than': {
      const numField = Number(fieldValue);
      const numCompare = Number(compareValue);
      if (isNaN(numField) || isNaN(numCompare)) return false;
      return numField < numCompare;
    }

    case 'is_empty':
      return (
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    case 'is_not_empty':
      return !(
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    case 'in':
      if (Array.isArray(compareValue)) {
        return compareValue.some((v) => String(v) === String(fieldValue));
      }
      return false;

    case 'not_in':
      if (Array.isArray(compareValue)) {
        return !compareValue.some((v) => String(v) === String(fieldValue));
      }
      return true;

    default:
      return false;
  }
}

/**
 * Evaluate all conditions against entity data.
 * All conditions must match (AND logic).
 * Returns true if no conditions exist.
 */
export function evaluateConditions(
  conditions: AutomationCondition[],
  data: Record<string, unknown>
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((condition) => evaluateCondition(condition, data));
}
