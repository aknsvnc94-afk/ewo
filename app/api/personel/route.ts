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

export async function PATCH(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  const { id, aktif } = await req.json();
  if (!id || typeof aktif !== 'boolean') {
    return NextResponse.json({ error: 'id ve aktif gerekli' }, { status: 400 });
  }
  const supabase = supabaseAdmin();
  const { error } = await supabase.from('personel').update({ aktif }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

