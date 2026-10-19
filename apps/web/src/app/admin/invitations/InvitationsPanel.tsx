'use client';

import { useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AppIcon, ConfirmDialog, EmptyState, StatusText } from '@evolai/ui';
import {
  createInvitationsAction,
  invitationOperationAction,
  markRemindedAction,
  revokeBatchAction,
  updateInvitationSettingsAction,
} from './actions';
import { idleState, type InviteActionState } from './state';

interface Copy {
  readonly [key: string]: unknown;
}
type Dict = Record<string, string>;

interface Props {
  copy: Copy;
  fewer: string;
  minGroup: number;
  tenantId: string;
  engagementId: string;
  emailDelivery: boolean;
  reminderDays: string;
  teams: { id: string; name: string }[];
  progress: {
    teamId: string;
    teamName: string;
    invited: number;
    suppressed: boolean;
    completionRate: number;
    completed: number;
    lastActivityOn: string | null;
  }[];
  open: { id: string; code: string; teamName: string; expiresOn: string }[];
  dueCount: number;
  /** Link batches with their words already built by the page (locale dates and plurals). */
  batches: { batchId: string; label: string; stillOpen: string; canRevoke: boolean }[];
}

const sub = (copy: Copy, key: string): Dict => copy[key] as Dict;
const fill = (s: string, vars: Record<string, string | number | undefined>): string =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** One line of feedback for an action result: words only, never an address or a link. */
function Result({ state, copy }: { state: InviteActionState; copy: Copy }) {
  if (state.code === 'idle') return null;
  const ok = sub(copy, 'result');
  const err = sub(copy, 'errors');
  const text = state.ok
    ? [
        fill(ok[state.code] ?? '', { n: state.count }),
        state.emailSent || state.emailFailed
          ? fill(ok['createdEmail'] ?? '', { sent: state.emailSent, failed: state.emailFailed })
          : '',
      ]
        .filter(Boolean)
        .join(' ')
    : (err[state.code] ?? err['error'] ?? '');
  return (
    <div role="status">
      <StatusText status={state.ok ? 'success' : 'error'}>{text}</StatusText>
    </div>
  );
}

function Hidden({ p }: { p: Props }) {
  return (
    <>
      <input type="hidden" name="tenantId" value={p.tenantId} />
      <input type="hidden" name="engagementId" value={p.engagementId} />
    </>
  );
}

function OpenRow({ p, row }: { p: Props; row: Props['open'][number] }) {
  const manage = sub(p.copy, 'manage');
  const [state, run] = useFormState(invitationOperationAction, idleState);
  const [confirm, setConfirm] = useState(false);
  const submit = (op: string, form: HTMLFormElement | null) => {
    if (!form) return;
    (form.elements.namedItem('op') as HTMLInputElement).value = op;
    form.requestSubmit();
  };
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <Box component="li" sx={{ py: 2, borderBottom: 1, borderColor: 'divider', listStyle: 'none' }}>
      <form action={run} ref={formRef}>
        <Hidden p={p} />
        <input type="hidden" name="invitationId" value={row.id} />
        <input type="hidden" name="op" value="" />
        <input type="hidden" name="days" value="7" />
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography sx={{ fontFamily: 'var(--font-mono)' }}>{row.code}</Typography>
          <Typography color="text.secondary">
            {row.teamName} · {manage['expires']} {row.expiresOn}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button variant="text" onClick={() => submit('extend', formRef.current)}>
            {manage['extend']}
          </Button>
          <Button variant="text" onClick={() => submit('regenerate', formRef.current)}>
            {manage['regenerate']}
          </Button>
          <Button variant="outlined" color="error" onClick={() => setConfirm(true)}>
            {manage['revoke']}
          </Button>
        </Stack>
        {state.link ? (
          <Typography sx={{ mt: 1, wordBreak: 'break-all' }}>
            {manage['regenerated']} <code>{state.link}</code>
          </Typography>
        ) : (
          <Result state={state} copy={p.copy} />
        )}
      </form>
      <ConfirmDialog
        open={confirm}
        danger
        title={manage['revoke']}
        body={manage['revokeConfirm']}
        confirmLabel={manage['revoke']}
        cancelLabel="×"
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          submit('revoke', formRef.current);
        }}
      />
    </Box>
  );
}

function BatchRow({ p, row }: { p: Props; row: Props['batches'][number] }) {
  const batches = sub(p.copy, 'batches');
  const [state, run] = useFormState(revokeBatchAction, idleState);
  const [confirm, setConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <Box component="li" sx={{ py: 2, borderBottom: 1, borderColor: 'divider', listStyle: 'none' }}>
      <form action={run} ref={formRef}>
        <Hidden p={p} />
        <input type="hidden" name="batchId" value={row.batchId} />
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography>{row.label}</Typography>
          <Typography color="text.secondary">{row.stillOpen}</Typography>
          <Box sx={{ flex: 1 }} />
          {row.canRevoke ? (
            <Button variant="outlined" color="error" onClick={() => setConfirm(true)}>
              {batches['revoke']}
            </Button>
          ) : null}
        </Stack>
        <Result state={state} copy={p.copy} />
      </form>
      <ConfirmDialog
        open={confirm}
        danger
        title={batches['revoke']}
        body={batches['revokeConfirm']}
        confirmLabel={batches['revoke']}
        cancelLabel="×"
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          formRef.current?.requestSubmit();
        }}
      />
    </Box>
  );
}

export default function InvitationsPanel(p: Props) {
  const create = sub(p.copy, 'create');
  const settings = sub(p.copy, 'settings');
  const teamsCopy = sub(p.copy, 'teams');
  const exp = sub(p.copy, 'export');
  const rem = sub(p.copy, 'reminders');
  const manage = sub(p.copy, 'manage');
  const [created, doCreate] = useFormState(createInvitationsAction, idleState);
  const [saved, doSave] = useFormState(updateInvitationSettingsAction, idleState);
  const [reminded, doRemind] = useFormState(markRemindedAction, idleState);
  const query = `tenant=${p.tenantId}&engagement=${p.engagementId}`;

  return (
    <Stack spacing={6}>
      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} component="section">
        <Typography variant="sectionTitle" component="h2">
          {create['title']}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {create['hint']}
        </Typography>
        {p.teams.length === 0 ? (
          <EmptyState title={create['noTeams'] ?? ''} />
        ) : (
          <form action={doCreate}>
            <Hidden p={p} />
            <Stack spacing={3}>
              {p.teams.map((team) => (
                <TextField
                  key={team.id}
                  name={`count:${team.id}`}
                  label={fill(create['perTeam'] ?? '', { team: team.name })}
                  type="number"
                  slotProps={{ htmlInput: { min: 0, max: 2000 } }}
                />
              ))}
              <TextField
                name="expiresInDays"
                label={create['expiry']}
                type="number"
                defaultValue={14}
                slotProps={{ htmlInput: { min: 1, max: 90 } }}
              />
              {p.emailDelivery ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    {create['addressesHint']}
                  </Typography>
                  <TextField name="addresses" label={create['addresses']} multiline minRows={3} />
                  <TextField
                    name="addressTeam"
                    label={create['addressTeam']}
                    select
                    slotProps={{ select: { native: true } }}
                  >
                    {p.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </TextField>
                </>
              ) : null}
              {created.code === 'duplicate_batch' ? (
                <label>
                  <input type="checkbox" name="confirmDuplicate" /> {create['duplicateConfirm']}
                </label>
              ) : null}
              <div>
                <Button type="submit" variant="contained">
                  {create['submit']}
                </Button>
              </div>
              <Result state={created} copy={p.copy} />
            </Stack>
          </form>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} component="section">
        <Typography variant="sectionTitle" component="h2">
          {teamsCopy['title']}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p">
          {fill(teamsCopy['fewerThanHint'] ?? '', { n: p.minGroup })}
        </Typography>
        {p.progress.length === 0 ? (
          <EmptyState title={teamsCopy['empty'] ?? ''} />
        ) : (
          <Stack component="ul" spacing={3} sx={{ p: 0, m: 0, mt: 2, listStyle: 'none' }}>
            {p.progress.map((r) => (
              <li key={r.teamId}>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography>{r.teamName}</Typography>
                  <Typography color="text.secondary">
                    {r.suppressed
                      ? p.fewer
                      : `${r.completed}/${r.invited} · ${r.completionRate}%${r.lastActivityOn ? ` · ${r.lastActivityOn}` : ''}`}
                  </Typography>
                </Stack>
                {r.suppressed ? null : (
                  <LinearProgress
                    variant="determinate"
                    value={r.completionRate}
                    aria-label={r.teamName}
                  />
                )}
              </li>
            ))}
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} component="section">
        <Typography variant="sectionTitle" component="h2">
          {exp['title']}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {exp['hint']}
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            href={`/admin/invitations/export?${query}`}
            startIcon={<AppIcon name="download" />}
          >
            {exp['csv']}
          </Button>
          <Button variant="outlined" href={`/admin/invitations/sheet?${query}`} target="_blank">
            {exp['sheet']}
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} component="section">
        <Typography variant="sectionTitle" component="h2">
          {rem['title']}
        </Typography>
        <Typography sx={{ mb: 2 }}>
          {p.dueCount > 0 ? fill(rem['due'] ?? '', { n: p.dueCount }) : rem['none']}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {p.emailDelivery ? rem['hintEmail'] : rem['hintList']}
        </Typography>
        {p.dueCount > 0 && !p.emailDelivery ? (
          <form action={doRemind}>
            <Hidden p={p} />
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" href={`/admin/invitations/export?${query}&kind=reminders`}>
                {rem['csv']}
              </Button>
              <Button type="submit" variant="outlined">
                {rem['markResent']}
              </Button>
            </Stack>
          </form>
        ) : null}
        <Result state={reminded} copy={p.copy} />
      </Paper>

      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} component="section">
        <Typography variant="sectionTitle" component="h2">
          {manage['title']}
        </Typography>
        {p.open.length === 0 ? (
          <EmptyState title={manage['empty'] ?? ''} />
        ) : (
          <Box component="ul" sx={{ p: 0, m: 0 }}>
            {p.open.map((row) => (
              <OpenRow key={row.id} p={p} row={row} />
            ))}
          </Box>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} component="section">
        <Typography variant="sectionTitle" component="h2">
          {sub(p.copy, 'batches')['title']}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {sub(p.copy, 'batches')['hint']}
        </Typography>
        {p.batches.length === 0 ? (
          <EmptyState title={sub(p.copy, 'batches')['empty'] ?? ''} />
        ) : (
          <Box component="ul" sx={{ p: 0, m: 0 }}>
            {p.batches.map((row) => (
              <BatchRow key={row.batchId} p={p} row={row} />
            ))}
          </Box>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} component="section">
        <Typography variant="sectionTitle" component="h2">
          {settings['title']}
        </Typography>
        <form action={doSave}>
          <Hidden p={p} />
          <Stack spacing={3}>
            <label>
              <input type="checkbox" name="emailDelivery" defaultChecked={p.emailDelivery} />{' '}
              {settings['emailDelivery']}
              <Typography variant="caption" color="text.secondary" component="p">
                {settings['emailHint']}
              </Typography>
            </label>
            <TextField
              name="reminderDays"
              label={settings['reminderDays']}
              defaultValue={p.reminderDays}
            />
            <div>
              <Button type="submit" variant="outlined">
                {settings['save']}
              </Button>
            </div>
            <Result state={saved} copy={p.copy} />
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
