import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSessionCookieValue, SESSION_COOKIE_NAME } from '@/lib/session';

export async function POST(req: NextRequest) {
  const { kullanici_adi, pin } = await req.json();

  if (!kullanici_adi || !pin) {
    return NextResponse.json({ error: 'Kullanıcı adı ve PIN gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.rpc('personel_giris', {
    p_kullanici_adi: kullanici_adi,
    p_pin: pin,
  });

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'Kullanıcı adı veya PIN hatalı' }, { status: 401 });
  }

  const user = data[0];
  const cookieValue = createSessionCookieValue({
    id: user.id,
    ad_soyad: user.ad_soyad,
    rol: user.rol,
  });

  const res = NextResponse.json({ ok: true, ad_soyad: user.ad_soyad, rol: user.rol });
  res.cookies.set(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 gün - telefonda tekrar giriş istemesin
    path: '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' });
  return res;
}
