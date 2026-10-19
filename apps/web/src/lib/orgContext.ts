import { cookies, headers } from 'next/headers';
import { ORG_COOKIE, ORG_HEADER, ORG_UUID } from './orgShared';

export { ORG_COOKIE, orderTenants } from './orgShared';

/** Preferred organisation id for this request: this request's `?tenant=`, else the cookie. */
export const preferredOrg = (): string | undefined => {
  const fromHeader = headers().get(ORG_HEADER);
  if (fromHeader && ORG_UUID.test(fromHeader)) return fromHeader;
  const fromCookie = cookies().get(ORG_COOKIE)?.value;
  return fromCookie && ORG_UUID.test(fromCookie) ? fromCookie : undefined;
};
