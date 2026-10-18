'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { AppIcon } from '@evolai/ui';

interface Props {
  next: string;
  error: string | null;
  labels: {
    email: string;
    password: string;
    submit: string;
    show: string;
    hide: string;
    signingIn: string;
  };
}

/**
 * Sign-in form (docs/UI_RULES.md §0, §3): labelled fields, a show/hide eye on the password, one
 * primary button with a loading state, the error inline above the fields. A plain POST to
 * /api/auth/login, so it also works before hydration.
 */
export default function LoginForm({ next, error, labels }: Props) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const eye = visible ? labels.hide : labels.show;
  return (
    <Stack
      component="form"
      method="post"
      action="/api/auth/login"
      spacing={5}
      onSubmit={() => setBusy(true)}
      aria-busy={busy}
    >
      <input type="hidden" name="next" value={next} />
      {error ? (
        <Alert severity="error" role="alert" icon={<AppIcon name="error" />}>
          {error}
        </Alert>
      ) : null}
      <TextField
        name="email"
        type="email"
        label={labels.email}
        autoComplete="username"
        required
        fullWidth
        autoFocus
        error={Boolean(error)}
      />
      <TextField
        name="password"
        type={visible ? 'text' : 'password'}
        label={labels.password}
        autoComplete="current-password"
        required
        fullWidth
        error={Boolean(error)}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title={eye}>
                  <IconButton
                    aria-label={eye}
                    aria-pressed={visible}
                    data-testid="password-visibility"
                    onClick={() => setVisible((v) => !v)}
                    edge="end"
                  >
                    <AppIcon name={visible ? 'visibilityOff' : 'visibility'} />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          },
        }}
      />
      <Button
        type="submit"
        variant="contained"
        size="large"
        fullWidth
        loading={busy}
        loadingPosition="start"
        startIcon={<AppIcon name="signIn" />}
      >
        {busy ? labels.signingIn : labels.submit}
      </Button>
    </Stack>
  );
}
