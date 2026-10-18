import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { config } from './middleware';

/**
 * Route inventory (TASK-R, ADR 0036). Every page and route handler is either behind the middleware
 * matcher (a session is required) or listed in routeAccess.json with a reason. A new route that is
 * reachable without a session fails here until someone writes down why that is fine.
 */
const APP = path.join(__dirname, 'app');

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );

const routes = walk(APP)
  .filter((f) => /\/(page\.tsx|route\.ts)$/.test(f))
  .map((f) => {
    const dir = path.dirname(path.relative(APP, f));
    return dir === '.' ? '/' : `/${dir}`;
  })
  .sort();

const gated = (route: string): boolean =>
  config.matcher.some((m) => {
    const base = m.replace(/\/:path\*$/, '');
    return route === base || (m.endsWith('/:path*') && route.startsWith(`${base}/`));
  });

const allow = JSON.parse(readFileSync(path.join(__dirname, 'routeAccess.json'), 'utf8')) as {
  routes: Record<string, { access: string; reason: string }>;
};

describe('route inventory', () => {
  it('finds the routes', () => {
    expect(routes).toContain('/intake');
    expect(routes).toContain('/admin/teams');
  });

  it('gates /intake, /board, /admin and /client behind a session', () => {
    for (const r of routes.filter((x) => /^\/(intake|board|admin|client)(\/|$)/.test(x))) {
      expect(gated(r) || r.startsWith('/api/'), r).toBe(true);
    }
  });

  it('lists every route outside the matcher in the allow-list', () => {
    const open = routes.filter((r) => !gated(r));
    expect(open.filter((r) => !(r in allow.routes))).toEqual([]);
  });

  it('has no stale or unexplained allow-list entries', () => {
    for (const [route, v] of Object.entries(allow.routes)) {
      expect(routes, `${route} no longer exists`).toContain(route);
      expect(gated(route), `${route} is gated, drop it from the allow-list`).toBe(false);
      expect(v.reason.trim().length, `${route} needs a reason`).toBeGreaterThan(10);
    }
  });

  it('never lists /intake as open', () => {
    expect(allow.routes['/intake']).toBeUndefined();
  });
});
