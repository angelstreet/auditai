import type {
  ReadinessAxis,
  ReadinessGroup,
  ReadinessLevel,
  ReadinessReport,
} from '@evolai/contracts';

/**
 * Readiness score (TASK-V, ADR 0041, PRD §6 and §6.3).
 *
 * Deterministic and explainable: each completed survey is first scored per axis with the existing
 * rubric (`scoreSubmission`, 0..1). A group's axis score is the plain mean of its members' axis
 * scores, times 100, rounded. The overall score is the weighted mean of the axis scores that have
 * data, with the weights shown in the report; an axis nobody answered is left out and the other
 * weights are scaled up (stated in plain words next to the score).
 *
 * Privacy (PRD §15, §25.1): a group with fewer than `minGroupSize` completed answers is not
 * scored at all; only a count of such teams leaves this function. Individual scores never do.
 */

export const READINESS_AXES: readonly ReadinessAxis[] = ['literacy', 'practice', 'readiness'];

/** Equal weights: no axis is known to matter more (PRD §6.3 asks the weighting to be visible). */
export const READINESS_WEIGHTS: Readonly<Record<ReadinessAxis, number>> = {
  literacy: 1 / 3,
  practice: 1 / 3,
  readiness: 1 / 3,
};

/** Lower bound (inclusive) of each level on the 0..100 scale. */
export const READINESS_THRESHOLDS: readonly { level: ReadinessLevel; from: number }[] = [
  { level: 'L0', from: 0 },
  { level: 'L1', from: 15 },
  { level: 'L2', from: 35 },
  { level: 'L3', from: 55 },
  { level: 'L4', from: 70 },
  { level: 'L5', from: 85 },
];

export const levelFor = (score: number): ReadinessLevel => {
  let level: ReadinessLevel = 'L0';
  for (const t of READINESS_THRESHOLDS) if (score >= t.from) level = t.level;
  return level;
};

/** One completed survey: its team and its axis scores in 0..1 (missing axis = not answered). */
export interface ScoredSubmission {
  readonly teamId: string;
  readonly axes: Partial<Record<string, number>>;
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

const groupScore = (members: readonly ScoredSubmission[]): Omit<ReadinessGroup, 'people'> => {
  const axes = READINESS_AXES.map((axis) => {
    const values = members
      .map((m) => m.axes[axis])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      .map(clamp01);
    if (values.length === 0) return { axis, score: null, level: null };
    const score = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100);
    return { axis, score, level: levelFor(score) };
  });
  const present = axes.filter((a) => a.score !== null);
  const weight = present.reduce((s, a) => s + READINESS_WEIGHTS[a.axis], 0);
  const overall =
    present.length === 0 || weight === 0
      ? null
      : Math.round(
          present.reduce((s, a) => s + (a.score as number) * READINESS_WEIGHTS[a.axis], 0) / weight,
        );
  return { overall, level: overall === null ? null : levelFor(overall), axes };
};

/**
 * Engagement-wide and per-team readiness. `teamNames` maps team ids to display names; teams
 * under the minimum group are only counted in `hiddenTeams`.
 */
export const computeReadiness = (
  submissions: readonly ScoredSubmission[],
  teamNames: ReadonlyMap<string, string>,
  minGroupSize: number,
): ReadinessReport => {
  const byTeam = new Map<string, ScoredSubmission[]>();
  for (const s of submissions) {
    const list = byTeam.get(s.teamId) ?? [];
    list.push(s);
    byTeam.set(s.teamId, list);
  }
  const teams: ReadinessReport['teams'][number][] = [];
  let hiddenTeams = 0;
  for (const [teamId, members] of byTeam) {
    if (members.length < minGroupSize) {
      hiddenTeams += 1;
      continue;
    }
    teams.push({
      team: teamNames.get(teamId) ?? '—',
      people: members.length,
      ...groupScore(members),
    });
  }
  // Complementary suppression: the overall score minus the visible teams must not describe a
  // hidden group under the minimum. Hide the smallest visible team until the remainder is empty
  // or large enough.
  const overallVisible = submissions.length >= minGroupSize;
  const remainder = (): number => submissions.length - teams.reduce((s, t) => s + t.people, 0);
  while (overallVisible && teams.length > 0 && remainder() > 0 && remainder() < minGroupSize) {
    teams.sort((a, b) => a.people - b.people || a.team.localeCompare(b.team));
    teams.shift();
    hiddenTeams += 1;
  }
  teams.sort((a, b) => a.team.localeCompare(b.team));
  return {
    overall: overallVisible ? { people: submissions.length, ...groupScore(submissions) } : null,
    // A single visible team would equal the overall score, so per-team rows add nothing then;
    // they still never reveal a group under the minimum.
    teams,
    hiddenTeams,
    weights: { ...READINESS_WEIGHTS },
    minGroupSize,
  };
};
