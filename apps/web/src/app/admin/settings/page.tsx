import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { StatusText } from '@evolai/ui';
import ReferentInviteForm from '@/app/admin/teams/ReferentInviteForm';
import { getSession, sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { listReferents } from '@/lib/referentData';
import { ownedTenantIds } from '@/lib/tenantAccess';
import { showTestData } from '@/lib/testData';
import { setShowTestDataAction } from './actions';

export const dynamic = 'force-dynamic';

const CARD_SX = { p: 4, borderRadius: 3, mb: 5 } as const;

/** Workspace Settings, Members: the client referents and their sign-in links (TASK-AD2). */
export default async function MembersPage() {
  const { t } = getT();
  const [tenants, session] = await Promise.all([sessionTenantIds(), getSession()]);
  const current = tenants[0];
  const referents = current ? await listReferents(current) : [];
  const owner = Boolean(session && !session.viewAs && ownedTenantIds(session).length > 0);
  const show = showTestData();
  return (
    <section className="wide admin" aria-labelledby="members-title">
      <Paper variant="outlined" component="section" aria-labelledby="members-title" sx={CARD_SX}>
        <Typography id="members-title" variant="sectionTitle" component="h2">
          {t('trust.referents.title')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          {t('trust.referents.intro')}
        </Typography>
        {referents.length === 0 ? (
          <p className="muted">{t('trust.referents.none')}</p>
        ) : (
          <ul className="card-list">
            {referents.map((r) => (
              <li key={r.userId} className="card" data-testid="referent-card">
                <header>
                  <h3>
                    {r.name} <span className="muted">({r.teamName})</span>
                  </h3>
                  <StatusText status={r.status === 'ready' ? 'success' : 'pending'}>
                    {t(
                      r.status === 'ready'
                        ? 'trust.referents.statusReady'
                        : r.status === 'disabled'
                          ? 'trust.referents.statusDisabled'
                          : 'trust.referents.statusNone',
                    )}
                  </StatusText>
                </header>
                {r.status === 'disabled' || !current ? null : (
                  <ReferentInviteForm tenantId={current} userId={r.userId} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Paper>
      {owner ? (
        <Paper variant="outlined" component="section" aria-labelledby="test-title" sx={CARD_SX}>
          <Typography id="test-title" variant="sectionTitle" component="h2">
            {t('admin.workspace.testTitle')}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {t(show ? 'admin.workspace.testOn' : 'admin.workspace.testOff')}
          </Typography>
          <form action={setShowTestDataAction}>
            <input type="hidden" name="show" value={show ? '0' : '1'} />
            <Button type="submit" variant="outlined" data-testid="show-test-data">
              {t(show ? 'admin.workspace.testHide' : 'admin.workspace.testShow')}
            </Button>
          </form>
        </Paper>
      ) : null}
    </section>
  );
}
