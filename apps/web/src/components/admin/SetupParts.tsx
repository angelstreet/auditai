'use client';

import { memo } from 'react';
import Box from '@mui/material/Box';
import { StatusText } from '@evolai/ui';
import type { MessageKey } from '@evolai/i18n';
import { useI18n } from '@/components/I18nProvider';
import type { SetupActionState } from '@/app/admin/engagements/state';

/** One line of feedback for a set-up action: icon plus plain words, announced politely. */
export function SetupResult({ state }: { state: SetupActionState }) {
  const { t } = useI18n();
  return (
    <Box aria-live="polite" sx={{ minHeight: 24 }}>
      {state.code !== 'idle' ? (
        <StatusText status={state.ok ? 'success' : 'error'}>
          {t(`admin.setup.result.${state.code}` as MessageKey)}
        </StatusText>
      ) : null}
    </Box>
  );
}

// Memoised so a re-render never rewrites the hidden tenant field (see e2e/auth.spec.ts).
export const TenantField = memo(function TenantField({ tenantId }: { tenantId: string }) {
  return <input type="hidden" name="tenantId" value={tenantId} />;
});
