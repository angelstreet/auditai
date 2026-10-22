import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { formatDate } from '@evolai/i18n';
import { AppIcon, EmptyState, PageTitle, StatusText, type Status } from '@evolai/ui';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { MIN_GROUP_SIZE } from '@/lib/invitationTracking';
import { listMissions, type MissionRow } from '@/lib/missionData';
import { missionHref, type MissionStatus } from '@/lib/missionStatus';
import { listableIds, showTestData, testTenantIds } from '@/lib/testData';

export const dynamic = 'force-dynamic';

// Status as icon plus word (UI_RULES §4): still running is neutral, done is success.
const STATUS_ICON: Record<MissionStatus, Status> = {
  draft: 'pending',
  open: 'running',
  closed: 'info',
  published: 'success',
};

/**
 * Missions home (TASK-AD2, ADR 0049): where staff land after signing in. One row per mission of
 * every organisation they work for, with its one next step; one page action, "New mission".
 * Test organisations are left out unless "Show test data" is on.
 */
export default async function MissionsPage({
  searchParams,
}: {
  searchParams: { tenant?: string };
}) {
  const { t, locale } = getT();
  const tenants = await sessionTenantIds();
  const ids = listableIds(tenants, await testTenantIds(), showTestData());
  const current = ids.find((x) => x === searchParams.tenant) ?? ids[0];
  const missions = await listMissions(ids);

  const answers = (m: MissionRow) =>
    m.submitted < MIN_GROUP_SIZE
      ? t('admin.missions.answersHidden', { n: MIN_GROUP_SIZE })
      : t('admin.missions.answersOf', { submitted: m.submitted, expected: m.expected });
  const closes = (m: MissionRow) =>
    m.closesAt ? formatDate(locale, m.closesAt) : t('admin.missions.noDate');
  const status = (m: MissionRow) => (
    <StatusText status={STATUS_ICON[m.status]}>{t(`admin.missions.status.${m.status}`)}</StatusText>
  );
  const nextButton = (m: MissionRow) => (
    <Button
      variant="outlined"
      size="small"
      href={missionHref(m.id, m.next.tab, m.tenantId)}
      endIcon={<AppIcon name="forward" size={16} />}
      sx={{ minHeight: 44 }}
    >
      {t(`admin.missions.next.${m.next.step}`)}
    </Button>
  );
  const title = (m: MissionRow) => (
    <Link href={missionHref(m.id, 'overview', m.tenantId)} data-testid="mission-link">
      {m.client}
    </Link>
  );
  const newMission = current ? (
    <Button
      variant="contained"
      href={`/admin/engagements/new?tenant=${current}`}
      startIcon={<AppIcon name="add" size={20} />}
    >
      {t('admin.missions.newMission')}
    </Button>
  ) : null;

  return (
    <section aria-labelledby="missions-title" className="wide admin">
      <PageTitle
        id="missions-title"
        title={t('admin.missions.title')}
        subtitle={t('admin.missions.subtitle')}
        actions={missions.length > 0 ? newMission : undefined}
      />
      {missions.length === 0 ? (
        <Stack sx={{ alignItems: 'flex-start', gap: 4 }}>
          <EmptyState title={t('admin.missions.empty')} />
          {newMission}
        </Stack>
      ) : (
        <>
          <Paper
            variant="outlined"
            sx={{ display: { xs: 'none', md: 'block' }, borderRadius: 3, overflow: 'hidden' }}
          >
            <Table aria-label={t('admin.missions.tableAria')} sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '28%' }}>{t('admin.missions.colClient')}</TableCell>
                  <TableCell sx={{ width: '18%' }}>{t('admin.missions.colStatus')}</TableCell>
                  <TableCell sx={{ width: '18%' }}>{t('admin.missions.colAnswers')}</TableCell>
                  <TableCell sx={{ width: '14%' }}>{t('admin.missions.colCloses')}</TableCell>
                  <TableCell sx={{ width: '22%' }}>{t('admin.missions.colNext')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {missions.map((m) => (
                  <TableRow key={m.id} hover data-testid="mission-row">
                    <TableCell
                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={m.client}
                    >
                      {title(m)}
                    </TableCell>
                    <TableCell>{status(m)}</TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{answers(m)}</TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{closes(m)}</TableCell>
                    <TableCell>{nextButton(m)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
          <Stack component="ul" sx={{ display: { xs: 'flex', md: 'none' }, gap: 3, p: 0, m: 0 }}>
            {missions.map((m) => (
              <Paper
                key={m.id}
                component="li"
                variant="outlined"
                data-testid="mission-card"
                sx={{ listStyle: 'none', p: 4, borderRadius: 3 }}
              >
                <Typography variant="cardTitle" component="h2" sx={{ m: 0, mb: 2 }}>
                  {title(m)}
                </Typography>
                {status(m)}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  {t('admin.missions.colAnswers')}: {answers(m)}
                  {m.closesAt ? ` · ${t('admin.missions.closesOn', { date: closes(m) })}` : null}
                </Typography>
                <Box sx={{ mt: 3 }}>{nextButton(m)}</Box>
              </Paper>
            ))}
          </Stack>
        </>
      )}
    </section>
  );
}
