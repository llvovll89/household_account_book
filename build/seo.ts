import type { Plugin } from 'vite'
import { readFileSync } from 'node:fs'

export const pages = [
  { path: '/', title: '잔고플랜 | 모바일 가계부 · 수입·지출·예산 관리', description: '잔고플랜으로 수입과 지출을 기록하고 월별 예산, 카드 청구, 구독료와 저축 목표를 관리하세요. 모바일 브라우저에서 시작하고 홈 화면에 추가해 사용할 수 있는 가계부입니다.' },
  { path: '/about/', title: '모바일 가계부 잔고플랜 소개 | 예산·카드·구독 관리', description: '수입·지출 기록부터 카테고리별 예산, 카드 청구, 정기 지출과 저축 목표까지. 잔고플랜의 기능과 로그인 전후 데이터 저장 방식을 알아보세요.' },
  { path: '/guide/', title: '가계부 쓰는 법 | 잔고플랜 거래 기록·예산 설정 사용법', description: '잔고플랜으로 첫 수입·지출 기록하기, 오늘·어제 날짜 선택, 연속 입력, 거래 검색, 예산 설정과 모바일 홈 화면 추가 방법을 확인하세요.' },
]

export function resolveSiteOrigin(env: Record<string, string | undefined>): string {
  const value = env.SITE_URL || 'https://balance-plan.vercel.app'
  const url = new URL(value.includes('://') ? value : `https://${value}`)
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_URL must be the HTTPS production origin, without a path, query, or credentials.')
  }
  return url.origin
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export function seoHead(page: typeof pages[number], origin?: string, indexable = false, verification?: string) {
  const url = origin ? `${origin}${page.path}` : undefined
  const image = origin ? `${origin}/pwa-512x512.png` : '/pwa-512x512.png'
  const graph = origin ? [
    { '@type': 'WebSite', '@id': `${origin}/#website`, url: `${origin}/`, name: '잔고플랜', inLanguage: 'ko-KR' },
    { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: page.title, description: page.description, inLanguage: 'ko-KR', isPartOf: { '@id': `${origin}/#website` } },
    { '@type': 'WebApplication', '@id': `${origin}/#app`, name: '잔고플랜', url: `${origin}/`, applicationCategory: 'FinanceApplication', operatingSystem: 'Web', inLanguage: 'ko-KR', browserRequirements: 'Requires JavaScript', description: pages[0].description, image, featureList: ['수입·지출 기록', '카테고리별 예산', '카드 청구 관리', '구독 관리', '저축 목표', '거래 검색 및 내보내기'] },
  ] : []
  return `<title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}">
    <meta name="robots" content="${indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow'}">
    ${url ? `<link rel="canonical" href="${escapeHtml(url)}">` : ''}
    <meta property="og:type" content="website">
    <meta property="og:locale" content="ko_KR">
    <meta property="og:site_name" content="잔고플랜">
    <meta property="og:title" content="${escapeHtml(page.title)}">
    <meta property="og:description" content="${escapeHtml(page.description)}">
    ${url ? `<meta property="og:url" content="${escapeHtml(url)}">` : ''}
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:image:width" content="512"><meta property="og:image:height" content="512">
    <meta property="og:image:type" content="image/png"><meta property="og:image:alt" content="잔고플랜 앱 아이콘">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(page.title)}">
    <meta name="twitter:description" content="${escapeHtml(page.description)}">
    <meta name="twitter:image" content="${escapeHtml(image)}">
    ${verification ? `<meta name="google-site-verification" content="${escapeHtml(verification)}">` : ''}
    ${graph.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c')}</script>` : ''}`
}

export function sitemap(origin: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((page) => `  <url><loc>${escapeHtml(origin + page.path)}</loc></url>`).join('\n')}\n</urlset>\n`
}

export function seoPlugin(env: Record<string, string | undefined>): Plugin {
  const origin = resolveSiteOrigin(env)
  const indexable = env.VERCEL_ENV !== 'preview'
  const head = (page: typeof pages[number]) => seoHead(page, origin, indexable, env.GOOGLE_SITE_VERIFICATION)
  return {
    name: 'ledger-public-seo',
    transformIndexHtml: (html) => html.replace('<!-- SEO_HEAD -->', head(pages[0])),
    generateBundle() {
      for (const page of pages.slice(1)) {
        const body = readFileSync(new URL(`../seo${page.path}index.html`, import.meta.url), 'utf8')
        this.emitFile({ type: 'asset', fileName: `${page.path.slice(1)}index.html`, source: `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">${head(page)}<link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/seo.css"></head><body class="public-page"><a class="public-skip" href="#content">본문으로 이동</a><header class="public-header"><a class="public-brand" href="/about/"><img src="/brand/symbol.svg" width="32" height="32" alt="">잔고플랜</a><nav aria-label="사이트 메뉴"><a href="/about/" ${page.path === '/about/' ? 'aria-current="page"' : ''}>앱 소개</a><a href="/guide/" ${page.path === '/guide/' ? 'aria-current="page"' : ''}>사용법</a><a class="public-action" href="/">가계부 열기</a></nav></header>${body}<footer class="public-footer"><p>잔고플랜 · 매일의 수입과 지출을 기록하는 모바일 가계부</p><nav aria-label="하단 메뉴"><a href="/">가계부 열기</a><a href="/about/">앱 소개</a><a href="/guide/">사용법</a></nav></footer></body></html>` })
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n${indexable && origin ? `\nSitemap: ${origin}/sitemap.xml\n` : ''}` })
      if (origin) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(origin) })
      this.emitFile({ type: 'asset', fileName: '404.html', source: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>페이지를 찾을 수 없어요 | 잔고플랜</title><link rel="stylesheet" href="/seo.css"></head><body class="public-page"><main id="content"><h1>페이지를 찾을 수 없어요</h1><p>주소를 확인하거나 가계부로 돌아가세요.</p><a class="public-action" href="/">가계부 열기</a><p><a href="/guide/">잔고플랜 사용법</a></p></main></body></html>' })
    },
  }
}
