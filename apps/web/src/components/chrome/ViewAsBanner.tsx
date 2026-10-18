import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppIcon } from '@evolai/ui';
import { getSession } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { viewAsRoleLabel } from '@/lib/viewAsLabels';

/**
 * Sticky banner under the header while the owner views the app as a client persona (TASK-P,
 * docs/UI_RULES.md §14). One line, an icon, the read-only notice and one way back. It is rendered
 * from the signed session on the server, so it shows on every page of the view-as.
 */
export default async function ViewAsBanner() {
  const session = await getSession();
  const v = session?.viewAs;
  if (!v) return null;
  const { t } = getT();
  const text = t('client.viewAs.banner', {
    tenant: v.tenantLabel,
    name: v.label,
    role: viewAsRoleLabel(t, v.role),
  });
  return (
    <Box
      role="region"
      aria-label={t('client.viewAs.section')}
      data-testid="view-as-banner"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 'appBar',
        bgcolor: 'background.paper',
        borderBottom: 2,
        borderColor: 'warning.main',
        displayPrint: 'none',
      }}
    >
      <Stack
        direction="row"
        className="container"
        sx={{ alignItems: 'center', gap: 3, py: 2, flexWrap: 'wrap' }}
      >
        <Box component="span" sx={{ color: 'warning.main', display: 'inline-flex' }} aria-hidden>
          <AppIcon name="visibility" />
        </Box>
        <Typography variant="body2" sx={{ m: 0, flex: '1 1 16rem', fontWeight: 600 }}>
          {text}
        </Typography>
        <Box component="form" method="post" action="/api/view-as" sx={{ m: 0 }}>
          <input type="hidden" name="persona" value="self" />
          <Button
            type="submit"
            variant="outlined"
            size="small"
            data-testid="view-as-back"
            title={t('client.viewAs.backAria')}
            startIcon={<AppIcon name="back" size={16} />}
            sx={{ minHeight: 44 }}
          >
            {t('client.viewAs.back')}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
