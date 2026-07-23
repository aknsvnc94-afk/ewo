import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET() {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('personel')
    .select('id, ad_soyad, kullanici_adi, rol, aktif')
    .order('ad_soyad');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ personel: data });
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }

  const { ad_soyad, kullanici_adi, sifre, rol } = await req.json();
  if (!ad_soyad || !kullanici_adi || !sifre) {
    return NextResponse.json({ error: 'Ad soyad, kullanıcı adı ve şifre gerekli' }, { status: 400 });
  }
  if (sifre.length < 4) {
    return NextResponse.json({ error: 'Şifre en az 4 karakter olmalı' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.rpc('personel_ekle', {
    p_ad_soyad: ad_soyad,
    p_kullanici_adi: kullanici_adi,
    p_sifre: sifre,
    p_rol: rol === 'admin' ? 'admin' : 'personel',
  });

  if (error) {
    const mesaj = error.message.includes('duplicate') || error.message.includes('unique')
      ? 'Bu kullanıcı adı zaten kullanılıyor'
      : error.message;
    return NextResponse.json({ error: mesaj }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: data?.[0]?.id });
}

// Ad soyad / kullanıcı adı / aktiflik günceller. Şifre değişimi ayrı RPC ile (crypt gerektiği için).
export async function PATCH(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  const { id, aktif, ad_soyad, kullanici_adi, rol, yeni_sifre } = await req.json();
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  const supabase = supabaseAdmin();

  const updatePayload: Record<string, any> = {};
  if (typeof aktif === 'boolean') updatePayload.aktif = aktif;
  if (ad_soyad) updatePayload.ad_soyad = ad_soyad;
  if (kullanici_adi) updatePayload.kullanici_adi = kullanici_adi.toLowerCase().trim();
  if (rol === 'admin' || rol === 'personel') updatePayload.rol = rol;

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase.from('personel').update(updatePayload).eq('id', id);
    if (error) {
      const mesaj = error.message.includes('duplicate') || error.message.includes('unique')
        ? 'Bu kullanıcı adı zaten kullanılıyor'
        : error.message;
      return NextResponse.json({ error: mesaj }, { status: 400 });
    }
  }

  if (yeni_sifre) {
    if (yeni_sifre.length < 4) {
      return NextResponse.json({ error: 'Şifre en az 4 karakter olmalı' }, { status: 400 });
    }
    const { error } = await supabase.rpc('personel_sifre_guncelle', { p_id: id, p_sifre: yeni_sifre });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });
  if (id === session.id) {
    return NextResponse.json({ error: 'Kendi hesabınızı silemezsiniz' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from('personel').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
