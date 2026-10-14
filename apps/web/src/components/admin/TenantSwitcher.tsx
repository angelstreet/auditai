import Link from 'next/link';
import { listTenantIds, tenantLabel } from '@/lib/adminData';

interface Props {
  currentTenantId: string;
}

/**
 * Tenant switcher rendered above the engagements table. The labels are loaded server-side
 * from the tenants table so they always reflect the current data.
 */
export default async function TenantSwitcher({ currentTenantId }: Props) {
  const tenantIds = await listTenantIds();
  const labels = await Promise.all(
    tenantIds.map(async (id) => ({ id, label: await tenantLabel(id) })),
  );
  return (
    <nav className="admin-tenant-switcher" aria-label="Select tenant">
      <p>
        <strong>Tenant:</strong>
      </p>
      <ul>
        {labels.map(({ id, label }) => (
          <li key={id}>
            <Link
              href={`/admin/engagements?tenant=${encodeURIComponent(id)}`}
              aria-current={id === currentTenantId ? 'page' : undefined}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
