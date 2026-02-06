import { ExternalLink, Mail, Phone } from 'lucide-react';
import type { ResolvedColumn } from '@/types/table-columns';
import { getColumnAccessor } from './definitions';

/**
 * Get the value from an item using the column accessor
 */
export function getCellValue<T extends Record<string, unknown>>(
  item: T,
  column: ResolvedColumn
): unknown {
  const accessor = getColumnAccessor(column.key);

  if (typeof accessor === 'function') {
    return accessor(item);
  }

  return item[accessor];
}

/**
 * Format a currency value
 */
function formatCurrency(value: number | string, currency = 'USD'): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numValue);
}

/**
 * Format a date value
 */
function formatDate(value: string | Date, includeTime = false): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '-';

  if (includeTime) {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a number value
 */
function formatNumber(value: number | string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';

  return new Intl.NumberFormat('en-US').format(numValue);
}

/**
 * Render a cell value based on the column's field type
 */
export function renderCellValue<T extends Record<string, unknown>>(
  item: T,
  column: ResolvedColumn
): React.ReactNode {
  const value = getCellValue(item, column);

  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">-</span>;
  }

  switch (column.fieldType) {
    case 'url':
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
          <span className="truncate max-w-[150px]">
            {String(value).replace(/^https?:\/\/(www\.)?/, '')}
          </span>
        </a>
      );

    case 'email':
      return (
        <a
          href={`mailto:${value}`}
          className="inline-flex items-center gap-1 text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <Mail className="h-3 w-3" />
          <span className="truncate max-w-[180px]">{String(value)}</span>
        </a>
      );

    case 'phone':
      return (
        <a
          href={`tel:${value}`}
          className="inline-flex items-center gap-1 text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <Phone className="h-3 w-3" />
          <span>{String(value)}</span>
        </a>
      );

    case 'currency':
      // Try to get currency from the item if available
      const currency = (item as Record<string, unknown>).currency as string | undefined;
      return formatCurrency(value as number | string, currency || 'USD');

    case 'date':
      return formatDate(value as string | Date, false);

    case 'datetime':
      return formatDate(value as string | Date, true);

    case 'percentage':
      const numValue = typeof value === 'string' ? parseFloat(value) : (value as number);
      return isNaN(numValue) ? '-' : `${numValue}%`;

    case 'number':
      return formatNumber(value as number | string);

    case 'boolean':
      return value ? 'Yes' : 'No';

    case 'rating':
      const rating = typeof value === 'string' ? parseInt(value) : (value as number);
      if (isNaN(rating)) return '-';
      return '★'.repeat(Math.min(rating, 5)) + '☆'.repeat(Math.max(0, 5 - rating));

    case 'select':
      // For select fields, the value might be a code; render as-is for now
      // Stage badges are handled specially in the page components
      return <span className="capitalize">{String(value).replace(/_/g, ' ')}</span>;

    case 'multi_select':
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);

    case 'textarea':
      // Truncate long text
      const textValue = String(value);
      if (textValue.length > 100) {
        return <span title={textValue}>{textValue.slice(0, 100)}...</span>;
      }
      return textValue;

    case 'text':
    default:
      return String(value);
  }
}
