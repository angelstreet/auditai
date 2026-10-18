import type { MetadataRoute } from 'next';

/** Keep the auditor surface out of search indexes (TASK-K); the headers in next.config say the same. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/login', '/board', '/api'] }],
  };
}
