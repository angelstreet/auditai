'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppIcon } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { VIEW_AS_SEEN_COOKIE } from '@/lib/viewAsSeen';

/**
 * The view-as banner itself. Desktop: always the full sentence. Phones: the full sentence on the
 * first page, then one compact line ("Viewing as Sam. Read only.") with a details toggle and the
 * back button as an icon, so the banner stops eating the screen (TASK-S, feedback item 14).
 */
export default function ViewAsBannerBar({
  personaId,
  compact,
  text,
  short,
}: {
  personaId: string;
  compact: boolean;
  text: string;
  short: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!compact) {
      document.cookie = `${VIEW_AS_SEEN_COOKIE}=${encodeURIComponent(personaId)}; path=/; max-age=43200; samesite=lax`;
    }
  }, [compact, personaId]);
  const onPhone = (whenCompact: string, otherwise: string) =>
    compact ? { xs: whenCompact, sm: otherwise } : otherwise;
  return (
    <Box
      role="region"
      aria-label={t('client.viewAs.section')}
      data-testid="view-as-banner"
      data-compact={compact ? 'true' : 'false'}
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
        sx={{
          alignItems: 'center',
          gap: compact ? { xs: 1, sm: 3 } : 3,
          py: compact ? { xs: 0.5, sm: 2 } : 2,
          flexWrap: onPhone('nowrap', 'wrap'),
        }}
      >
        <Box component="span" sx={{ color: 'warning.main', display: 'inline-flex' }} aria-hidden>
          <AppIcon name="visibility" />
        </Box>
        <Typography
          variant="body1"
          sx={{
            m: 0,
            flex: compact ? { xs: '1 1 auto', sm: '1 1 16rem' } : '1 1 16rem',
            minWidth: 0,
            fontWeight: 600,
          }}
        >
          <Box component="span" sx={{ display: onPhone('none', 'inline') }}>
            {text}
          </Box>
          {compact ? (
            <Box
              component="span"
              title={text}
              sx={{ display: { xs: 'block', sm: 'none' }, overflowWrap: 'anywhere' }}
            >
              {short}
            </Box>
          ) : null}
        </Typography>
        {compact ? (
          <IconButton
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="view-as-details"
            aria-label={open ? t('client.viewAs.hideDetails') : t('client.viewAs.details')}
            data-testid="view-as-details"
            sx={{ display: { xs: 'inline-flex', sm: 'none' }, width: 44, height: 44 }}
          >
            <AppIcon name={open ? 'collapse' : 'expand'} />
          </IconButton>
        ) : null}
        <Box component="form" method="post" action="/api/view-as" sx={{ m: 0 }}>
          <input type="hidden" name="persona" value="self" />
          <Button
            type="submit"
            variant="outlined"
            size="small"
            data-testid="view-as-back"
            aria-label={t('client.viewAs.back')}
            title={t('client.viewAs.backAria')}
            startIcon={<AppIcon name="back" size={16} />}
            sx={{
              minHeight: 44,
              minWidth: compact ? { xs: 44, sm: 64 } : 64,
              '& .MuiButton-startIcon': compact
                ? { mr: { xs: 0, sm: 1 }, ml: { xs: 0, sm: -0.5 } }
                : {},
            }}
          >
            <Box component="span" sx={{ display: onPhone('none', 'inline') }}>
              {t('client.viewAs.back')}
            </Box>
          </Button>
        </Box>
      </Stack>
      {compact ? (
        <Collapse in={open} sx={{ display: { sm: 'none' } }}>
          <Typography
            id="view-as-details"
            variant="body1"
            className="container"
            sx={{ m: 0, pb: 2 }}
          >
            {text}
          </Typography>
        </Collapse>
      ) : null}
    </Box>
  );
}
