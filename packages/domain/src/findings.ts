/**
 * Approved findings for the client (TASK-P, TASK-V): approved analyses aggregated into themes.
 * A theme is kept only when at least `minPeople` distinct submissions raised it; only its axis,
 * label and head count leave this function (no summary, no quote, no submission id).
 */

export interface Finding {
  readonly axis: string;
  readonly label: string;
  readonly people: number;
}

export const aggregateFindings = (
  analyses: readonly { submissionId: string; payload: unknown }[],
  minPeople: number,
): Finding[] => {
  const groups = new Map<string, { axis: string; label: string; people: Set<string> }>();
  for (const a of analyses) {
    const themes = (a.payload as { themes?: unknown } | null)?.themes;
    if (!Array.isArray(themes)) continue;
    for (const raw of themes) {
      const t = raw as { label?: unknown; axis?: unknown };
      if (typeof t.label !== 'string' || !t.label.trim()) continue;
      const axis = typeof t.axis === 'string' ? t.axis : 'context';
      const key = `${axis}|${t.label.trim().toLowerCase()}`;
      const g = groups.get(key) ?? { axis, label: t.label.trim(), people: new Set<string>() };
      g.people.add(a.submissionId);
      groups.set(key, g);
    }
  }
  return [...groups.values()]
    .filter((g) => g.people.size >= minPeople)
    .map((g) => ({ axis: g.axis, label: g.label, people: g.people.size }))
    .sort((x, y) => y.people - x.people || x.label.localeCompare(y.label));
};

/** Stable key of a finding: its axis and its label, case-insensitive. */
export const findingKey = (axis: string, label: string): string =>
  `${axis}|${label.trim().toLowerCase()}`.slice(0, 240);
