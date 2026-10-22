import type { ReactNode } from 'react';
import { PageTitle } from '@evolai/ui';
import { WorkspaceTabs } from '@/components/mission/WorkspaceTabs';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/** Workspace Settings frame (TASK-AD2, ADR 0049): what is not about one mission. */
export default async function WorkspaceSettingsLayout({ children }: { children: ReactNode }) {
  const { t } = getT();
  const current = (await sessionTenantIds())[0];
  return (
    <>
      <div className="wide admin">
        <PageTitle id="workspace-title" title={t('admin.workspace.title')} />
        {current ? <WorkspaceTabs tenantId={current} /> : null}
      </div>
      {children}
    </>
  );
}
