import Link from 'next/link';
import { listTenantIds, tenantLabel } from '@/lib/adminData';

interface Props {
  currentTenantId: string;
}

/**
 * Tenant switcher rendered above the engagements table. We pass `currentTenantId` from the page
 * (URL query parameter) and link to the same route with a different `?tenant=` value. The page
 * itself enforces tenant scoping; this component is purely a navigation helper.
 */
export default function TenantSwitcher({ currentTenantId }: Props) {
  const tenants = listTenantIds();
  return (
    <nav className="admin-tenant-switcher" aria-label="Select tenant">
      <p>
        <strong>Tenant:</strong>
      </p>
      <ul>
        {tenants.map((tenantId) => (
          <li key={tenantId}>
            <Link
              href={`/admin/engagements?tenant=${encodeURIComponent(tenantId)}`}
              aria-current={tenantId === currentTenantId ? 'page' : undefined}
            >
              {tenantLabel(tenantId)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
