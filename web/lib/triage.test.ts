import { describe, expect, it } from 'vitest';
import { classifyByRules } from './triage';

const base = { location_text: 'Poblacion', barangay: 'Poblacion', affected_people: 0, vulnerable_groups: [] };

describe('classifyByRules (AI fallback)', () => {
  it('sends fires to BFP', () => {
    const result = classifyByRules({ ...base, incident_type: 'Fire', description: 'May sunog sa bahay ng kapitbahay' });
    expect(result.agencies).toEqual(['bfp']);
    expect(result.source).toBe('rules');
  });

  it('marks drowning as critical for the Coast Guard', () => {
    const result = classifyByRules({ ...base, incident_type: 'Sea', description: 'A child is drowning near the beach' });
    expect(result.severity).toBe('critical');
    expect(result.agencies).toEqual(['coast_guard']);
  });

  it('dispatches nobody when nothing matches', () => {
    const result = classifyByRules({ ...base, incident_type: 'Other', description: 'Broken streetlight on the corner' });
    expect(result).toMatchObject({ severity: 'low', agencies: [] });
  });
});
