import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

  const supabase = supabaseAdmin();
  let query = supabase
    .from('is_emirleri')
    .select(`
      id, is_emri_no, onarilan_kodu, onarilan_tanimi, problem_tanimi, tarih, tesis_adi,
      durum, yapilan_is, kapatma_tarihi, atanan_personel_id,
      atanan:atanan_personel_id ( ad_soyad ),
      kapatan:kapatan_personel_id ( ad_soyad )
    `)
    .order('tarih', { ascending: false });

  if (session.rol === 'personel') {
    query = query.eq('atanan_personel_id', session.id);
  }

  const durum = req.nextUrl.searchParams.get('durum');
  if (durum) query = query.eq('durum', durum);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ isEmirleri: data });
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }

  const { kayitlar } = await req.json();
  if (!Array.isArray(kayitlar) || kayitlar.length === 0) {
    return NextResponse.json({ error: 'Geçerli kayıt bulunamadı' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const isEmriNolari = kayitlar.map((k) => k.is_emri_no).filter(Boolean);
  const { data: mevcut, error: mevcutErr } = await supabase
    .from('is_emirleri')
    .select('is_emri_no')
    .in('is_emri_no', isEmriNolari);

  if (mevcutErr) return NextResponse.json({ error: mevcutErr.message }, { status: 500 });

  const mevcutSet = new Set((mevcut || []).map((m) => m.is_emri_no));
  const yeniKayitlar = kayitlar
    .filter((k) => k.is_emri_no && !mevcutSet.has(k.is_emri_no))
    .map((k) => ({ ...k, yukleyen_id: session.id }));

  if (yeniKayitlar.length === 0) {
    return NextResponse.json({ eklenen: 0, atlanan_mukerrer: kayitlar.length });
  }

  const { error: insertErr } = await supabase.from('is_emirleri').insert(yeniKayitlar);
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ eklenen: yeniKayitlar.length, atlanan_mukerrer: kayitlar.length - yeniKayitlar.length });
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
  const { error } = await supabase.from('is_emirleri').delete().in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, silinen: ids.length });
}
