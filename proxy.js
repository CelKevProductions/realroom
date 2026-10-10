import { NextResponse } from 'next/server';

const LANGUES = ['fr', 'en'];

// adresses sans langue (« / », « /app »…) -> la langue du navigateur (français par défaut)
export function proxy(request) {
  const { pathname } = request.nextUrl;
  if (LANGUES.some(l => pathname === '/' + l || pathname.startsWith('/' + l + '/'))) return;
  const choix = request.cookies.get('rr_langue')?.value;
  const accepte = (request.headers.get('accept-language') || '').toLowerCase();
  const langue = LANGUES.includes(choix) ? choix : /^en|,\s*en/.test(accepte) && !/^fr/.test(accepte) ? 'en' : 'fr';
  const url = request.nextUrl.clone();
  url.pathname = '/' + langue + (pathname === '/' ? '' : pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg|sitemap.xml|robots.txt|catalogue.json|styles-visuels.json|images|opengraph-image).*)']
};
