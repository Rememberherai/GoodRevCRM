'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { NewsTokenUsage as TokenUsageType } from '@/types/news';

interface NewsTokenUsageProps {
  usage: TokenUsageType;
}

export function NewsTokenUsage({ usage }: NewsTokenUsageProps) {
  const percentage = (usage.total_tokens_used / usage.token_limit) * 100;
  const isLow = percentage > 80;
  const isExhausted = percentage >= 95;

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] font-normal',
        isExhausted
          ? 'border-destructive/50 text-destructive'
          : isLow
            ? 'border-yellow-500/50 text-yellow-700 dark:text-yellow-400'
            : 'text-muted-foreground'
      )}
    >
      {usage.total_tokens_used} / {usage.token_limit} tokens
    </Badge>
  );
}
