import type { ReactNode } from 'react';
import Typography from '@mui/material/Typography';
import ClientTabs from '@/components/client/ClientTabs';
import { clientContextOrRedirect } from '@/lib/clientContext';
import { getT } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * Team space (TASK-P, ADR 0035): what a team referent sees, and what the platform owner sees while
 * viewing as one. The organisation is stated above every page; there is no organisation switcher.
 */
export default async function ClientLayout({ children }: { children: ReactNode }) {
  const { ctx, organisation } = await clientContextOrRedirect();
  const { t } = getT();
  return (
    <div className="wide" data-testid="client-space" data-tenant={ctx.tenantId}>
      <Typography
        variant="body2"
        color="text.secondary"
        data-testid="client-organisation"
        sx={{ mb: 2, displayPrint: 'none' }}
      >
        {t('client.organisation', { tenant: organisation })}
      </Typography>
      <ClientTabs />
      {children}
    </div>
  );
}
