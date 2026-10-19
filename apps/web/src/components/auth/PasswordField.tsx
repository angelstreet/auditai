'use client';

import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { AppIcon } from '@evolai/ui';

/** Password input with the show/hide eye (docs/UI_RULES.md §3); shared by the sign-in family. */
export default function PasswordField({
  show,
  hide,
  ...rest
}: { show: string; hide: string } & TextFieldProps) {
  const [visible, setVisible] = useState(false);
  const eye = visible ? hide : show;
  return (
    <TextField
      {...rest}
      type={visible ? 'text' : 'password'}
      fullWidth
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
  );
}
