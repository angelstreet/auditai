'use client';

import { useState, type MouseEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { AppIcon, EmptyState, SegmentedToggle } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { useLinkActions } from '@/components/LinkActions';
import { mailtoHref, whatsappHref, withLink } from '@/lib/referentView';

type Lang = 'fr' | 'en';

export interface PreparedMessage {
  readonly subject: string;
  readonly text: string;
}

/**
 * The referent's links and the ready-made message (TASK-S, ADR 0039). Every link of the team, in
 * creation order, with no status: the list looks the same before and after anyone answers. Sharing
 * is copy, `mailto:` and `wa.me` with prepared text: no address or number is asked or stored.
 */
export default function ShareLinks({
  links,
  messages,
  defaultLang,
}: {
  links: readonly string[];
  messages: Readonly<Record<Lang, PreparedMessage>>;
  defaultLang: Lang;
}) {
  const { t } = useI18n();
  const actions = useLinkActions();
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [text, setText] = useState<Record<Lang, string>>({
    fr: messages.fr.text,
    en: messages.en.text,
  });
  const [menu, setMenu] = useState<{ anchor: HTMLElement; index: number } | null>(null);
  const subject = messages[lang].subject;
  const message = text[lang];

  const copy = actions.copy;
  const openMenu = (e: MouseEvent<HTMLElement>, index: number) =>
    setMenu({ anchor: e.currentTarget, index });
  const current = menu ? links[menu.index] : undefined;
  const full = current ? withLink(message, current) : '';

  return (
    <Stack spacing={4}>
      <Paper
        id="links"
        variant="outlined"
        sx={{ p: 4, borderRadius: 3, scrollMarginTop: 96 }}
        data-testid="client-links"
      >
        <Typography variant="sectionTitle" component="h2" sx={{ m: 0 }}>
          {t('client.invitations.linksTitle')}
        </Typography>
        {links.length === 0 ? (
          <Box sx={{ mt: 3 }}>
            <EmptyState icon="invite" title={t('client.invitations.linksEmpty')} />
          </Box>
        ) : (
          <>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 0 }}>
              {t('client.invitations.linksCount', { count: links.length })}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 4 }}>
              {t('client.invitations.linksPrivacy')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 4 }}>
              <Button
                variant="outlined"
                onClick={() =>
                  copy(links.join('\n'), t('client.invitations.copiedAll', { count: links.length }))
                }
                startIcon={<AppIcon name="copy" size={16} />}
                data-testid="client-copy-all"
                sx={{ minHeight: 44 }}
              >
                {t('client.invitations.copyAll')}
              </Button>
              <Button
                variant="outlined"
                href="/client/invitations/export"
                title={t('client.invitations.downloadAria')}
                startIcon={<AppIcon name="download" size={16} />}
                data-testid="client-download"
                sx={{ minHeight: 44 }}
              >
                {t('client.invitations.download')}
              </Button>
              <Button
                variant="outlined"
                href="/client/invitations/sheet"
                title={t('client.invitations.sheetAria')}
                startIcon={<AppIcon name="qrCode" size={16} />}
                sx={{ minHeight: 44 }}
              >
                {t('client.invitations.sheet')}
              </Button>
            </Stack>
            <Box
              component="ol"
              aria-label={t('client.invitations.linksTitle')}
              sx={{
                listStyle: 'none',
                p: 0,
                m: 0,
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                maxHeight: 480,
                overflowY: 'auto',
              }}
            >
              {links.map((link, i) => (
                <Box
                  component="li"
                  key={link}
                  data-testid="client-link-row"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: 3,
                    py: 1,
                    minHeight: 52,
                    borderTop: i === 0 ? 0 : 1,
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ m: 0, flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {t('client.invitations.linkLabel', { n: i + 1 })}
                  </Typography>
                  <Typography
                    variant="body1"
                    title={link}
                    data-testid="client-link"
                    sx={{ m: 0, flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere' }}
                  >
                    {link}
                  </Typography>
                  <Tooltip title={t('client.invitations.copy', { n: i + 1 })}>
                    <IconButton
                      aria-label={t('client.invitations.copy', { n: i + 1 })}
                      onClick={() => copy(link, t('client.invitations.copied'))}
                      data-testid="client-copy-link"
                      sx={{ width: 44, height: 44 }}
                    >
                      <AppIcon name="copy" />
                    </IconButton>
                  </Tooltip>
                  {actions.canShare ? (
                    <Tooltip title={t('client.invitations.share', { n: i + 1 })}>
                      <IconButton
                        aria-label={t('client.invitations.share', { n: i + 1 })}
                        onClick={() => void actions.share(withLink(message, link))}
                        data-testid="client-share-link"
                        sx={{ width: 44, height: 44 }}
                      >
                        <AppIcon name="share" />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                  <Tooltip title={t('client.invitations.more', { n: i + 1 })}>
                    <IconButton
                      aria-label={t('client.invitations.more', { n: i + 1 })}
                      aria-haspopup="menu"
                      onClick={(e) => openMenu(e, i)}
                      data-testid="client-link-more"
                      sx={{ width: 44, height: 44 }}
                    >
                      <AppIcon name="more" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Box>
            <Menu
              anchorEl={menu?.anchor ?? null}
              open={menu !== null}
              onClose={() => setMenu(null)}
              data-testid="client-link-menu"
            >
              <MenuItem
                onClick={() => {
                  setMenu(null);
                  void copy(full, t('client.invitations.copied'));
                }}
              >
                <ListItemIcon>
                  <AppIcon name="copy" />
                </ListItemIcon>
                <ListItemText>{t('client.invitations.copyWithMessage')}</ListItemText>
              </MenuItem>
              <MenuItem
                component="a"
                href={mailtoHref(subject, full)}
                onClick={() => setMenu(null)}
                data-testid="client-share-email"
              >
                <ListItemIcon>
                  <AppIcon name="email" />
                </ListItemIcon>
                <ListItemText>{t('client.invitations.email')}</ListItemText>
              </MenuItem>
              <MenuItem
                component="a"
                href={whatsappHref(full)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenu(null)}
                data-testid="client-share-whatsapp"
              >
                <ListItemIcon>
                  <AppIcon name="whatsapp" />
                </ListItemIcon>
                <ListItemText>{t('client.invitations.whatsapp')}</ListItemText>
              </MenuItem>
            </Menu>
            {actions.dialog}
          </>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }} data-testid="client-message">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 3 }}
        >
          <Typography variant="sectionTitle" component="h2" sx={{ m: 0 }}>
            {t('client.invitations.messageTitle')}
          </Typography>
          <SegmentedToggle<Lang>
            value={lang}
            onChange={setLang}
            label={t('client.invitations.messageLanguage')}
            options={[
              { value: 'fr', label: 'Français' },
              { value: 'en', label: 'English' },
            ]}
          />
        </Stack>
        <TextField
          multiline
          fullWidth
          minRows={8}
          label={t('client.invitations.messageLabel')}
          helperText={t('client.invitations.messageHint')}
          value={message}
          onChange={(e) => setText((prev) => ({ ...prev, [lang]: e.target.value }))}
          slotProps={{ htmlInput: { lang, 'data-testid': 'client-message-text' } }}
        />
      </Paper>
    </Stack>
  );
}
