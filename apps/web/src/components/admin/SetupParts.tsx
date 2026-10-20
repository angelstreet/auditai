'use client';

import { memo, useEffect } from 'react';
import Box from '@mui/material/Box';
import { StatusText, useNotify } from '@evolai/ui';
import type { MessageKey } from '@evolai/i18n';
import { useI18n } from '@/components/I18nProvider';
import type { SetupActionState } from '@/app/admin/engagements/state';

const SNACKBAR_CODES = new Set(['saved', 'team_saved', 'team_created']);

/** One line of feedback for a set-up action: icon plus plain words, announced politely. */
export function SetupResult({ state }: { state: SetupActionState }) {
  const { t } = useI18n();
  const notify = useNotify();
  // A save also shows as a snackbar (UI_RULES §4), so a change far from the button is not missed.
  useEffect(() => {
    if (state.ok && SNACKBAR_CODES.has(state.code)) {
      notify(t(`admin.setup.result.${state.code}` as MessageKey));
    }
  }, [state, notify, t]);
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
