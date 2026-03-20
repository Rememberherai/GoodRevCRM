import { describe, expect, it } from 'vitest';
import { createCommunityAssetSchema } from '@/lib/validators/community/assets';

describe('Community Asset Validators', () => {
  it('accepts a valid asset payload', () => {
    const result = createCommunityAssetSchema.safeParse({
      name: 'Garden Plot A',
      category: 'land',
      dimension_id: '550e8400-e29b-41d4-a716-446655440000',
      condition: 'good',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid categories', () => {
    const result = createCommunityAssetSchema.safeParse({
      name: 'Unknown Asset',
      category: 'building',
      dimension_id: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.success).toBe(false);
  });
});
