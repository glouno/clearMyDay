import { describe, expect, it } from 'vitest';
import { CACHE_TTL_HOURS } from './supabase';

describe('analysis cache policy', () => {
  it('refreshes discovery data at least daily', () => {
    expect(CACHE_TTL_HOURS).toBeLessThanOrEqual(24);
  });
});
