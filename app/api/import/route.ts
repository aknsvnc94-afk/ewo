import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';
import crypto from 'crypto';

// ANA VERI sayfasındaki sütun sırası (ERP export formatı ile birebir aynı olmalı)
const COLS = [
  'tezgah', 'vardiya', 'is_emri_detay_kodu', 'stok_kodu', 'kalip_kodu',
  'operator', 'durus_tipi', 'durus_kodu', 'durus_adi', 'baslangic', 'bitis',
  'sure_sn', 'sure', 'durus_maks', 'durus_maks_asim_sn', 'durus_maks_asim',
  'ignore1', 'ignore2', 'ignore3', 'ignore4', // dti_baslangic_d_AY, dti_bitis_d_AY, SURESN_AY, SUREDK_AY (kullanılmıyor)
  'aciklama', 'utarih', 'tesis',
];

const GECERLI_KATEGORILER = ['MA', 'BA', 'KA', 'RA'];

function excelDateToISO(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'number') {
    // Excel seri tarih -> JS Date
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, Math.round(d.S))).toISOString();
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function makeUniqueKey(row: Record<string, any>): string {
  // Aynı arıza kaydı ERP'den tekrar geldiğinde üzerine yazmamak için
  // tezgah + başlangıç + duruş kodu + iş emri detay kodu birleşimi kullanılır.
  const raw = [
    row.tezgah, row.baslangic, row.durus_kodu, row.is_emri_detay_kodu, row.sure_sn,
  ].map((v) => (v ?? '').toString().trim()).join('|');
  return crypto.createHash('sha1').update(raw).digest('hex');
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });

  // "ANA VERI" sayfasını bul (yoksa ilk sayfayı kullan)
  const sheetName = wb.SheetNames.includes('ANA VERI') ? 'ANA VERI' : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  // İlk satır başlık -> atla
  const dataRows = rawRows.slice(1).filter((r) => r && r.some((c) => c !== null && c !== ''));

  const kayitlar = dataRows.map((r) => {
    const obj: Record<string, any> = {};
    COLS.forEach((key, i) => {
      if (key.startsWith('ignore')) return;
      obj[key] = r[i] ?? null;
    });
    obj.baslangic = excelDateToISO(obj.baslangic);
    obj.bitis = excelDateToISO(obj.bitis);
    obj.vardiya = obj.vardiya ? Number(obj.vardiya) : null;
    obj.sure_sn = obj.sure_sn ? Number(obj.sure_sn) : null;
    obj.durus_maks = obj.durus_maks ? Number(obj.durus_maks) : null;
    obj.durus_maks_asim_sn = obj.durus_maks_asim_sn ? Number(obj.durus_maks_asim_sn) : null;

    const kategori = (obj.durus_kodu || '').toString().trim().toUpperCase();
    obj.kategori = GECERLI_KATEGORILER.includes(kategori) ? kategori : null;

    obj.unique_key = makeUniqueKey(obj);
    obj.yukleyen_id = session.id;
    return obj;
  }).filter((k) => k.kategori !== null); // tanımsız kategori satırlarını atla

  if (kayitlar.length === 0) {
    return NextResponse.json({ error: 'Geçerli (MA/BA/KA/RA) kayıt bulunamadı' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Mevcut unique_key'leri çekip zaten var olanları filtrele (ekle-değil-üzerine-yazma davranışı)
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
      toplam_satir: dataRows.length,
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
    toplam_satir: dataRows.length,
    eklenen: yeniKayitlar.length,
    atlanan_mukerrer: kayitlar.length - yeniKayitlar.length,
    kategori_dagilimi: kategoriSayaci,
  });
}
