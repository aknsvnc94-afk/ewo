import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

const BUCKET = 'siparis-pdfler';

// Plaskar "SATINALMA TALEP FORMU" düzenine göre ayrıştırma.
// STOK KODU deseni: 2-6 harf + 6-10 rakam (örn. BYP20260763)
const STOK_KODU_DESENI = /\b[A-ZÇĞİÖŞÜ]{2,6}\d{6,10}/g;
// Bir kalem bloğu içinde miktar + teslim tarihi: "5,00 AD28.07.2026" gibi
const DETAY_DESENI = /(\d+[.,]\d{1,2})\s*(AD|ADET|KG|LT|M2|M3|M)?\s*(\d{2}\.\d{2}\.\d{4})/i;

function metniAyristir(hamMetin: string) {
  const talepNoTarih = hamMetin.match(/(\d{2}\.\d{2}\.\d{4})\s*\n?\s*SATINALMA TALEP FORMU\s*\n?\s*(\d+)/i);
  const bolum = hamMetin.match(/B[ÖO]L[ÜU]M\s*:?\s*(.+)/i);
  const kisi = hamMetin.match(/K[İI]Ş[İI]\s*:?\s*(.+)/i);

  const baslikBilgisi = {
    tarih: talepNoTarih ? talepNoTarih[1] : null,
    talep_no: talepNoTarih ? talepNoTarih[2] : null,
    bolum: bolum ? bolum[1].trim() : null,
    kisi: kisi ? kisi[1].trim() : null,
  };

  const eslesmeler = [...hamMetin.matchAll(STOK_KODU_DESENI)];
  const bitisIsaretleri = ['DEPARTMAN SORUMLUSU', 'SATIN ALMA SORUMLUSU', 'TALEP ONAYI', 'Onay Tarihi'];

  const kalemler: { satir_metni: string; stok_kodu: string | null; miktar: string | null; teslim_tarihi: string | null }[] = [];

  if (eslesmeler.length > 0) {
    for (let i = 0; i < eslesmeler.length; i++) {
      const baslangic = eslesmeler[i].index as number;
      let bitis = i + 1 < eslesmeler.length ? (eslesmeler[i + 1].index as number) : hamMetin.length;
      for (const isaret of bitisIsaretleri) {
        const idx = hamMetin.indexOf(isaret, baslangic);
        if (idx !== -1 && idx < bitis) bitis = idx;
      }
      const blokHam = hamMetin.slice(baslangic, bitis).replace(/\s+/g, ' ').trim();
      const stokKodu = eslesmeler[i][0];
      const gerisi = blokHam.slice(stokKodu.length).trim();
      const detay = gerisi.match(DETAY_DESENI);

      let miktar: string | null = null;
      let teslimTarihi: string | null = null;
      let aciklamaKismi = gerisi;
      if (detay) {
        miktar = `${detay[1]} ${detay[2] || ''}`.trim();
        teslimTarihi = detay[3];
        aciklamaKismi = gerisi.slice(0, detay.index).trim();
      }

      const satirMetni = `${stokKodu} — ${aciklamaKismi}`
        + (miktar ? ` | Miktar: ${miktar}` : '')
        + (teslimTarihi ? ` | Teslim: ${teslimTarihi}` : '');

      kalemler.push({ satir_metni: satirMetni, stok_kodu: stokKodu, miktar, teslim_tarihi: teslimTarihi });
    }
  } else {
    // Tanınan bir stok kodu deseni bulunamazsa: genel satır satır dökümüne düş
    hamMetin.split('\n').map((s) => s.trim()).filter((s) => s.length > 0).forEach((satir) => {
      kalemler.push({ satir_metni: satir, stok_kodu: null, miktar: null, teslim_tarihi: null });
    });
  }

  return { baslikBilgisi, kalemler };
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file gerekli' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());

  let hamMetin = '';
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const sonuc = await pdfParse(buf);
    hamMetin = sonuc.text || '';
  } catch (err: any) {
    return NextResponse.json({ error: `PDF okunamadı: ${err?.message || 'bilinmeyen hata'}` }, { status: 400 });
  }

  if (hamMetin.trim().length === 0) {
    return NextResponse.json({ error: 'PDF içinde okunabilir metin bulunamadı (taranmış görsel PDF olabilir)' }, { status: 400 });
  }

  const { baslikBilgisi, kalemler } = metniAyristir(hamMetin);

  if (kalemler.length === 0) {
    return NextResponse.json({ error: 'PDF içinde ayrıştırılabilir kalem bulunamadı' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const dosyaYolu = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  let pdfUrl: string | null = null;
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(dosyaYolu, buf, { contentType: 'application/pdf' });
  if (!uploadErr) {
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(dosyaYolu);
    pdfUrl = urlData.publicUrl;
  }

  const { data: siparis, error: siparisErr } = await supabase.from('siparisler').insert({
    dosya_adi: file.name,
    pdf_url: pdfUrl,
    ham_metin: hamMetin,
    talep_no: baslikBilgisi.talep_no,
    tarih: baslikBilgisi.tarih,
    bolum: baslikBilgisi.bolum,
    kisi: baslikBilgisi.kisi,
    yukleyen_id: session.id,
  }).select('id').single();

  if (siparisErr) return NextResponse.json({ error: siparisErr.message }, { status: 500 });

  const eklenecekKalemler = kalemler.map((k, i) => ({
    siparis_id: siparis.id,
    sira: i,
    satir_metni: k.satir_metni,
    stok_kodu: k.stok_kodu,
    miktar: k.miktar,
    teslim_tarihi: k.teslim_tarihi,
  }));

  const { error: kalemErr } = await supabase.from('siparis_kalemleri').insert(eklenecekKalemler);
  if (kalemErr) return NextResponse.json({ error: kalemErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true, id: siparis.id, kalem_sayisi: eklenecekKalemler.length,
    talep_no: baslikBilgisi.talep_no, tarih: baslikBilgisi.tarih,
  });
}
