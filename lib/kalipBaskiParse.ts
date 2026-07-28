import * as XLSX from 'xlsx';

// Farklı kaynaklardan gelen kalıp kodları farklı yazılabiliyor:
// "FOM-0117", "FOM001", "MAR - 001", "MAR  001" gibi. Eşleştirme yapabilmek için
// boşluk/tire gibi karakterleri atıp büyük harfe çeviriyoruz.
export function kalipKoduNormalize(kod: string | null | undefined): string {
  return (kod ?? '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const BASLIK_ADAYLARI: Record<string, string[]> = {
  kalip_kodu: ['KALIP KODU', 'KALIPKODU'],
  yt_baski: ['YT_BASKI', 'YT BASKI', 'YTBASKI'],
};

function normalizeBaslik(text: any): string {
  return (text ?? '').toString().trim().toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/[_\s]+/g, ' ').trim();
}

export type BaskiKaydi = { kalip_kodu: string; kalip_kodu_normalize: string; guncel_baski_toplam: number };

// NOT: ERP'den her ay okunan "YT_Baskı" değeri, o kalıbın KÜMÜLATİF
// (o ana kadarki toplam) baskı sayısıdır — o ayın kendi baskı sayısı değildir.
// O ayki gerçek baskı sayısı, sunucu tarafında bir önceki ayın kümülatif
// değeri bu değerden çıkarılarak (fark alınarak) hesaplanır.
export function parseBaskiBuffer(buf: ArrayBuffer): { kayitlar: BaskiKaydi[]; toplamSatir: number; hata?: string } {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const satirlar: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  if (satirlar.length < 2) {
    return { kayitlar: [], toplamSatir: 0, hata: 'Dosyada veri satırı bulunamadı' };
  }

  const headerRow = satirlar[0];
  const normalizedHeaders = headerRow.map(normalizeBaslik);
  const colMap: Record<string, number> = {};
  for (const [alan, adaylar] of Object.entries(BASLIK_ADAYLARI)) {
    const normAdaylar = adaylar.map(normalizeBaslik);
    const idx = normalizedHeaders.findIndex((h) => normAdaylar.includes(h));
    if (idx !== -1) colMap[alan] = idx;
  }

  if (colMap.kalip_kodu === undefined || colMap.yt_baski === undefined) {
    return {
      kayitlar: [], toplamSatir: 0,
      hata: '"Kalıp Kodu" veya "YT_Baskı" sütunu başlıklarda bulunamadı. Excel başlık satırını kontrol edin.',
    };
  }

  const veriSatirlari = satirlar.slice(1).filter((r) => r && r.some((c) => c !== null && c !== ''));

  const kayitlar: BaskiKaydi[] = veriSatirlari
    .map((r) => {
      const kod = r[colMap.kalip_kodu];
      const baski = r[colMap.yt_baski];
      return {
        kalip_kodu: kod ? String(kod).trim() : '',
        kalip_kodu_normalize: kalipKoduNormalize(kod),
        guncel_baski_toplam: typeof baski === 'number' ? baski : Number(baski) || 0,
      };
    })
    .filter((k) => k.kalip_kodu_normalize.length > 0);

  return { kayitlar, toplamSatir: veriSatirlari.length };
}
