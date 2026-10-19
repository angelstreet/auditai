import { Suspense, type ReactNode } from 'react';
import Typography from '@mui/material/Typography';
import AdminTabs from '@/components/admin/AdminTabs';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';

/** Every admin page opens with the section tabs, so the user always knows where they are (§11). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // On a phone the header has no room for the organisation name, so it is shown here (ADR 0038).
  const first = (await sessionTenantIds())[0];
  const organisation = first ? await tenantLabel(first).catch(() => null) : null;
  return (
    <>
      {organisation ? (
        <Typography
          variant="body2"
          color="text.secondary"
          data-testid="admin-organisation"
          sx={{ display: { xs: 'block', sm: 'none' }, mb: 2 }}
        >
          {organisation}
        </Typography>
      ) : null}
      <Suspense fallback={null}>
        <AdminTabs />
      </Suspense>
      {children}
    </>
  );
}
