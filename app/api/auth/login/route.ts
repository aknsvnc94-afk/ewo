import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSessionCookieValue, SESSION_COOKIE_NAME } from '@/lib/session';

const MAKS_DENEME = 5;
const KILIT_SURESI_DK = 15;

export async function POST(req: NextRequest) {
  const { kullanici_adi, pin } = await req.json();

  if (!kullanici_adi || !pin) {
    return NextResponse.json({ error: 'Kullanıcı adı ve PIN gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const normalizeKullaniciAdi = kullanici_adi.toString().trim().toLowerCase();

  // Hesabın kilitli olup olmadığını kontrol et
  const { data: mevcutPersonel } = await supabase
    .from('personel')
    .select('id, basarisiz_giris_sayisi, kilit_bitis, aktif')
    .eq('kullanici_adi', normalizeKullaniciAdi)
    .maybeSingle();

  if (mevcutPersonel?.kilit_bitis && new Date(mevcutPersonel.kilit_bitis) > new Date()) {
    const kalanDk = Math.ceil((new Date(mevcutPersonel.kilit_bitis).getTime() - Date.now()) / 60000);
    return NextResponse.json({
      error: `Çok fazla başarısız deneme nedeniyle hesap geçici olarak kilitlendi. Lütfen ${kalanDk} dakika sonra tekrar deneyin.`,
    }, { status: 429 });
  }

  const { data, error } = await supabase.rpc('personel_giris', {
    p_kullanici_adi: kullanici_adi,
    p_pin: pin,
  });

  const basarili = !error && data && data.length > 0;

  if (!basarili) {
    // Başarısız deneme sayacını artır (kullanıcı sistemde varsa)
    if (mevcutPersonel) {
      const yeniSayac = (mevcutPersonel.basarisiz_giris_sayisi || 0) + 1;
      const updatePayload: Record<string, any> = { basarisiz_giris_sayisi: yeniSayac };
      if (yeniSayac >= MAKS_DENEME) {
        updatePayload.kilit_bitis = new Date(Date.now() + KILIT_SURESI_DK * 60000).toISOString();
      }
      await supabase.from('personel').update(updatePayload).eq('id', mevcutPersonel.id);
    }
    return NextResponse.json({ error: 'Kullanıcı adı veya PIN hatalı' }, { status: 401 });
  }

  // Başarılı giriş: sayacı sıfırla
  const user = data[0];
  await supabase.from('personel').update({ basarisiz_giris_sayisi: 0, kilit_bitis: null }).eq('id', user.id);

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
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' });
  return res;
}
