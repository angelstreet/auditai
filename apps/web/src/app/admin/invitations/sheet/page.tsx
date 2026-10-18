import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { messages } from '@evolai/i18n';
import { getSession, sessionTenantIds } from '@/lib/authServer';
import { getLocale } from '@/lib/i18n';
import { withAudit } from '@/lib/invitationData';
import { isUuid } from '@/lib/invitationForm';
import { resolveBaseUrl } from '@/lib/invitationTracking';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

/** Printable sheet: one QR card per open link, team name only. Audited like the CSV export. */
export default async function QrSheetPage({
  searchParams,
}: {
  searchParams: { tenant?: string; engagement?: string };
}) {
  const session = await getSession();
  const tenantId = searchParams.tenant ?? '';
  const engagementId = searchParams.engagement ?? '';
  const allowed = await sessionTenantIds();
  if (
    !session ||
    !isUuid(tenantId) ||
    !isUuid(engagementId) ||
    !allowed.some((t) => t === tenantId)
  ) {
    notFound();
  }
  const copy = messages[getLocale()].admin.invitations.sheet;
  const h = headers();
  const baseUrl = resolveBaseUrl(
    process.env,
    h.get('x-forwarded-host') ?? h.get('host'),
    h.get('x-forwarded-proto'),
  );
  const rows = await withAudit(tenantId, engagementId, session.sub, 'all', baseUrl);
  const cards = await Promise.all(
    rows.map(async (r) => ({
      team: r.teamName,
      svg: await QRCode.toDataURL(r.link, { margin: 1, width: 220 }),
    })),
  );
  return (
    <section className="wide admin" aria-labelledby="sheet-title">
      <h1 id="sheet-title">{copy.title}</h1>
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
