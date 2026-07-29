import * as XLSX from 'xlsx';
import { kalipKoduNormalize } from './kalipBaskiParse';

export type ProjeKalipKaydi = { kalip_kodu: string; kalip_kodu_normalize: string; kalip_adi: string };

// Format: 1. satır başlık ("YENİ PROJE KALIPLARI"), 2. satırdan itibaren
// A sütunu = Kalıp Kodu, B sütunu = Kalıp Adı (başlık satırı yok).
export function parseProjeKalipListesi(buf: ArrayBuffer): { kayitlar: ProjeKalipKaydi[]; hata?: string } {
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const satirlar: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  const kayitlar: ProjeKalipKaydi[] = [];
  for (let r = 1; r < satirlar.length; r++) {
    const row = satirlar[r];
    if (!row) continue;
    const kod = row[0];
    if (!kod) continue;
    kayitlar.push({
      kalip_kodu: String(kod).trim(),
      kalip_kodu_normalize: kalipKoduNormalize(kod),
      kalip_adi: row[1] ? String(row[1]).trim() : '',
    });
  }

  if (kayitlar.length === 0) {
    return { kayitlar: [], hata: 'Dosyada kalıp kodu bulunamadı' };
  }
  return { kayitlar };
}
