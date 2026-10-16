import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';
import crypto from 'crypto';

// Vercel Pro/Enterprise planlarında fonksiyon süresini uzatır (Hobby planda 10sn sabit kalır,
// bu ayar zararsızdır). Büyük dosyalar zaten client tarafında parçalara bölünerek gönderiliyor.
export const maxDuration = 60;

function makeUniqueKey(row: Record<string, any>): string {
  // Aynı arıza kaydı ERP'den tekrar geldiğinde üzerine yazmamak için
  // tezgah + başlangıç + duruş kodu + iş emri detay kodu + süre birleşimi kullanılır.
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
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const body = await req.json();
  const kayitlarHam: Record<string, any>[] = body.kayitlar;
  const toplamSatir: number = body.toplamSatir ?? 0;

  if (!Array.isArray(kayitlarHam) || kayitlarHam.length === 0) {
    return NextResponse.json({ error: 'Geçerli (MA/BA/KA/RA) kategoride arıza kaydı bulunamadı' }, { status: 400 });
  }

  const kayitlar: Record<string, any>[] = kayitlarHam.map((obj) => ({
    ...obj,
    unique_key: makeUniqueKey(obj),
    fabrika_id: session.fabrikaId,
    yukleyen_id: session.id,
  }));

  // 1) Dosya İÇİNDEKİ tekrarları ayıkla.
  // ERP bazen aynı arızayı iki kez yazıyor (sadece BİTİŞ ms farkıyla); bunlar aynı
  // unique_key'i üretir ve tek insert içinde unique constraint hatasına yol açar.
  const tekilMap = new Map<string, Record<string, any>>();
  for (const k of kayitlar) {
    if (!tekilMap.has(k.unique_key)) tekilMap.set(k.unique_key, k);
  }
  const tekilKayitlar = Array.from(tekilMap.values());
  const dosyaIciMukerrer = kayitlar.length - tekilKayitlar.length;

  const supabase = supabaseAdmin();

  // 2) Veritabanında zaten olanları ayıkla.
  const keys = tekilKayitlar.map((k) => k.unique_key);
  const { data: existing, error: existingErr } = await supabase
    .from('ariza_kayitlari')
    .select('unique_key')
    .eq('fabrika_id', session.fabrikaId)
    .in('unique_key', keys);

  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }

  const existingSet = new Set((existing || []).map((e) => e.unique_key));
  const yeniKayitlar = tekilKayitlar.filter((k) => !existingSet.has(k.unique_key));

  if (yeniKayitlar.length === 0) {
    return NextResponse.json({
      message: 'Yükleme tamamlandı, ancak tüm kayıtlar zaten sistemde mevcut (mükerrer).',
      toplam_satir: toplamSatir,
      eklenen: 0,
      atlanan_mukerrer: kayitlar.length,
    });
  }

  // 3) Son güvenlik ağı: arada başka bir yükleme aynı kaydı eklemiş olsa bile
  // hata vermeden atla (ON CONFLICT DO NOTHING). Dönen satırlar = gerçekten eklenenler.
  const { data: eklenenler, error: insertErr } = await supabase
    .from('ariza_kayitlari')
    .upsert(yeniKayitlar, { onConflict: 'fabrika_id,unique_key', ignoreDuplicates: true })
    .select('kategori');

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const eklenenSayi = eklenenler?.length ?? 0;

  const kategoriSayaci: Record<string, number> = {};
  (eklenenler || []).forEach((k) => {
    kategoriSayaci[k.kategori] = (kategoriSayaci[k.kategori] || 0) + 1;
  });

  return NextResponse.json({
    message: 'Yükleme başarılı',
    toplam_satir: toplamSatir,
    eklenen: eklenenSayi,
    atlanan_mukerrer: kayitlar.length - eklenenSayi,
    dosya_ici_mukerrer: dosyaIciMukerrer,
    kategori_dagilimi: kategoriSayaci,
  });
}
