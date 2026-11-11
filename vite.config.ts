import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** Accepts only a well-formed http(s) URL and strips any trailing slash. */
function normalizeSiteUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return (url.origin + url.pathname).replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/**
 * Social scrapers need absolute URLs, and a static build cannot know where it
 * will be hosted. Absolute canonical / preview-image tags are therefore only
 * written when the owner sets VITE_SITE_URL; otherwise they are left out
 * rather than pointing at a made-up domain.
 */
function siteMetadata(siteUrl: string | null, hasSocialImage: boolean): Plugin {
  return {
    name: 'living-letter:site-metadata',
    transformIndexHtml() {
      const tags: HtmlTagDescriptor[] = [];
      const meta = (attrs: Record<string, string>) => tags.push({ tag: 'meta', attrs, injectTo: 'head' });

      if (siteUrl) {
        tags.push({ tag: 'link', attrs: { rel: 'canonical', href: `${siteUrl}/` }, injectTo: 'head' });
        meta({ property: 'og:url', content: `${siteUrl}/` });
      }
      if (siteUrl && hasSocialImage) {
        meta({ property: 'og:image', content: `${siteUrl}/og.jpg` });
        meta({ property: 'og:image:type', content: 'image/jpeg' });
        meta({ property: 'og:image:width', content: '1200' });
        meta({ property: 'og:image:height', content: '630' });
        meta({ property: 'og:image:alt', content: 'The Living Letter — a message glowing inside a generative night sky.' });
        meta({ name: 'twitter:card', content: 'summary_large_image' });
        meta({ name: 'twitter:image', content: `${siteUrl}/og.jpg` });
      } else {
        meta({ name: 'twitter:card', content: 'summary' });
      }
      return tags;
    },
  };
}

/**
 * A Content-Security-Policy for the built site. Everything the app needs is
 * same-origin (plus data:/blob: images it creates itself), so nothing else is
 * allowed to load or run. This is defence in depth: letter text is only ever
 * rendered as text, and this makes sure that stays true even if a bug slips in.
 *
 * It is applied to builds only, because the dev server relies on inline scripts.
 * If you later add a third-party script (analytics, an ad network), this is the
 * list you will need to extend.
 */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'living-letter:csp',
    apply: 'build',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL);
  const hasSocialImage = existsSync(resolve(process.cwd(), 'public/og.jpg'));

  return {
    // Relative asset paths: the build works at a domain root or under any sub-path.
    base: './',
    plugins: [react(), siteMetadata(siteUrl, hasSocialImage), contentSecurityPolicy()],
    // No assets inlined as data: URIs — every font stays a same-origin file, which keeps the CSP strict.
    build: { sourcemap: false, assetsInlineLimit: 0 },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
