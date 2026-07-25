import * as XLSX from 'xlsx';

// Bu dosyanın hiç başlık satırı yok — sütunlar sabit pozisyonda geliyor.
// Pozisyonlar örnek dosya üzerinden doğrulandı:
const SUTUN = {
  ONARILAN_KODU: 3,
  ONARILAN_TANIMI: 4,
  PROBLEM_TANIMI: 5,
  TARIH: 6,
  IS_EMRI_NO: 7,
  TESIS_ADI: 31,
};

function excelDegerToISO(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, Math.round(d.S))).toISOString();
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export type IsEmriKaydi = {
  is_emri_no: string | null;
  onarilan_kodu: string | null;
  onarilan_tanimi: string | null;
  problem_tanimi: string | null;
  tarih: string | null;
  tesis_adi: string | null;
};

export function parseIsEmriBuffer(buf: ArrayBuffer): { kayitlar: IsEmriKaydi[]; toplamSatir: number; hata?: string } {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const satirlar: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  const veriSatirlari = satirlar.filter((r) => r && r.some((c) => c !== null && c !== ''));

  if (veriSatirlari.length === 0) {
    return { kayitlar: [], toplamSatir: 0, hata: 'Dosyada veri satırı bulunamadı' };
  }

  const kayitlar: IsEmriKaydi[] = veriSatirlari
    .map((r) => ({
      is_emri_no: r[SUTUN.IS_EMRI_NO] ? String(r[SUTUN.IS_EMRI_NO]).trim() : null,
      onarilan_kodu: r[SUTUN.ONARILAN_KODU] ? String(r[SUTUN.ONARILAN_KODU]).trim() : null,
      onarilan_tanimi: r[SUTUN.ONARILAN_TANIMI] ? String(r[SUTUN.ONARILAN_TANIMI]).trim() : null,
      problem_tanimi: r[SUTUN.PROBLEM_TANIMI] ? String(r[SUTUN.PROBLEM_TANIMI]).trim() : null,
      tarih: excelDegerToISO(r[SUTUN.TARIH]),
      tesis_adi: r[SUTUN.TESIS_ADI] ? String(r[SUTUN.TESIS_ADI]).trim() : null,
    }))
    .filter((k) => k.is_emri_no); // iş emri numarası olmayan satırları atla

  return { kayitlar, toplamSatir: veriSatirlari.length };
}
