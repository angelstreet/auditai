import type { Translator } from '@evolai/i18n';

/** Plain role word for a view-as persona ("referent"), in the current language. */
export const viewAsRoleLabel = (t: Translator, role: string): string =>
  role === 'team_referent' ? t('client.viewAs.roles.team_referent') : role;
