'use client';

import { useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppIcon, ConfirmDialog } from '@evolai/ui';
import type { MessageKey } from '@evolai/i18n';
import { useI18n } from '@/components/I18nProvider';
import { changeStatusAction } from '@/app/admin/engagements/actions';
import { setupIdle } from '@/app/admin/engagements/state';
import { SetupResult, TenantField } from './SetupParts';

/** Status section: the launch and close buttons, each behind a plain confirmation. */
export default function StatusPanel({
  tenantId,
  engagementId,
  status,
  hasTeams,
}: {
  tenantId: string;
  engagementId: string;
  status: string;
  hasTeams: boolean;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(changeStatusAction, setupIdle);
  const formRef = useRef<HTMLFormElement>(null);
  const [asking, setAsking] = useState<'launch' | 'close' | null>(null);
  const canLaunch = status === 'draft' || status === 'scheduled';
  const canClose = status === 'in_field';
  const submit = (change: 'launch' | 'close') => {
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem('change') as HTMLInputElement).value = change;
    (form.elements.namedItem('confirm') as HTMLInputElement).value = 'yes';
    form.requestSubmit();
  };
  return (
    <Stack component="form" ref={formRef} action={action} sx={{ gap: 3 }}>
      <TenantField tenantId={tenantId} />
      <input type="hidden" name="engagementId" value={engagementId} />
      <input type="hidden" name="change" value="" />
      <input type="hidden" name="confirm" value="" />
      <Typography>{t(`admin.setup.status.${status}` as MessageKey)}</Typography>
      {canLaunch ? (
        <Box>
          <Button
            variant="contained"
            disabled={!hasTeams}
            onClick={() => setAsking('launch')}
            startIcon={<AppIcon name="act" size={20} />}
          >
            {t('admin.setup.status.launch')}
          </Button>
          {hasTeams ? null : (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              {t('admin.setup.status.needTeams')}
            </Typography>
          )}
        </Box>
      ) : null}
      {canClose ? (
        <Box>
          <Button variant="outlined" color="error" onClick={() => setAsking('close')}>
            {t('admin.setup.status.close')}
          </Button>
        </Box>
      ) : null}
      <SetupResult state={state} />
      <ConfirmDialog
        open={asking !== null}
        danger={asking === 'close'}
        title={
          asking === 'close'
            ? t('admin.setup.status.closeTitle')
            : t('admin.setup.status.launchTitle')
        }
        body={
          asking === 'close'
            ? t('admin.setup.status.closeBody')
            : t('admin.setup.status.launchBody')
        }
        confirmLabel={
          asking === 'close'
            ? t('admin.setup.status.closeConfirm')
            : t('admin.setup.status.launchConfirm')
        }
        cancelLabel={t('admin.setup.status.cancel')}
        onClose={() => setAsking(null)}
        onConfirm={() => {
          const change = asking;
          setAsking(null);
          if (change) submit(change);
        }}
      />
    </Stack>
  );
}
