import { describe, expect, it } from 'vitest'
import { pages, resolveSiteOrigin, seoHead, sitemap } from '../../build/seo'

describe('public search metadata', () => {
  it('uses the confirmed production origin and rejects unsafe canonical settings', () => {
    expect(resolveSiteOrigin({})).toBe('https://balance-plan.vercel.app')
    expect(resolveSiteOrigin({ SITE_URL: 'https://ledger.example/' })).toBe('https://ledger.example')
    for (const value of ['http://ledger.example', 'https://ledger.example/private', 'https://user:pass@ledger.example', 'https://ledger.example/?token=private']) {
      expect(() => resolveSiteOrigin({ SITE_URL: value })).toThrow()
    }
  })

  it.each(pages)('publishes one matching canonical, title and parseable structured data for $path', (page) => {
    const origin = 'https://balance-plan.vercel.app'
    const document = new DOMParser().parseFromString(`<html><head>${seoHead(page, origin, true)}</head><body></body></html>`, 'text/html')
    expect(document.title).toBe(page.title)
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(origin + page.path)
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(origin + page.path)
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(origin + '/pwa-512x512.png')
    const data = JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!)
    expect(data['@graph'].find((node: Record<string, unknown>) => node['@type'] === 'WebPage').url).toBe(origin + page.path)
    expect(JSON.stringify(data)).not.toContain('aggregateRating')
    expect(JSON.stringify(data)).not.toContain('review')
  })

  it('keeps preview pages out of the index and safely escapes verification markup', () => {
    const document = new DOMParser().parseFromString(`<html><head>${seoHead(pages[0], 'https://balance-plan.vercel.app', false, '"><script>bad()</script>')}</head></html>`, 'text/html')
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow')
    expect(document.querySelectorAll('script')).toHaveLength(1)
    expect(document.querySelector('meta[name="google-site-verification"]')?.getAttribute('content')).toBe('"><script>bad()</script>')
  })

  it('lists only public canonical pages in a valid sitemap', () => {
    const document = new DOMParser().parseFromString(sitemap('https://balance-plan.vercel.app'), 'text/xml')
    expect(document.querySelector('parsererror')).toBeNull()
    expect([...document.querySelectorAll('loc')].map(node => node.textContent)).toEqual([
      'https://balance-plan.vercel.app/', 'https://balance-plan.vercel.app/about/', 'https://balance-plan.vercel.app/guide/',
    ])
  })
})
