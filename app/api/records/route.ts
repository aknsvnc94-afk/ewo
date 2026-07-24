import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

  const supabase = supabaseAdmin();
  let query = supabase
    .from('ariza_kayitlari')
    .select(`
      id, sira_no, is_emri_detay_kodu, tezgah, vardiya, durus_kodu, durus_adi, baslangic, bitis, sure, sure_sn, aciklama, kalip_kodu,
      kategori, aksiyon, hedef_tarih, tamamlanma_durumu, kok_neden_turu,
      atanan_personel_id, personel:atanan_personel_id ( ad_soyad )
    `)
    .order('baslangic', { ascending: false })
    .limit(500);

  // Personel sadece kendine atanan kayıtları görür; admin hepsini görür
  if (session.rol === 'personel') {
    query = query.eq('atanan_personel_id', session.id);
  }

  const kategori = req.nextUrl.searchParams.get('kategori');
  if (kategori) query = query.eq('kategori', kategori);

  const durum = req.nextUrl.searchParams.get('durum');
  if (durum) query = query.eq('tamamlanma_durumu', durum);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ kayitlar: data });
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }

  const { tezgah, kategori, durus_adi, aciklama, atanan_personel_id, kalip_kodu } = await req.json();
  if (!tezgah || !kategori || !durus_adi) {
    return NextResponse.json({ error: 'Tezgah, kategori ve duruş adı gerekli' }, { status: 400 });
  }
  if (!['MA', 'BA', 'KA', 'RA'].includes(kategori)) {
    return NextResponse.json({ error: 'Geçersiz kategori' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const simdi = new Date().toISOString();

  const { data, error } = await supabase.from('ariza_kayitlari').insert({
    unique_key: `manuel-${crypto.randomUUID()}`,
    tezgah, kategori, durus_adi,
    aciklama: aciklama || null,
    kalip_kodu: kalip_kodu || null,
    baslangic: simdi,
    sure: 'Manuel kayıt',
    atanan_personel_id: atanan_personel_id || null,
    atama_tarihi: atanan_personel_id ? simdi : null,
    yukleyen_id: session.id,
    tamamlanma_durumu: 'Beklemede',
  }).select('id, sira_no').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, sira_no: data.sira_no });
}

export async function DELETE(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  // aksiyonlar tablosu ariza_kayit_id üzerinden "on delete cascade" olduğu için
  // bağlı aksiyonlar da otomatik silinir.
  const { error } = await supabase.from('ariza_kayitlari').delete().in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, silinen: ids.length });
}
