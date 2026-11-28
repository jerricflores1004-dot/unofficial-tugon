import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyByRules, classifyIncident } from './triage';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function geminiReply(text: string, status = 200) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status }));
}

describe('classifyIncident (Gemini)', () => {
  const report = { location_text: 'Port', barangay: 'Anilao', affected_people: 3, vulnerable_groups: [], incident_type: 'Sea', description: 'Lumubog ang bangka, may tatlong tao sa tubig' };

  it('uses the Gemini answer', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', geminiReply(JSON.stringify({ severity: 'critical', agencies: ['coast_guard', 'coast_guard'], reason: 'People in the water.' })));
    await expect(classifyIncident(report)).resolves.toEqual({ severity: 'critical', agencies: ['coast_guard'], reason: 'People in the water.', source: 'ai' });
  });

  it('falls back to rules on a bad answer or HTTP error', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', geminiReply(JSON.stringify({ severity: 'extreme', agencies: [], reason: '' })));
    expect((await classifyIncident(report)).source).toBe('rules');
    vi.stubGlobal('fetch', geminiReply('{}', 429));
    expect((await classifyIncident(report)).source).toBe('rules');
  });
});

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
