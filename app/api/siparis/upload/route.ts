import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

const BUCKET = 'siparis-pdfler';

// Plaskar "SATINALMA TALEP FORMU" düzenine göre ayrıştırma.
// STOK KODU deseni: 2-6 harf + 6-10 rakam (örn. BYP20260763)
const STOK_KODU_DESENI = /\b[A-ZÇĞİÖŞÜ]{2,6}\d{6,10}/g;
// Bir kalem bloğu içinde miktar + teslim tarihi: "5,00 AD28.07.2026" gibi
const DETAY_DESENI = /(\d+[.,]\d{1,2})\s*(AD|ADET|KG|LT|M2|M3|M)?\s*(\d{2}\.\d{2}\.\d{4})/i;
// AÇIKLAMA sütununda yazılan makine kodları: "FOM-MB021" gibi (harf-harf/rakam
// birleşimi, tireyle ayrılmış). Ayraç "/" (yeni format) veya " - " (eski format)
// fark etmeksizin, kod şeklinden tanınır — stok adı metninde bu şekle rastlanmaz.
const MAKINE_KODU_DESENI = /\b[A-ZÇĞİÖŞÜ]{2,6}-[A-Z0-9ÇĞİÖŞÜ]{2,8}\b/g;

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

  const kalemler: {
    satir_metni: string; stok_kodu: string | null; stok_adi: string | null;
    miktar: string | null; teslim_tarihi: string | null; makine_kodlari: string[];
  }[] = [];

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

      // "Stok Adı" ile PDF'teki AÇIKLAMA (makine kodları) metni, satır kaydırma
      // yüzünden ham metinde ayraçsız birleşik geliyor. Makine kodu deseninin
      // ilk göründüğü noktadan böl: öncesi stok adı, sonrası açıklama.
      const makineKodlari = Array.from(new Set(aciklamaKismi.match(MAKINE_KODU_DESENI) || []));
      let stokAdi = aciklamaKismi;
      let ekAciklama = '';
      if (makineKodlari.length > 0) {
        const ilkKodIndex = aciklamaKismi.search(MAKINE_KODU_DESENI);
        stokAdi = aciklamaKismi.slice(0, ilkKodIndex).trim();
        ekAciklama = aciklamaKismi.slice(ilkKodIndex).trim();
      }

      const satirMetni = `${stokKodu} — ${stokAdi}`
        + (ekAciklama ? ` | Not: ${ekAciklama}` : '')
        + (miktar ? ` | Miktar: ${miktar}` : '')
        + (teslimTarihi ? ` | Teslim: ${teslimTarihi}` : '');

      kalemler.push({
        satir_metni: satirMetni, stok_kodu: stokKodu, stok_adi: stokAdi || null,
        miktar, teslim_tarihi: teslimTarihi, makine_kodlari: makineKodlari,
      });
    }
  } else {
    // Tanınan bir stok kodu deseni bulunamazsa: genel satır satır dökümüne düş
    hamMetin.split('\n').map((s) => s.trim()).filter((s) => s.length > 0).forEach((satir) => {
      kalemler.push({ satir_metni: satir, stok_kodu: null, stok_adi: null, miktar: null, teslim_tarihi: null, makine_kodlari: [] });
    });
  }

  return { baslikBilgisi, kalemler };
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

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
    fabrika_id: session.fabrikaId,
    yukleyen_id: session.id,
  }).select('id').single();

  if (siparisErr) return NextResponse.json({ error: siparisErr.message }, { status: 500 });

  // Makine adı -> id önbelleği (aynı istek içinde aynı makine birden çok kalemde
  // geçebilir, tekrar tekrar sorgulamamak/duplicate oluşturmamak için).
  const makineIdOnbellek = new Map<string, string>();
  async function makineIdBul(ad: string): Promise<string> {
    const anahtarli = ad.trim();
    if (makineIdOnbellek.has(anahtarli)) return makineIdOnbellek.get(anahtarli)!;
    const { data: mevcut } = await supabase
      .from('makineler').select('id').eq('fabrika_id', session!.fabrikaId).eq('ad', anahtarli).maybeSingle();
    if (mevcut) { makineIdOnbellek.set(anahtarli, mevcut.id); return mevcut.id; }
    const { data: yeni, error: yeniErr } = await supabase
      .from('makineler').insert({ ad: anahtarli, fabrika_id: session!.fabrikaId }).select('id').single();
    if (yeniErr) {
      // Aynı anda başka bir kalem aynı makineyi oluşturmuş olabilir (unique çakışması) — tekrar oku.
      const { data: tekrar } = await supabase
        .from('makineler').select('id').eq('fabrika_id', session!.fabrikaId).eq('ad', anahtarli).single();
      if (tekrar) { makineIdOnbellek.set(anahtarli, tekrar.id); return tekrar.id; }
      throw new Error(yeniErr.message);
    }
    makineIdOnbellek.set(anahtarli, yeni.id);
    return yeni.id;
  }

  let eslenenParcaSayisi = 0;
  let sira = 0;
  for (const k of kalemler) {
    const { data: kalemKaydi, error: kalemErr } = await supabase.from('siparis_kalemleri').insert({
      siparis_id: siparis.id,
      fabrika_id: session.fabrikaId,
      sira: sira++,
      satir_metni: k.satir_metni,
      stok_kodu: k.stok_kodu,
      miktar: k.miktar,
      teslim_tarihi: k.teslim_tarihi,
    }).select('id').single();

    if (kalemErr) return NextResponse.json({ error: kalemErr.message }, { status: 500 });

    if (k.makine_kodlari.length > 0 && k.stok_adi) {
      for (const makineKodu of k.makine_kodlari) {
        try {
          const makineId = await makineIdBul(makineKodu);
          const { error: parcaErr } = await supabase.from('yedek_parcalar').insert({
            fabrika_id: session.fabrikaId,
            makine_id: makineId,
            parca_kodu: k.stok_kodu,
            parca_tanimi: k.stok_adi,
            siparis_kalemi_id: kalemKaydi.id,
            ekleyen_personel_id: session.id,
          });
          if (!parcaErr) eslenenParcaSayisi += 1;
        } catch {
          // Makine oluşturma/parça ekleme başarısız olursa siparişin geri kalanını engellemesin.
        }
      }
    }
  }

  return NextResponse.json({
    ok: true, id: siparis.id, kalem_sayisi: kalemler.length,
    talep_no: baslikBilgisi.talep_no, tarih: baslikBilgisi.tarih,
    makine_eslesme_sayisi: eslenenParcaSayisi,
  });
}
