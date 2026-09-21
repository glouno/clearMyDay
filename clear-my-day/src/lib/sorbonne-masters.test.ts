import { describe, expect, it } from 'vitest';
import { getConfirmedM2Masters, getMasterDisplayName } from './sorbonne-masters';

describe('modern master display names', () => {
  it.each([
    ['DAC', 'MIND'],
    ['DAC_M2', 'MIND'],
    ['ANDROIDE_M2', 'AI2D'],
    ['SFPN_M2', 'CCA'],
    ['IQ_M2', 'QI'],
    ['IMA_M2', 'IMA']
  ])('maps backend ID %s to %s', (backendId, displayName) => {
    expect(getMasterDisplayName(backendId)).toBe(displayName);
  });
});

describe('M2 MIND course identifiers', () => {
  it('uses the same DEEP-L identifier as the Sorbonne feed', () => {
    expect(getConfirmedM2Masters().DAC_M2.courses).toContain('DEEP-L');
    expect(getConfirmedM2Masters().DAC_M2.courses).not.toContain('DEEP');
  });
});
