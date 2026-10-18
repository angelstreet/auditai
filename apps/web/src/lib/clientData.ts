import type { TenantId } from '@evolai/contracts';
import { withTenant } from './db';
import { progress } from './invitationData';
import { MIN_GROUP_SIZE, type TeamProgressRow } from './invitationTracking';

/**
 * Data for the client surface (TASK-P, ADR 0035). Every query runs under `withTenant` with the
 * tenant and teams taken from the session's effective context, never from the URL, so a guessed
 * id from another tenant or team returns nothing (row-level security plus explicit filters).
 *
 * What a team referent may see (PRD §4.3, §15): counts for their own teams (with the minimum
 * group rule), their team's open links, and what the auditor approved. Never an answer, never
 * an individual result, never which link belongs to which answer.
 */

export interface ClientSurvey {
  readonly engagementId: string;
  /** Engagement label: the template name ("Pilot ..."). */
  readonly name: string;
  readonly status: string;
  readonly teams: readonly { id: string; name: string }[];
}

/** Most recent non-archived engagement that includes one of the referent's teams. */
export const loadClientSurvey = async (
  tenantId: string,
  teamIds: readonly string[],
): Promise<ClientSurvey | null> =>
  withTenant(tenantId as TenantId, async (client) => {
    const { rows } = await client.query<{ id: string; name: string; status: string }>(
      `SELECT e.id, tp.name, e.status
         FROM engagements e
         JOIN templates tp ON tp.id = e.template_id
        WHERE e.tenant_id = $1 AND e.status <> 'archived'
          AND EXISTS (SELECT 1 FROM engagement_teams et
                       WHERE et.engagement_id = e.id AND et.team_id = ANY($2::uuid[]))
        ORDER BY e.created_at DESC, e.id
        LIMIT 1`,
      [tenantId, teamIds],
    );
    const row = rows[0];
    if (!row) return null;
    const teams = await client.query<{ id: string; name: string }>(
      `SELECT t.id, t.name FROM engagement_teams et JOIN teams t ON t.id = et.team_id
        WHERE et.tenant_id = $1 AND et.engagement_id = $2 AND et.team_id = ANY($3::uuid[])
        ORDER BY t.name`,
      [tenantId, row.id, teamIds],
    );
    return { engagementId: row.id, name: row.name, status: row.status, teams: teams.rows };
  });

/** Names of the referent's teams, for titles, even before any survey exists. */
export const loadTeamNames = async (
  tenantId: string,
  teamIds: readonly string[],
): Promise<string[]> =>
  withTenant(tenantId as TenantId, async (client) => {
    const { rows } = await client.query<{ name: string }>(
      `SELECT name FROM teams WHERE tenant_id = $1 AND id = ANY($2::uuid[]) ORDER BY name`,
      [tenantId, teamIds],
    );
    return rows.map((r) => r.name);
  });

/** Progress rows of the referent's teams only; small teams stay suppressed. */
export const teamProgress = async (
  tenantId: string,
  engagementId: string,
  teamIds: readonly string[],
): Promise<TeamProgressRow[]> => {
  const all = await progress(tenantId as TenantId, engagementId);
  return all.teams.filter((t) => teamIds.includes(t.teamId));
};

export type NextStep = 'create' | 'remind' | 'wait' | 'results';

/** The one thing to do next, from counts and status alone. */
export const nextStep = (
  status: string,
  rows: readonly TeamProgressRow[],
  hasResults: boolean,
): NextStep => {
  if (hasResults || status === 'closed') return 'results';
  const invited = rows.reduce((n, r) => n + r.invited, 0);
  if (invited === 0) return 'create';
  if (rows.some((r) => r.suppressed || r.completed < r.invited)) return 'remind';
  return 'wait';
};

export interface PublishedTheme {
  readonly axis: string;
  readonly label: string;
  readonly people: number;
}

export interface PublishedOpportunity {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly axis: string | null;
}

export interface PublishedResults {
  readonly themes: readonly PublishedTheme[];
  readonly opportunities: readonly PublishedOpportunity[];
}

const PUBLISHED_OPPORTUNITY = ['approved', 'in_progress', 'delivered'];

/**
 * Pure aggregation of approved analyses into themes. A theme is shown only when at least
 * `MIN_GROUP_SIZE` distinct submissions raised it; summaries and quotes are never carried over.
 */
export const aggregateThemes = (
  analyses: readonly { submissionId: string; payload: unknown }[],
  minPeople: number = MIN_GROUP_SIZE,
): PublishedTheme[] => {
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

/** Only what the auditor approved: approved analyses (aggregated) and published opportunities. */
export const loadPublishedResults = async (
  tenantId: string,
  engagementId: string,
): Promise<PublishedResults> =>
  withTenant(tenantId as TenantId, async (client) => {
    const analyses = await client.query<{ submission_id: string; payload_json: unknown }>(
      `SELECT submission_id, payload_json FROM analyses
        WHERE tenant_id = $1 AND engagement_id = $2 AND approved_at IS NOT NULL`,
      [tenantId, engagementId],
    );
    const opps = await client.query<{
      id: string;
      title: string;
      status: string;
      axis: string | null;
    }>(
      `SELECT id, title, status, axis FROM opportunities
        WHERE tenant_id = $1 AND engagement_id = $2 AND status = ANY($3::text[])
        ORDER BY created_at, id`,
      [tenantId, engagementId, PUBLISHED_OPPORTUNITY],
    );
    return {
      themes: aggregateThemes(
        analyses.rows.map((r) => ({ submissionId: r.submission_id, payload: r.payload_json })),
      ),
      opportunities: opps.rows,
    };
  });
