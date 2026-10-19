'use client';

import { useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppIcon, ConfirmDialog } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { workflowAction } from '@/app/admin/reports/actions';
import { reportIdle } from '@/app/admin/reports/state';
import { ActionResult, Hidden, type Ids } from './ReportForms';

/** Review, publish, unpublish and new version, each deliberate. Publish is the one primary action. */
export function WorkflowBar({
  ids,
  status,
  version,
  visibleVersion,
  readOnly,
}: {
  ids: Ids;
  status: 'draft' | 'in_review' | 'published';
  version: number;
  visibleVersion: number | null;
  readOnly: boolean;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(workflowAction, reportIdle);
  const formRef = useRef<HTMLFormElement>(null);
  const [asking, setAsking] = useState<'publish' | 'unpublish' | 'version' | null>(null);
  const submit = (change: string, confirm: boolean) => {
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem('change') as HTMLInputElement).value = change;
    (form.elements.namedItem('confirm') as HTMLInputElement).value = confirm ? 'yes' : '';
    form.requestSubmit();
  };
  const dialog = {
    publish: {
      title: t('report.workflow.publishTitle'),
      body: t('report.workflow.publishBody', { version }),
      confirm: t('report.workflow.publishConfirm'),
    },
    unpublish: {
      title: t('report.workflow.unpublishTitle'),
      body: t('report.workflow.unpublishBody'),
      confirm: t('report.workflow.unpublishConfirm'),
    },
    version: {
      title: t('report.workflow.newVersionTitle', { version: version + 1 }),
      body: t('report.workflow.newVersionBody'),
      confirm: t('report.workflow.newVersionConfirm'),
    },
  } as const;
  return (
    <Box component="form" ref={formRef} action={action} data-testid="report-workflow">
      <Hidden ids={ids} />
      <input type="hidden" name="change" value="" />
      <input type="hidden" name="confirm" value="" />
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {status === 'draft' ? (
          <Button
            variant="outlined"
            disabled={readOnly}
            onClick={() => submit('review', false)}
            sx={{ minHeight: 44 }}
            data-testid="report-to-review"
          >
            {t('report.workflow.toReview')}
          </Button>
        ) : null}
        {status === 'in_review' ? (
          <>
            <Button
              variant="text"
              disabled={readOnly}
              onClick={() => submit('draft', false)}
              sx={{ minHeight: 44 }}
            >
              {t('report.workflow.toDraft')}
            </Button>
            <Button
              variant="contained"
              disabled={readOnly}
              onClick={() => setAsking('publish')}
              startIcon={<AppIcon name="act" size={20} />}
              sx={{ minHeight: 44 }}
              data-testid="report-publish"
            >
              {t('report.workflow.publish')}
            </Button>
          </>
        ) : null}
        {status === 'published' ? (
          <Button
            variant="outlined"
            disabled={readOnly}
            onClick={() => setAsking('version')}
            startIcon={<AppIcon name="edit" size={20} />}
            sx={{ minHeight: 44 }}
            data-testid="report-new-version"
          >
            {t('report.workflow.newVersion')}
          </Button>
        ) : null}
        {visibleVersion !== null ? (
          <Button
            variant="outlined"
            color="error"
            disabled={readOnly}
            onClick={() => setAsking('unpublish')}
            sx={{ minHeight: 44 }}
            data-testid="report-unpublish"
          >
            {t('report.workflow.unpublish')}
          </Button>
        ) : null}
      </Stack>
      {status === 'draft' ? (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
          {t('report.workflow.publishNeedsReview')}
        </Typography>
      ) : null}
      <Box sx={{ mt: 2 }}>
        <ActionResult state={state} />
      </Box>
      <ConfirmDialog
        open={asking !== null}
        danger={asking === 'unpublish'}
        title={asking ? dialog[asking].title : ''}
        body={asking ? dialog[asking].body : ''}
        confirmLabel={asking ? dialog[asking].confirm : ''}
        cancelLabel={t('report.workflow.cancel')}
        onClose={() => setAsking(null)}
        onConfirm={() => {
          const change = asking;
          setAsking(null);
          if (change) submit(change, true);
        }}
      />
    </Box>
  );
}
