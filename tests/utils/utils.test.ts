import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('Utility Functions', () => {
  describe('cn (className merger)', () => {
    it('should merge simple class names', () => {
      const result = cn('class1', 'class2');
      expect(result).toBe('class1 class2');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const isDisabled = false;
      const result = cn(
        'base-class',
        isActive && 'active',
        isDisabled && 'disabled'
      );
      expect(result).toBe('base-class active');
    });

    it('should handle undefined and null', () => {
      const result = cn('class1', undefined, null, 'class2');
      expect(result).toBe('class1 class2');
    });

    it('should handle arrays', () => {
      const result = cn(['class1', 'class2'], 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    it('should handle objects', () => {
      const result = cn({
        'active': true,
        'disabled': false,
        'visible': true,
      });
      expect(result).toBe('active visible');
    });

    it('should merge tailwind classes correctly', () => {
      const result = cn('px-2 py-1', 'px-4');
      expect(result).toBe('py-1 px-4');
    });

    it('should handle empty inputs', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('should handle complex combinations', () => {
      const isError = true;
      const result = cn(
        'text-sm font-medium',
        isError && 'text-red-500',
        { 'border-red-500': isError },
        ['rounded-md', 'shadow-sm']
      );
      expect(result).toContain('text-red-500');
      expect(result).toContain('border-red-500');
      expect(result).toContain('rounded-md');
    });
  });
});
