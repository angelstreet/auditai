import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { headers } from 'next/headers';
import type { TenantId } from '@evolai/contracts';
import { AppIcon, EmptyState, PageTitle } from '@evolai/ui';
import { requireClientContext } from '@/lib/clientContext';
import { loadClientSurvey, loadTeamNames } from '@/lib/clientData';
import { getT } from '@/lib/i18n';
import { listOpen, reminderList } from '@/lib/invitationData';
import { resolveBaseUrl } from '@/lib/invitationTracking';
import CreateLinksForm from './CreateLinksForm';

export const dynamic = 'force-dynamic';

/**
 * Team space invitations (TASK-P, FR-03 scoped to the referent's team): create links, download
 * them or print QR codes, and see who is due a reminder. Links only: nothing says which link
 * belongs to which answer, and no name or address is shown.
 */
export default async function ClientInvitations() {
  const { ctx } = await requireClientContext();
  const { t } = getT();
  const teamName = (await loadTeamNames(ctx.tenantId, ctx.teamIds)).join(', ');
  const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
  const title = (
    <PageTitle
      id="client-inv-title"
      title={t('client.invitations.title')}
      subtitle={t('client.invitations.subtitle', { team: teamName })}
    />
  );
  if (!survey) {
    return (
      <section aria-labelledby="client-inv-title">
        {title}
        <EmptyState icon="pending" title={t('client.home.noSurvey')} />
      </section>
    );
  }
  const h = headers();
  const baseUrl = resolveBaseUrl(
    process.env,
    h.get('x-forwarded-host') ?? h.get('host'),
    h.get('x-forwarded-proto'),
  );
  const [open, due] = await Promise.all([
    listOpen(ctx.tenantId as TenantId, survey.engagementId, baseUrl, ctx.teamIds),
    reminderList(ctx.tenantId as TenantId, survey.engagementId, baseUrl, new Date(), ctx.teamIds),
  ]);
  return (
    <section aria-labelledby="client-inv-title">
      {title}
      <Stack spacing={4}>
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="sectionTitle" component="h2" sx={{ m: 0, mb: 4 }}>
            {t('client.invitations.createTitle')}
          </Typography>
          <CreateLinksForm readOnly={ctx.readOnly} teams={survey.teams} />
        </Paper>

        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-open-links">
          <Typography variant="sectionTitle" component="h2" sx={{ m: 0 }}>
            {t('client.invitations.openTitle')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 4 }}>
            {open.length === 0
              ? t('client.invitations.openEmpty')
              : t('client.invitations.openCount', { count: open.length })}
          </Typography>
          {open.length > 0 ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="outlined"
                href="/client/invitations/export?kind=all"
                title={t('client.invitations.downloadAria')}
                startIcon={<AppIcon name="download" size={16} />}
                sx={{ minHeight: 44 }}
              >
                {t('client.invitations.download')}
              </Button>
              <Button
                variant="outlined"
                href="/client/invitations/sheet"
                title={t('client.invitations.sheetAria')}
                startIcon={<AppIcon name="qrCode" size={16} />}
                sx={{ minHeight: 44 }}
              >
                {t('client.invitations.sheet')}
              </Button>
            </Stack>
          ) : null}
        </Paper>

        <Paper
          id="reminders"
          variant="outlined"
          sx={{ p: 4, borderRadius: 3 }}
          data-testid="client-reminders"
        >
          <Typography variant="sectionTitle" component="h2" sx={{ m: 0 }}>
            {t('client.invitations.remindTitle')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            {due.length === 0
              ? t('client.invitations.remindEmpty')
              : `${t('client.invitations.remindCount', { count: due.length })}. ${t('client.invitations.remindHint')}`}
          </Typography>
          {due.length > 0 ? (
            <>
              <List dense sx={{ my: 2 }}>
                {due.map((d) => (
                  <ListItem key={d.id} divider>
                    <ListItemText
                      primary={d.code}
                      secondary={t('client.invitations.expires', { date: d.expiresOn })}
                      primaryTypographyProps={{ sx: { fontVariantNumeric: 'tabular-nums' } }}
                    />
                  </ListItem>
                ))}
              </List>
              <Button
                variant="outlined"
                href="/client/invitations/export?kind=reminders"
                startIcon={<AppIcon name="download" size={16} />}
                sx={{ minHeight: 44 }}
              >
                {t('client.invitations.remindDownload')}
              </Button>
            </>
          ) : null}
        </Paper>
      </Stack>
    </section>
  );
}
