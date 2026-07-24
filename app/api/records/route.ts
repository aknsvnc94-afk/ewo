import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

  const supabase = supabaseAdmin();
  let query = supabase
    .from('ariza_kayitlari')
    .select(`
      id, tezgah, vardiya, durus_kodu, durus_adi, baslangic, bitis, sure, sure_sn, aciklama, kalip_kodu,
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
