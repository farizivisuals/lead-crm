/**
 * (client) and (employee) both declare `projects/[projectId]`, so the bare
 * `/projects/[projectId]` is ambiguous — expo-router resolves it to the
 * (employee) copy. A client's root Stack has no (employee) screen (it is
 * behind Stack.Protected), and useLinking.native drops any link whose root
 * route is not mounted, so the tap silently did nothing.
 *
 * This asserts the resolution the app depends on: group-qualified hrefs land
 * in their own group. It fails if a future route change moves either copy.
 */
import { getRoutes } from 'expo-router/build/getRoutes';
import { getNavigationConfig } from 'expo-router/build/getLinkingConfig';
import { getStateFromPath } from 'expo-router/build/fork/getStateFromPath';

// The app has no @types/node, and this is the only test that walks the disk.
declare const __dirname: string;
declare function require(id: string): any;
const fs = require('fs');
const path = require('path');

function routeTree() {
  const appDir = path.join(__dirname, '../../app');
  const keys: string[] = [];
  (function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name))
        keys.push('./' + path.relative(appDir, full).split(path.sep).join('/'));
    }
  })(appDir);
  const ctx: any = () => ({ default: () => null });
  ctx.keys = () => keys;
  return getNavigationConfig(getRoutes(ctx, { platform: 'ios' }) as any, true, {
    sitemap: false,
    notFound: false,
  });
}

/** The route group a path resolves into, e.g. '(client)'. */
function groupFor(config: any, href: string): string | undefined {
  return getStateFromPath(href, config)?.routes?.[0]?.state?.routes?.[0]?.name;
}

describe('project detail hrefs', () => {
  const config = routeTree() as any;

  it('lands a client in the client portal', () => {
    expect(groupFor(config, '/(client)/projects/abc')).toBe('(client)');
  });

  it('lands an employee in the admin stack', () => {
    expect(groupFor(config, '/(employee)/projects/abc')).toBe('(employee)');
  });
});
