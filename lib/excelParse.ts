import * as XLSX from 'xlsx';

// ERP export'larda sütun SIRASI değişebiliyor (örn. STOK KODU olmayabiliyor).
// Bu yüzden sütunları sabit index yerine BAŞLIK METNİNE göre eşleştiriyoruz.
export const FIELD_HEADER_CANDIDATES: Record<string, string[]> = {
  tezgah: ['TEZGAH'],
  vardiya: ['VARDIYA'],
  is_emri_detay_kodu: ['IS EMRI DETAYKODU', 'IS EMRI DETAY KODU'],
  stok_kodu: ['STOK KODU'],
  kalip_kodu: ['KALIP KODU'],
  operator: ['OPERATOR'],
  durus_tipi: ['DURUS TIPI'],
  durus_kodu: ['DURUS KODU'],
  durus_adi: ['DURUS ADI'],
  baslangic: ['BASLANGIC'],
  bitis: ['BITIS'],
  sure_sn: ['SURE SN'],
  sure: ['SURE'],
  durus_maks: ['DURUS MAKS'],
  durus_maks_asim_sn: ['DURUS MAKS ASIM SN'],
  durus_maks_asim: ['DURUS MAKS ASIM'],
  aciklama: ['ACIKLAMA'],
  utarih: ['UTARIH'],
  tesis: ['TESIS'],
};

export const GECERLI_KATEGORILER = ['MA', 'BA', 'KA', 'RA'];

// Türkçe karakterleri ASCII karşılığına çevirip büyük harfe çevirir, kıyaslamayı
// büyük/küçük harf ve Ş/Ğ/Ü/Ö/Ç/İ/ı farklarından bağımsız hale getirir.
export function normalizeHeader(text: any): string {
  return (text ?? '')
    .toString()
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, ' ');
}

// Excel'deki gerçek başlık satırından, her alan için hangi sütun index'inin
// kullanılacağını bulur. Sütun sırası ne olursa olsun doğru eşleşir.
export function buildColumnMap(headerRow: any[]): Record<string, number> {
  const normalizedHeaders = headerRow.map(normalizeHeader);
  const map: Record<string, number> = {};
  for (const [field, candidates] of Object.entries(FIELD_HEADER_CANDIDATES)) {
    const normCandidates = candidates.map(normalizeHeader);
    const idx = normalizedHeaders.findIndex((h) => normCandidates.includes(h));
    if (idx !== -1) map[field] = idx;
  }
  return map;
}

export function excelDateToISO(val: any): string | null {
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

export type AyristirilmisKayit = Record<string, any>;

export type AyristirmaSonucu = {
  kayitlar: AyristirilmisKayit[];
  toplamSatir: number;
  hata?: string;
};

// Excel dosyasını (ArrayBuffer) parse eder, sadece geçerli MA/BA/KA/RA
// kategorisindeki satırları döner. Hem tarayıcıda hem sunucuda çalışır.
export function parseExcelBuffer(buf: ArrayBuffer): AyristirmaSonucu {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames.includes('ANA VERI') ? 'ANA VERI' : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  if (rawRows.length < 2) {
    return { kayitlar: [], toplamSatir: 0, hata: 'Dosyada veri satırı bulunamadı' };
  }

  const headerRow = rawRows[0];
  const colMap = buildColumnMap(headerRow);

  if (colMap.tezgah === undefined || colMap.durus_kodu === undefined) {
    return {
      kayitlar: [], toplamSatir: 0,
      hata: 'TEZGAH veya DURUŞ KODU sütunu başlıklarda bulunamadı. Excel başlık satırını kontrol edin.',
    };
  }

  const dataRows = rawRows.slice(1).filter((r) => r && r.some((c) => c !== null && c !== ''));

  const kayitlar = dataRows.map((r) => {
    const obj: AyristirilmisKayit = {};
    for (const field of Object.keys(FIELD_HEADER_CANDIDATES)) {
      const idx = colMap[field];
      obj[field] = idx !== undefined ? (r[idx] ?? null) : null;
    }
    obj.baslangic = excelDateToISO(obj.baslangic);
    obj.bitis = excelDateToISO(obj.bitis);
    obj.vardiya = obj.vardiya ? Number(obj.vardiya) : null;
    obj.sure_sn = obj.sure_sn ? Number(obj.sure_sn) : null;
    obj.durus_maks = obj.durus_maks ? Number(obj.durus_maks) : null;
    obj.durus_maks_asim_sn = obj.durus_maks_asim_sn ? Number(obj.durus_maks_asim_sn) : null;

    const kategori = (obj.durus_kodu || '').toString().trim().toUpperCase();
    obj.kategori = GECERLI_KATEGORILER.includes(kategori) ? kategori : null;
    return obj;
  }).filter((k) => k.kategori !== null);

  return { kayitlar, toplamSatir: dataRows.length };
}
