import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';
import crypto from 'crypto';

function makeUniqueKey(row: Record<string, any>): string {
  // Aynı arıza kaydı ERP'den tekrar geldiğinde üzerine yazmamak için
  // tezgah + başlangıç + duruş kodu + iş emri detay kodu birleşimi kullanılır.
  const raw = [
    row.tezgah, row.baslangic, row.durus_kodu, row.is_emri_detay_kodu, row.sure_sn,
  ].map((v) => (v ?? '').toString().trim()).join('|');
  return crypto.createHash('sha1').update(raw).digest('hex');
}

// NOT: Excel dosyası artık TARAYICIDA (client-side) parse ediliyor
// (lib/excelParse.ts), sadece filtrelenmiş küçük JSON kayıt listesi
// buraya gönderiliyor. Bunun nedeni: Vercel serverless fonksiyonlarının
// istek gövdesi boyut sınırı (~4.5MB) — büyük ERP export dosyaları
// (40 bin+ satır) bu sınırı aşıyordu.
export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }

  const body = await req.json();
  const kayitlarHam: Record<string, any>[] = body.kayitlar;
  const toplamSatir: number = body.toplamSatir ?? 0;

  if (!Array.isArray(kayitlarHam) || kayitlarHam.length === 0) {
    return NextResponse.json({ error: 'Geçerli (MA/BA/KA/RA) kategoride arıza kaydı bulunamadı' }, { status: 400 });
  }

  const kayitlar: Record<string, any>[] = kayitlarHam.map((obj) => ({
    ...obj,
    unique_key: makeUniqueKey(obj),
    yukleyen_id: session.id,
  }));

  const supabase = supabaseAdmin();

  const keys = kayitlar.map((k) => k.unique_key);
  const { data: existing, error: existingErr } = await supabase
    .from('ariza_kayitlari')
    .select('unique_key')
    .in('unique_key', keys);

  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }

  const existingSet = new Set((existing || []).map((e) => e.unique_key));
  const yeniKayitlar = kayitlar.filter((k) => !existingSet.has(k.unique_key));

  if (yeniKayitlar.length === 0) {
    return NextResponse.json({
      message: 'Yükleme tamamlandı, ancak tüm kayıtlar zaten sistemde mevcut (mükerrer).',
      toplam_satir: toplamSatir,
      eklenen: 0,
      atlanan_mukerrer: kayitlar.length,
    });
  }

  const { error: insertErr } = await supabase.from('ariza_kayitlari').insert(yeniKayitlar);
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const kategoriSayaci: Record<string, number> = {};
  yeniKayitlar.forEach((k) => {
    kategoriSayaci[k.kategori] = (kategoriSayaci[k.kategori] || 0) + 1;
  });

  return NextResponse.json({
    message: 'Yükleme başarılı',
    toplam_satir: toplamSatir,
    eklenen: yeniKayitlar.length,
    atlanan_mukerrer: kayitlar.length - yeniKayitlar.length,
    kategori_dagilimi: kategoriSayaci,
  });
}
