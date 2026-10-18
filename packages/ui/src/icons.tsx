import type { SvgIconProps } from '@mui/material/SvgIcon';
import AccountCircleOutlined from '@mui/icons-material/AccountCircleOutlined';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined';
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import BusinessOutlined from '@mui/icons-material/BusinessOutlined';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ChecklistOutlined from '@mui/icons-material/ChecklistOutlined';
import CodeOutlined from '@mui/icons-material/CodeOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined';
import ForumOutlined from '@mui/icons-material/ForumOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import HourglassEmptyOutlined from '@mui/icons-material/HourglassEmptyOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import LanguageOutlined from '@mui/icons-material/LanguageOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import LinkOffOutlined from '@mui/icons-material/LinkOffOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import LoginOutlined from '@mui/icons-material/LoginOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import SyncOutlined from '@mui/icons-material/SyncOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';

/**
 * Icon registry (docs/UI_RULES.md §9): one Outlined icon per meaning. Pages use
 * `<AppIcon name="…" />`; style-guard rejects direct @mui/icons-material imports elsewhere.
 * A new meaning is one new row here.
 */
export const icons = {
  success: CheckCircleOutlined,
  error: ErrorOutlineOutlined,
  warning: WarningAmberOutlined,
  info: InfoOutlined,
  running: SyncOutlined,
  pending: HourglassEmptyOutlined,
  cancelled: CancelOutlined,
  search: SearchOutlined,
  close: CloseOutlined,
  add: AddOutlined,
  delete: DeleteOutlined,
  edit: EditOutlined,
  refresh: RefreshOutlined,
  settings: SettingsOutlined,
  language: LanguageOutlined,
  lock: LockOutlined,
  privacy: ShieldOutlined,
  visibility: VisibilityOutlined,
  visibilityOff: VisibilityOffOutlined,
  themeLight: LightModeOutlined,
  themeDark: DarkModeOutlined,
  account: AccountCircleOutlined,
  organisation: BusinessOutlined,
  signIn: LoginOutlined,
  signOut: LogoutOutlined,
  back: ArrowBackOutlined,
  forward: ArrowForwardOutlined,
  expand: ExpandMoreOutlined,
  menu: MenuOutlined,
  download: DownloadOutlined,
  copy: ContentCopyOutlined,
  linkBroken: LinkOffOutlined,
  time: ScheduleOutlined,
  team: GroupsOutlined,
  listen: ForumOutlined,
  review: ChecklistOutlined,
  act: RocketLaunchOutlined,
  scene: TuneOutlined,
  ai: AutoAwesomeOutlined,
  code: CodeOutlined,
} as const;

export type IconName = keyof typeof icons;

export interface AppIconProps extends Omit<SvgIconProps, 'children'> {
  name: IconName;
  /** 16, 20 (default) or 24 px; 40 only for icon tiles. */
  size?: 16 | 20 | 24 | 40;
}

/** Decorative by default (aria-hidden); pass `titleAccess` when the icon carries meaning alone. */
export function AppIcon({ name, size = 20, sx, ...rest }: AppIconProps) {
  const Icon = icons[name];
  return (
    <Icon
      aria-hidden={rest.titleAccess ? undefined : true}
      sx={[{ fontSize: size }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...rest}
    />
  );
}
