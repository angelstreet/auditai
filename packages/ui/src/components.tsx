'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { AppIcon, type IconName } from './icons.js';

/**
 * Shared components (docs/UI_RULES.md §0, §4, §5): pages compose these and the theme, never
 * one-off styles.
 */

export type Status = 'success' | 'error' | 'warning' | 'info' | 'running' | 'pending';

const STATUS_COLOUR: Record<Status, string> = {
  success: 'success.main',
  error: 'error.main',
  warning: 'warning.main',
  info: 'info.main',
  running: 'text.secondary',
  pending: 'text.secondary',
};

/** Status as icon plus word, never a bare coloured chip (§4). */
export function StatusText({ status, children }: { status: Status; children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, color: STATUS_COLOUR[status] }}
    >
      <AppIcon name={status} size={16} />
      <Box component="span" sx={{ color: 'text.primary' }}>
        {children}
      </Box>
    </Box>
  );
}

/** Page title with an optional one-line subtitle and right-aligned actions (§5, §13). */
export function PageTitle({
  title,
  subtitle,
  actions,
  id,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={3}
      sx={{ alignItems: { sm: 'flex-end' }, justifyContent: 'space-between', mb: 6 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography id={id} variant="pageTitle" component="h1" sx={{ maxWidth: '24ch', m: 0 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: '60ch' }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {actions ? (
        <Stack direction="row" spacing={2}>
          {actions}
        </Stack>
      ) : null}
    </Stack>
  );
}

/** A square tinted icon tile: the lead of a benefit or step card (§13). */
export function IconTile({ name }: { name: IconName }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: 44,
        height: 44,
        flex: 'none',
        borderRadius: 2.5,
        display: 'grid',
        placeItems: 'center',
        color: 'app.accentInk',
        bgcolor: 'app.raised',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <AppIcon name={name} size={24} />
    </Box>
  );
}

/** Key numbers as tiles (§5). Values use tabular numbers so they never shift (§6). */
export function StatTiles({
  items,
}: {
  items: ReadonlyArray<{ label: ReactNode; value: ReactNode; hint?: ReactNode }>;
}) {
  return (
    <Box
      component="dl"
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        m: 0,
        mb: 6,
      }}
    >
      {items.map((item, i) => (
        <Paper key={i} variant="outlined" sx={{ p: 4, borderRadius: 3 }}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {item.label}
          </Typography>
          <Typography
            component="dd"
            variant="sectionTitle"
            sx={{ m: 0, mt: 1, fontVariantNumeric: 'tabular-nums', display: 'block' }}
          >
            {item.value}
          </Typography>
          {item.hint ? (
            <Typography variant="caption" color="text.secondary">
              {item.hint}
            </Typography>
          ) : null}
        </Paper>
      ))}
    </Box>
  );
}

/** One label/control row in a settings list. */
export function SettingRow({
  label,
  description,
  control,
}: {
  label: ReactNode;
  description?: ReactNode;
  control: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      spacing={4}
      sx={{
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 3,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="cardTitle" component="p" sx={{ m: 0 }}>
          {label}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ m: 0 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {control}
    </Stack>
  );
}

/** Empty state: an icon, one line saying what to do next, an optional action (§4). */
export function EmptyState({
  icon = 'info',
  title,
  action,
}: {
  icon?: IconName;
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 6, borderRadius: 3, textAlign: 'center', color: 'text.secondary' }}
    >
      <AppIcon name={icon} size={24} />
      <Typography variant="body1" sx={{ mt: 2, mb: action ? 4 : 0 }}>
        {title}
      </Typography>
      {action}
    </Paper>
  );
}

/** Two to four mutually exclusive options that keep their size when toggled (§3). */
export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      aria-label={label}
      onChange={(_, next: T | null) => {
        if (next) onChange(next);
      }}
    >
      {options.map((o) => (
        <ToggleButton key={o.value} value={o.value} sx={{ minWidth: 96 }}>
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/** Confirm dialog: the only place a filled danger button appears (§3). */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  confirmDisabled = false,
  children,
  onConfirm,
  onClose,
}: {
  open: boolean;
  /** Disables the confirm button, e.g. until the person has typed a code. */
  confirmDisabled?: boolean;
  /** Extra content under the body, such as a type-to-confirm field. */
  children?: ReactNode;
  title: ReactNode;
  body: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel: ReactNode;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="confirm-title" maxWidth="xs" fullWidth>
      <DialogTitle id="confirm-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{body}</DialogContentText>
        {children}
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5 }}>
        <Button variant="text" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={danger ? 'error' : 'primary'}
          disabled={confirmDisabled}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const SnackCtx = createContext<(message: ReactNode) => void>(() => undefined);

/** Snackbar helper: `const notify = useNotify(); notify('Saved')` (§4: toasts confirm). */
export function NotifyProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<ReactNode>(null);
  const notify = useCallback((m: ReactNode) => setMessage(m), []);
  return (
    <SnackCtx.Provider value={notify}>
      {children}
      <Snackbar
        open={message !== null}
        autoHideDuration={4000}
        onClose={() => setMessage(null)}
        message={message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </SnackCtx.Provider>
  );
}

export const useNotify = () => useContext(SnackCtx);

/** Skeleton rows the size of the content they replace (§4, §6). */
export function SkeletonRows({ rows = 3, height = 44 }: { rows?: number; height?: number }) {
  return (
    <Stack spacing={2} aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={height} />
      ))}
    </Stack>
  );
}
