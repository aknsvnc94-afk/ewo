import * as XLSX from 'xlsx';
import { kalipKoduNormalize } from './kalipBaskiParse';

// "13- TÜM MFI KALIPLARI" sayfa düzeni: KALIP KODU sütunundan sonra her ay için
// 4 sütunluk bir blok tekrarlanır: [Güncel Baskı, O Ay Gerçekleşen Baskı, Arıza Sayısı, MSBF]
// OCAK bloğu G sütunundan (index 6, 0-tabanlı) başlar, her ay +4 sütun kayar.
const AY_ISIMLERI = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
const KALIP_KODU_SUTUN = 1;  // B sütunu (0-tabanlı index)
const OCAK_BASLANGIC = 5;    // F sütunu (0-tabanlı index) — Güncel Baskı Sayısı
const BLOK_GENISLIGI = 4;

export type GecmisKayit = {
  kalip_kodu: string;
  kalip_kodu_normalize: string;
  ay: string; // 'YYYY-MM'
  yt_baski: number;
  ariza_sayisi_manuel: number;
};

export function parseGecmisKpiBuffer(
  buf: ArrayBuffer,
  yil: number
): { kayitlar: GecmisKayit[]; kalipSayisi: number; hata?: string } {
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames.find((n) => n.toUpperCase().includes('MFI KALIPLARI')) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const satirlar: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  if (satirlar.length < 4) {
    return { kayitlar: [], kalipSayisi: 0, hata: 'Dosyada beklenen veri satırları bulunamadı' };
  }

  const kayitlar: GecmisKayit[] = [];
  let kalipSayisi = 0;

  // Veri 4. satırdan (index 3) başlıyor (1-2. satır başlık, 3. satır alt başlık)
  for (let r = 3; r < satirlar.length; r++) {
    const row = satirlar[r];
    if (!row) continue;
    const kodHam = row[KALIP_KODU_SUTUN];
    if (!kodHam) continue;
    const norm = kalipKoduNormalize(kodHam);
    if (!norm.startsWith('FOM') && !norm.startsWith('MAR')) continue; // sadece Fompak + Martur

    let buKalipDoluAySayisi = 0;
    AY_ISIMLERI.forEach((_, ayIndex) => {
      const base = OCAK_BASLANGIC + ayIndex * BLOK_GENISLIGI;
      const ayGerceklesen = row[base + 1]; // [base]=güncel, [base+1]=ay gerçekleşen, [base+2]=arıza, [base+3]=msbf
      const arizaSayisi = row[base + 2];
      if (ayGerceklesen === null && arizaSayisi === null) return; // bu ay için hiç veri yok, atla

      const ayNo = ayIndex + 1;
      kayitlar.push({
        kalip_kodu: String(kodHam).trim(),
        kalip_kodu_normalize: norm,
        ay: `${yil}-${String(ayNo).padStart(2, '0')}`,
        yt_baski: typeof ayGerceklesen === 'number' ? ayGerceklesen : Number(ayGerceklesen) || 0,
        ariza_sayisi_manuel: typeof arizaSayisi === 'number' ? arizaSayisi : Number(arizaSayisi) || 0,
      });
      buKalipDoluAySayisi++;
    });

    if (buKalipDoluAySayisi > 0) kalipSayisi++;
  }

  if (kayitlar.length === 0) {
    return { kayitlar: [], kalipSayisi: 0, hata: 'Fompak/Martur kalıpları için dolu ay verisi bulunamadı' };
  }

  return { kayitlar, kalipSayisi };
}
