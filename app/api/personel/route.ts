import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

function yetkiliMi(rol: string | undefined) {
  return rol === 'admin' || rol === 'superadmin';
}

export async function GET() {
  const session = readSession();
  if (!session || !yetkiliMi(session.rol)) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  const supabase = supabaseAdmin();

  let query = supabase
    .from('personel')
    .select('id, ad_soyad, kullanici_adi, rol, aktif, fabrika_id, fabrika:fabrika_id ( ad )')
    .order('ad_soyad');

  if (session.rol === 'admin') {
    query = query.eq('fabrika_id', session.fabrikaId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ personel: data });
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || !yetkiliMi(session.rol)) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }

  const { ad_soyad, kullanici_adi, sifre, rol, fabrika_id } = await req.json();
  if (!ad_soyad || !kullanici_adi || !sifre) {
    return NextResponse.json({ error: 'Ad soyad, kullanıcı adı ve şifre gerekli' }, { status: 400 });
  }
  if (sifre.length < 4) {
    return NextResponse.json({ error: 'Şifre en az 4 karakter olmalı' }, { status: 400 });
  }

  let hedefFabrikaId: string | null;
  let hedefRol: string;

  if (session.rol === 'superadmin') {
    hedefRol = rol === 'superadmin' || rol === 'admin' ? rol : 'personel';
    if (hedefRol === 'superadmin') {
      hedefFabrikaId = null;
    } else {
      if (!fabrika_id) {
        return NextResponse.json({ error: 'Fabrika seçimi gerekli' }, { status: 400 });
      }
      hedefFabrikaId = fabrika_id;
    }
  } else {
    // admin: her zaman kendi fabrikasına, sadece admin/personel rolüyle ekleyebilir
    hedefRol = rol === 'admin' ? 'admin' : 'personel';
    hedefFabrikaId = session.fabrikaId;
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.rpc('personel_ekle', {
    p_ad_soyad: ad_soyad,
    p_kullanici_adi: kullanici_adi,
    p_sifre: sifre,
    p_rol: hedefRol,
    p_fabrika_id: hedefFabrikaId,
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
  if (!session || !yetkiliMi(session.rol)) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  const { id, aktif, ad_soyad, kullanici_adi, rol, yeni_sifre } = await req.json();
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  const supabase = supabaseAdmin();

  if (session.rol === 'admin') {
    const { data: hedef } = await supabase.from('personel').select('fabrika_id').eq('id', id).single();
    if (!hedef || hedef.fabrika_id !== session.fabrikaId) {
      return NextResponse.json({ error: 'Bu personel size ait değil' }, { status: 403 });
    }
  }

  const updatePayload: Record<string, any> = {};
  if (typeof aktif === 'boolean') updatePayload.aktif = aktif;
  if (ad_soyad) updatePayload.ad_soyad = ad_soyad;
  if (kullanici_adi) updatePayload.kullanici_adi = kullanici_adi.toLowerCase().trim();
  if (rol === 'admin' || rol === 'personel' || (rol === 'superadmin' && session.rol === 'superadmin')) {
    updatePayload.rol = rol;
  }

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
  if (!session || !yetkiliMi(session.rol)) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });
  if (id === session.id) {
    return NextResponse.json({ error: 'Kendi hesabınızı silemezsiniz' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  if (session.rol === 'admin') {
    const { data: hedef } = await supabase.from('personel').select('fabrika_id').eq('id', id).single();
    if (!hedef || hedef.fabrika_id !== session.fabrikaId) {
      return NextResponse.json({ error: 'Bu personel size ait değil' }, { status: 403 });
    }
  }

  const { error } = await supabase.from('personel').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
