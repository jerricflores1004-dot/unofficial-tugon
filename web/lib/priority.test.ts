import { describe, expect, it } from 'vitest';
import { calculatePriority } from './priority';

describe('TUGON priority engine', () => {
  it('keeps critical severity critical', () => expect(calculatePriority('critical')).toBe('critical'));
  it('escalates high severity when a vulnerable group is present', () => expect(calculatePriority('high', ['older_adults'])).toBe('critical'));
  it('keeps high severity high without a vulnerable group', () => expect(calculatePriority('high')).toBe('high'));
  it('maps medium and low directly', () => { expect(calculatePriority('medium')).toBe('medium'); expect(calculatePriority('low')).toBe('low'); });
});
