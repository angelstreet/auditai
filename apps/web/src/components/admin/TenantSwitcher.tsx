import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { tenantLabel } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';

interface Props {
  currentTenantId: string;
}

/**
 * Organisation switcher above the engagements table, as one row of chips. Hidden when the session
 * holds a single organisation: the account menu already names it (UI_RULES §11). Labels are loaded
 * server-side from the tenants table so they always reflect the current data.
 */
export default async function TenantSwitcher({ currentTenantId }: Props) {
  const { t } = getT();
  const tenantIds = await sessionTenantIds();
  if (tenantIds.length < 2) return null;
  const labels = await Promise.all(
    tenantIds.map(async (id) => ({ id, label: await tenantLabel(id) })),
  );
  return (
    <Stack
      component="nav"
      aria-label={t('admin.common.tenantNavAria')}
      direction="row"
      sx={{ gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 6 }}
    >
      <Typography variant="body2" color="text.secondary" component="span">
        {t('admin.common.tenantLabel')}
      </Typography>
      {labels.map(({ id, label }) => {
        const current = id === currentTenantId;
        return (
          <Chip
            key={id}
            label={label}
            component="a"
            clickable
            href={`/admin/engagements?tenant=${encodeURIComponent(id)}`}
            aria-current={current ? 'page' : undefined}
            variant="outlined"
            color={current ? 'primary' : 'default'}
            sx={{ minHeight: 36 }}
          />
        );
      })}
    </Stack>
  );
}
