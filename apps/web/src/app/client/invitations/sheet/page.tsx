import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { messages } from '@evolai/i18n';
import { EmptyState } from '@evolai/ui';
import PrintButton from '@/app/admin/invitations/sheet/PrintButton';
import { requireClientContext } from '@/lib/clientContext';
import { loadClientSurvey } from '@/lib/clientData';
import { getLocale, getT } from '@/lib/i18n';
import { withAudit } from '@/lib/invitationData';
import { resolveBaseUrl } from '@/lib/invitationTracking';

export const dynamic = 'force-dynamic';

/** Printable QR sheet of the referent's open links, team name only (same layout as admin). */
export default async function ClientQrSheet() {
  const { session, ctx } = await requireClientContext();
  const { t } = getT();
  const copy = messages[getLocale()].admin.invitations.sheet;
  const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
  if (!survey) return <EmptyState icon="pending" title={t('client.home.noSurvey')} />;
  const h = headers();
  const baseUrl = resolveBaseUrl(
    process.env,
    h.get('x-forwarded-host') ?? h.get('host'),
    h.get('x-forwarded-proto'),
  );
  const rows = await withAudit(
    ctx.tenantId,
    survey.engagementId,
    session.sub,
    'all',
    baseUrl,
    ctx.teamIds,
  );
  const cards = await Promise.all(
    rows.map(async (r) => ({
      team: r.teamName,
      svg: await QRCode.toDataURL(r.link, { margin: 1, width: 220 }),
    })),
  );
  return (
    <section aria-labelledby="client-sheet-title">
      <h1 id="client-sheet-title">{copy.title}</h1>
      <p className="muted">{copy.cut}</p>
      <PrintButton label={copy.print} />
      <ul
        className="qr-sheet"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
          listStyle: 'none',
          padding: 0,
        }}
      >
        {cards.map((c, i) => (
          <li
            key={i}
            style={{
              border: '1px dashed currentColor',
              padding: 'var(--space-3)',
              textAlign: 'center',
              breakInside: 'avoid',
            }}
          >
            <img src={c.svg} width={220} height={220} alt="" />
            <div>{copy.scan}</div>
            <div className="muted">{c.team}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
