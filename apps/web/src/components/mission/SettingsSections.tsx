import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { TenantId } from '@evolai/contracts';
import { RedactionListClient } from '@/app/admin/redaction/RedactionListClient';
import { AddTeamForm, TeamRow } from '@/components/admin/SetupForms';
import { getT } from '@/lib/i18n';
import { listRedactionTerms } from '@/lib/redactionTermData';
import { readRedactionTrail } from '@/lib/redactionTrail';
import { listTeamsSetup } from '@/lib/setupData';

const CARD_SX = { p: 4, borderRadius: 3, mb: 5 } as const;

/** Teams and their sizes, added and edited where a mission is set up (TASK-AD2). */
export async function TeamsSection({ tenantId }: { tenantId: TenantId }) {
  const { t } = getT();
  const teams = await listTeamsSetup(tenantId);
  return (
    <Paper variant="outlined" component="section" id="teams" aria-labelledby="teams-title" sx={CARD_SX}>
      <Typography id="teams-title" variant="sectionTitle" component="h2">
        {t('admin.setup.teams.addTitle')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('admin.setup.teams.addIntro')}
      </Typography>
      <AddTeamForm tenantId={tenantId} />
      {teams.length > 0 ? (
        <ul style={{ padding: 0, margin: 0 }}>
          {teams.map((team) => (
            <TeamRow
              key={team.id}
              tenantId={tenantId}
              team={{ id: team.id, name: team.name, size: team.expectedHeadcount }}
              usedLabel={t('admin.setup.teams.usedIn', { n: team.engagementCount })}
            />
          ))}
        </ul>
      ) : null}
    </Paper>
  );
}

/** Names hidden in every free-text answer of this client (ADR 0044), with who changed the list. */
export async function NamesToHideSection({ tenantId }: { tenantId: TenantId }) {
  const { t, locale } = getT();
  const [terms, trail] = await Promise.all([
    listRedactionTerms(tenantId),
    readRedactionTrail(tenantId),
  ]);
  return (
    <Paper variant="outlined" component="section" id="names" aria-labelledby="names-title" sx={CARD_SX}>
      <Typography id="names-title" variant="sectionTitle" component="h2">
        {t('admin.redaction.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('admin.redaction.intro')}
      </Typography>
      <RedactionListClient
        tenantId={tenantId}
        terms={terms}
        auditTrail={trail}
        locale={locale}
        emptyTitle={t('admin.redaction.none')}
      />
    </Paper>
  );
}
