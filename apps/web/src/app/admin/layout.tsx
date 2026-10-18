import { Suspense, type ReactNode } from 'react';
import AdminTabs from '@/components/admin/AdminTabs';

/** Every admin page opens with the section tabs, so the user always knows where they are (§11). */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <AdminTabs />
      </Suspense>
      {children}
    </>
  );
}
