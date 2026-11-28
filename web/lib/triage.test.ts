import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyByRules, classifyIncident } from './triage';
import { severityFromMetrics } from './severity-matrix';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function geminiReply(text: string, status = 200) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status }));
}

const SCORES = { life_threat: 3, people_affected: 2, spread_risk: 2, area_scope: 0, resource_need: 2 };
const answer = (extra: object = {}) => JSON.stringify({ ...SCORES, agencies: ['coast_guard', 'coast_guard'], photo_findings: 'Photo shows a capsized boat.', credibility: 'consistent', credibility_note: 'Photo matches the text.', reason: 'People in the water.', ...extra });

describe('classifyIncident (Gemini)', () => {
  const report = { location_text: 'Port', barangay: 'Anilao', affected_people: 3, vulnerable_groups: [], incident_type: 'Sea', description: 'Lumubog ang bangka, may tatlong tao sa tubig' };

  it('computes severity from the AI scores and sends the photos', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const fetchMock = geminiReply(answer());
    vi.stubGlobal('fetch', fetchMock);
    const result = await classifyIncident(report, [{ mimeType: 'image/jpeg', data: 'AAAA' }]);
    expect(result).toEqual({ severity: 'critical', agencies: ['coast_guard'], reason: 'People in the water.', source: 'ai', held: false, metrics: { ...SCORES, photo_findings: 'Photo shows a capsized boat.', credibility: 'consistent', credibility_note: 'Photo matches the text.' } });
    const parts = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts;
    expect(parts[0]).toEqual({ inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } });
  });

  it('holds a report the AI finds implausible', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', geminiReply(answer({ credibility: 'implausible', credibility_note: 'Fire on plain water is impossible.' })));
    const result = await classifyIncident(report);
    expect(result.held).toBe(true);
    expect(result.metrics?.credibility).toBe('implausible');
  });

  it('tries the backup model when the first one is overloaded', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{"error":{"code":503}}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: answer() }] } }] })));
    vi.stubGlobal('fetch', fetchMock);
    expect((await classifyIncident(report)).source).toBe('ai');
    expect(fetchMock.mock.calls.map(([url]) => String(url).match(/models\/([^:]+)/)?.[1])).toEqual(['gemini-flash-lite-latest', 'gemini-flash-latest']);
  });

  it('falls back to rules on a bad answer or HTTP error', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', geminiReply(answer({ life_threat: 7 })));
    expect((await classifyIncident(report)).source).toBe('rules');
    vi.stubGlobal('fetch', geminiReply('{}', 429));
    expect((await classifyIncident(report)).source).toBe('rules');
  });
});

describe('severityFromMetrics', () => {
  const zero = { life_threat: 0, people_affected: 0, spread_risk: 0, area_scope: 0, resource_need: 0 };
  it('applies the fixed rule', () => {
    expect(severityFromMetrics({ ...zero, life_threat: 3 })).toBe('critical');
    expect(severityFromMetrics({ life_threat: 1, people_affected: 3, spread_risk: 2, area_scope: 3, resource_need: 2 })).toBe('critical');
    expect(severityFromMetrics({ ...zero, life_threat: 2 })).toBe('high');
    expect(severityFromMetrics({ ...zero, spread_risk: 3 })).toBe('high');
    expect(severityFromMetrics({ ...zero, people_affected: 1, area_scope: 1, resource_need: 1 })).toBe('medium');
    expect(severityFromMetrics({ ...zero, resource_need: 1 })).toBe('low');
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
