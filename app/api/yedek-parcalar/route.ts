import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

// Sipariş satır metninden okunabilir açıklama çıkarır (diğer sipariş sayfalarıyla aynı desen).
function aciklamaCikar(stokKodu: string | null, satirMetni: string) {
  return stokKodu ? satirMetni.split('—')[1]?.split('|')[0]?.trim() : satirMetni;
}

export async function GET(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const makineId = req.nextUrl.searchParams.get('makine_id');
  if (!makineId) return NextResponse.json({ error: 'makine_id gerekli' }, { status: 400 });

  const supabase = supabaseAdmin();

  const { data: manuelKayitlar, error: manuelErr } = await supabase
    .from('yedek_parcalar')
    .select('id, parca_kodu, parca_tanimi, created_at, ekleyen:ekleyen_personel_id ( ad_soyad )')
    .eq('fabrika_id', session.fabrikaId)
    .eq('makine_id', makineId)
    .order('created_at', { ascending: false });
  if (manuelErr) return NextResponse.json({ error: manuelErr.message }, { status: 500 });

  const { data: siparisKayitlari, error: siparisErr } = await supabase
    .from('siparis_kalemleri')
    .select('id, stok_kodu, satir_metni, siparis:siparis_id ( talep_no, yuklenme_tarihi )')
    .eq('fabrika_id', session.fabrikaId)
    .eq('makine_id', makineId);
  if (siparisErr) return NextResponse.json({ error: siparisErr.message }, { status: 500 });

  const manuel = (manuelKayitlar || []).map((k) => ({
    id: k.id,
    kaynak: 'manuel' as const,
    parca_kodu: k.parca_kodu,
    parca_tanimi: k.parca_tanimi,
    tarih: k.created_at,
    ekleyen: (k.ekleyen as any)?.ad_soyad || null,
  }));

  const siparisten = (siparisKayitlari || []).map((k) => ({
    id: k.id,
    kaynak: 'siparis' as const,
    parca_kodu: k.stok_kodu,
    parca_tanimi: aciklamaCikar(k.stok_kodu, k.satir_metni) || k.satir_metni,
    tarih: (k.siparis as any)?.yuklenme_tarihi || null,
    ekleyen: (k.siparis as any)?.talep_no ? `Talep No: ${(k.siparis as any).talep_no}` : null,
  }));

  const parcalar = [...manuel, ...siparisten].sort((a, b) => {
    if (!a.tarih) return 1;
    if (!b.tarih) return -1;
    return new Date(b.tarih).getTime() - new Date(a.tarih).getTime();
  });

  return NextResponse.json({ parcalar });
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const { makine_id, parca_kodu, parca_tanimi } = await req.json();
  if (!makine_id || !parca_tanimi || !parca_tanimi.toString().trim()) {
    return NextResponse.json({ error: 'makine_id ve parça tanımı gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: makine } = await supabase.from('makineler').select('fabrika_id').eq('id', makine_id).single();
  if (!makine || makine.fabrika_id !== session.fabrikaId) {
    return NextResponse.json({ error: 'Makine bulunamadı' }, { status: 404 });
  }

  const { data, error } = await supabase.from('yedek_parcalar').insert({
    fabrika_id: session.fabrikaId,
    makine_id,
    parca_kodu: parca_kodu || null,
    parca_tanimi: parca_tanimi.toString().trim(),
    ekleyen_personel_id: session.id,
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
