'use client';

import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { AppIcon } from '@evolai/ui';

/** Small "?" help: the detail lives in a tooltip (hover, focus or tap) instead of in the page text. */
export default function HelpTip({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip title={text} enterTouchDelay={0} leaveTouchDelay={6000}>
      <IconButton size="small" aria-label={label} aria-description={text} sx={{ ml: 1 }}>
        <AppIcon name="info" size={16} />
      </IconButton>
    </Tooltip>
  );
}
