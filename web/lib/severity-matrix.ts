/**
 * TUGON severity matrix: the five metrics the AI scores (0–3 each) and the
 * fixed rule that turns the scores into a severity level. The AI only scores
 * the metrics; the severity itself is computed here, so it is explainable.
 * The same definitions feed the AI prompt, the admin view and docs/severity-matrix.md.
 */
export const METRICS = [
  {
    key: 'life_threat',
    label: 'Life threat',
    basis: 'START triage (red/yellow/green) and Emergency Severity Index level 1–2',
    levels: [
      'None: nobody hurt or in danger',
      'Minor: small injuries, people can walk (START green)',
      'Serious: injuries that need care soon but can wait minutes to hours (START yellow)',
      'Immediate: trapped, unconscious, not breathing, drowning, heavy bleeding or active violence (START red, ESI level 1)',
    ],
  },
  {
    key: 'people_affected',
    label: 'People affected',
    basis: 'Number of casualties, with priority for vulnerable sectors (RA 10121)',
    levels: [
      'Nobody',
      '1–2 people',
      '3–9 people, or any child, elderly person, PWD or pregnant woman',
      '10 or more people',
    ],
  },
  {
    key: 'spread_risk',
    label: 'Spread risk',
    basis: 'Hazard trend, as used for BFP alarm escalation',
    levels: [
      'Over or contained',
      'Stable, not getting worse',
      'Could spread or get worse within hours',
      'Spreading or getting worse right now',
    ],
  },
  {
    key: 'area_scope',
    label: 'Area scope',
    basis: 'NDRRMC Memorandum Circular No. 44, s. 2016 (incident management team levels)',
    levels: [
      'One spot or household',
      'Several households or one street',
      'Whole barangay (barangay-level response)',
      'Two or more barangays (municipal-level response)',
    ],
  },
  {
    key: 'resource_need',
    label: 'Resources needed',
    basis: 'ESI resource count and Incident Command System complexity typing',
    levels: [
      'Information only, no unit needed',
      'One unit (MDRRMO or one agency)',
      'Several units, or one agency plus MDRRMO',
      'Several agencies at the same time',
    ],
  },
] as const;

export type MetricKey = (typeof METRICS)[number]['key'];
export type Metrics = Record<MetricKey, number>;
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export const SEVERITY_RULE = [
  { severity: 'critical', when: 'Life threat is 3 (Immediate), or the total is 11 or more out of 15' },
  { severity: 'high', when: 'Life threat is 2, or spread risk is 3, or the total is 7 or more' },
  { severity: 'medium', when: 'The total is 3 or more' },
  { severity: 'low', when: 'Anything else' },
] as const;

export function severityFromMetrics(metrics: Metrics): Severity {
  const total = METRICS.reduce((sum, metric) => sum + metrics[metric.key], 0);
  if (metrics.life_threat === 3 || total >= 11) return 'critical';
  if (metrics.life_threat === 2 || metrics.spread_risk === 3 || total >= 7) return 'high';
  if (total >= 3) return 'medium';
  return 'low';
}

/** The matrix as text for the AI prompt. */
export function metricsPrompt() {
  return METRICS.map((metric) => [
    `${metric.key} (${metric.label}; based on ${metric.basis}):`,
    ...metric.levels.map((text, score) => `  ${score} = ${text}`),
  ].join('\n')).join('\n');
}
