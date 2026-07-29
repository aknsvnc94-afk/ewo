import * as XLSX from 'xlsx';
import { kalipKoduNormalize } from './kalipBaskiParse';

// Bu tür dosyalarda her ay için 4 sütunluk bir blok tekrarlanır:
// [Güncel Baskı, O Ay Gerçekleşen Baskı, Arıza Sayısı, MSBF]
// Sayfadan sayfaya (örn. "TÜM MFI KALIPLARI" ile "YENİ PROJE KALIPLARI")
// sütun kaymaları farklı olabiliyor — bu yüzden "OCAK" yazan hücreyi bulup
// oradan otomatik hizalanıyoruz (kalıp kodu sütunu her zaman OCAK bloğundan
// 4 sütun önce geliyor).
const AY_ISIMLERI = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
const BLOK_GENISLIGI = 4;
const KOD_OCAK_FARKI = 4;

export type GecmisKayit = {
  kalip_kodu: string;
  kalip_kodu_normalize: string;
  ay: string; // 'YYYY-MM'
  yt_baski: number;
  guncel_baski_toplam: number;
  ariza_sayisi_manuel: number;
};

function sayfaYapisiniBul(satirlar: any[][]): { ocakBaslangic: number; kalipKoduSutun: number; veriBaslangicSatir: number } | null {
  for (let r = 0; r < Math.min(6, satirlar.length); r++) {
    const row = satirlar[r];
    if (!row) continue;
    const ocakIdx = row.findIndex((v) => (v ?? '').toString().trim().toLocaleUpperCase('tr-TR') === 'OCAK');
    if (ocakIdx !== -1) {
      return { ocakBaslangic: ocakIdx, kalipKoduSutun: ocakIdx - KOD_OCAK_FARKI, veriBaslangicSatir: r + 2 };
    }
  }
  return null;
}

export function parseGecmisKpiBuffer(
  buf: ArrayBuffer,
  yil: number
): { kayitlar: GecmisKayit[]; kalipSayisi: number; hata?: string; sayfaOzeti: string[] } {
  const wb = XLSX.read(buf, { type: 'array' });
  const kayitlar: GecmisKayit[] = [];
  const gorulenKalipSet = new Set<string>();
  const sayfaOzeti: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const satirlar: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    const yapi = sayfaYapisiniBul(satirlar);
    if (!yapi) {
      sayfaOzeti.push(`${sheetName}: aylık blok yapısı bulunamadı, atlandı`);
      continue;
    }

    let buSayfaKalip = 0;
    for (let r = yapi.veriBaslangicSatir; r < satirlar.length; r++) {
      const row = satirlar[r];
      if (!row) continue;
      const kodHam = row[yapi.kalipKoduSutun];
      if (!kodHam) continue;
      const norm = kalipKoduNormalize(kodHam);
      if (!norm.startsWith('FOM') && !norm.startsWith('MAR')) continue; // sadece Fompak + Martur

      let buKalipDoluAySayisi = 0;
      AY_ISIMLERI.forEach((_, ayIndex) => {
        const base = yapi.ocakBaslangic + ayIndex * BLOK_GENISLIGI;
        const guncelToplam = row[base];
        const ayGerceklesen = row[base + 1];
        const arizaSayisi = row[base + 2];
        if (ayGerceklesen === null && arizaSayisi === null) return;

        const ayNo = ayIndex + 1;
        kayitlar.push({
          kalip_kodu: String(kodHam).trim(),
          kalip_kodu_normalize: norm,
          ay: `${yil}-${String(ayNo).padStart(2, '0')}`,
          yt_baski: typeof ayGerceklesen === 'number' ? ayGerceklesen : Number(ayGerceklesen) || 0,
          guncel_baski_toplam: typeof guncelToplam === 'number' ? guncelToplam : Number(guncelToplam) || 0,
          ariza_sayisi_manuel: typeof arizaSayisi === 'number' ? arizaSayisi : Number(arizaSayisi) || 0,
        });
        buKalipDoluAySayisi++;
      });

      if (buKalipDoluAySayisi > 0) {
        buSayfaKalip++;
        gorulenKalipSet.add(norm);
      }
    }
    sayfaOzeti.push(`${sheetName}: ${buSayfaKalip} kalıp (kod sütunu ${yapi.kalipKoduSutun}, Ocak bloğu ${yapi.ocakBaslangic})`);
  }

  if (kayitlar.length === 0) {
    return { kayitlar: [], kalipSayisi: 0, hata: 'Fompak/Martur kalıpları için dolu ay verisi bulunamadı', sayfaOzeti };
  }

  return { kayitlar, kalipSayisi: gorulenKalipSet.size, sayfaOzeti };
}
