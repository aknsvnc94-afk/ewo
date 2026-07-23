import { NextRequest, NextResponse } from 'next/server';

// Not: middleware Edge runtime'da çalışır, burada sadece cookie varlığını kontrol ediyoruz.
// Rol bazlı asıl yetki kontrolü her API route'ta lib/session.ts ile tekrar yapılıyor.
export function middleware(req: NextRequest) {
  const cookie = req.cookies.get('ewo_session')?.value;
  const { pathname } = req.nextUrl;

  const korumaliYollar = ['/admin', '/personel', '/pdf'];
  const korumaliMi = korumaliYollar.some((p) => pathname.startsWith(p));

  if (korumaliMi && !cookie) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/personel/:path*', '/pdf/:path*'],
};
