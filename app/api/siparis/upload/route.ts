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
const TARIH_DESENI = /\d{2}\.\d{2}\.\d{4}/;

// ============================================================
// KONUM (x/y) TABANLI TABLO AYRIŞTIRMA
// ------------------------------------------------------------
// PDF'ten düz metin çıkarıldığında sütunlar ARAYSIZ birleşiyor:
//   "BYP202607940.1X5000 MM ŞERİT LAYNERKALIP BAKIM..."
// Bu yüzden düz metin üzerinde regex ile sağlıklı ayrıştırma yapılamıyor
// (stok koduna rakam yapışıyor, stok adındaki "PT570024" sahte kalem
// oluşturuyor, "PEM 1001" + "8,00" birleşip miktarı bozuyor).
// Çözüm: metin parçalarını x/y koordinatlarıyla alıp, başlık satırından
// sütun sınırlarını çıkarmak ve her parçayı ait olduğu sütuna yerleştirmek.
// ============================================================

type MetinParcasi = { str: string; x: number; y: number; w: number };
type SutunAnahtari = 'stok_kodu' | 'stok_adi' | 'aciklama' | 'miktar' | 'teslim_tarihi' | 'not';
type Kalem = {
  satir_metni: string; stok_kodu: string | null; stok_adi: string | null;
  aciklama: string | null; miktar: string | null; teslim_tarihi: string | null;
  makine_kodlari: string[];
};

// pdf-parse'ın sayfa render kancası: metni konumuyla birlikte JSON olarak döndürür.
function konumluRender(pageData: any) {
  return pageData
    .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
    .then((icerik: any) =>
      JSON.stringify(
        (icerik.items || [])
          .filter((it: any) => (it.str ?? '').trim().length > 0)
          .map((it: any) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 }))
      )
    );
}

function trBuyuk(metin: string) {
  return (metin ?? '')
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/\s+/g, ' ')
    .trim();
}

const merkez = (p: MetinParcasi) => p.x + p.w / 2;

// Başlık satırını bulup her sütunun sınırlarını (komşu başlıkların orta noktası) çıkarır.
function sutunSinirlariniBul(parcalar: MetinParcasi[]) {
  const stokKoduBasligi = parcalar.find((p) => trBuyuk(p.str) === 'STOK KODU');
  if (!stokKoduBasligi) return null;

  const basY = stokKoduBasligi.y;
  // "TESLİM" / "TARİHİ" iki satıra bölünebildiği için dar bir y penceresi taranır.
  const basliklar = parcalar.filter((p) => Math.abs(p.y - basY) <= 12);

  const merkezler: { anahtar: SutunAnahtari; x: number }[] = [];
  const ekle = (anahtar: SutunAnahtari, p: MetinParcasi) => {
    if (!merkezler.some((m) => m.anahtar === anahtar)) merkezler.push({ anahtar, x: merkez(p) });
  };

  for (const p of basliklar) {
    const n = trBuyuk(p.str);
    if (n === 'STOK KODU') ekle('stok_kodu', p);
    else if (n === 'STOK ADI') ekle('stok_adi', p);
    else if (n === 'ACIKLAMA') ekle('aciklama', p);
    else if (n === 'MIKTAR') ekle('miktar', p);
    else if (n === 'TESLIM' || n === 'TESLIM TARIHI' || n === 'TARIHI') ekle('teslim_tarihi', p);
    else if (n === 'NOT') ekle('not', p);
  }

  if (!merkezler.some((m) => m.anahtar === 'stok_kodu')) return null;
  if (!merkezler.some((m) => m.anahtar === 'stok_adi')) return null;

  merkezler.sort((a, b) => a.x - b.x);
  const sinirlar = merkezler.map((m, i) => ({
    anahtar: m.anahtar,
    sol: i === 0 ? -Infinity : (merkezler[i - 1].x + m.x) / 2,
    sag: i === merkezler.length - 1 ? Infinity : (m.x + merkezler[i + 1].x) / 2,
  }));

  return { basY, sinirlar };
}

function tablodanKalemleriCikar(parcalar: MetinParcasi[]): Kalem[] | null {
  const sutunBilgisi = sutunSinirlariniBul(parcalar);
  if (!sutunBilgisi) return null;
  const { basY, sinirlar } = sutunBilgisi;

  const sutunuBul = (p: MetinParcasi): SutunAnahtari | null => {
    const mx = merkez(p);
    const bulunan = sinirlar.find((s) => mx >= s.sol && mx < s.sag);
    return bulunan ? bulunan.anahtar : null;
  };

  // Tablo gövdesi: başlığın altı ile alt bilgi (onay bölümü) arası.
  const altBilgiIsaretleri = ['DEPARTMAN SORUMLUSU ONAYI', 'SATIN ALMA SORUMLUSU', 'TALEP ONAYI', 'ONAY TARIHI :', 'ONAY TARIHI'];
  let altSinir = -Infinity;
  for (const p of parcalar) {
    if (p.y >= basY) continue;
    const n = trBuyuk(p.str);
    if (altBilgiIsaretleri.some((isaret) => n.startsWith(isaret))) altSinir = Math.max(altSinir, p.y);
  }

  const govde = parcalar.filter((p) => p.y < basY - 4 && p.y > altSinir);
  if (govde.length === 0) return null;

  // Çapa satırlar = STOK KODU sütununda değer bulunan satırlar.
  const capalar = govde
    .filter((p) => sutunuBul(p) === 'stok_kodu')
    .sort((a, b) => b.y - a.y);
  if (capalar.length === 0) return null;

  // Satır aralığından tolerans türet (çok satırlı hücreleri doğru çapaya bağlamak için).
  let tolerans = 12;
  if (capalar.length >= 2) {
    const farklar = capalar.slice(1).map((c, i) => Math.abs(capalar[i].y - c.y)).sort((a, b) => a - b);
    const ortancaFark = farklar[Math.floor(farklar.length / 2)];
    if (ortancaFark > 0) tolerans = ortancaFark * 0.75;
  }

  const gruplar = capalar.map((c) => ({ capa: c, parcalar: [] as MetinParcasi[] }));
  for (const p of govde) {
    let enYakin = -1;
    let enKisaMesafe = Infinity;
    gruplar.forEach((g, i) => {
      const mesafe = Math.abs(p.y - g.capa.y);
      if (mesafe < enKisaMesafe) { enKisaMesafe = mesafe; enYakin = i; }
    });
    if (enYakin !== -1 && enKisaMesafe <= tolerans) gruplar[enYakin].parcalar.push(p);
  }

  const kalemler: Kalem[] = [];
  for (const grup of gruplar) {
    const hucreler: Record<string, MetinParcasi[]> = {};
    for (const p of grup.parcalar) {
      const sutun = sutunuBul(p);
      if (!sutun) continue;
      if (!hucreler[sutun]) hucreler[sutun] = [];
      hucreler[sutun].push(p);
    }

    const hucreMetni = (sutun: SutunAnahtari) =>
      (hucreler[sutun] || [])
        .sort((a, b) => (Math.abs(a.y - b.y) > 1 ? b.y - a.y : a.x - b.x))
        .map((p) => p.str.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    const stokKodu = hucreMetni('stok_kodu');
    if (!stokKodu) continue;

    const stokAdi = hucreMetni('stok_adi');
    const aciklama = hucreMetni('aciklama');
    const miktar = hucreMetni('miktar');
    const teslimHam = hucreMetni('teslim_tarihi');
    const teslimTarihi = teslimHam.match(TARIH_DESENI)?.[0] || teslimHam || null;

    // Makine kodları YALNIZCA AÇIKLAMA sütunundan alınır; böylece stok adındaki
    // "SUN-FIX", "SKP-38" gibi ürün adı parçaları yanlışlıkla makine sanılmaz.
    const makineKodlari = Array.from(new Set(aciklama.match(MAKINE_KODU_DESENI) || []));

    const satirMetni = `${stokKodu} — ${stokAdi}`
      + (aciklama ? ` | Not: ${aciklama}` : '')
      + (miktar ? ` | Miktar: ${miktar}` : '')
      + (teslimTarihi ? ` | Teslim: ${teslimTarihi}` : '');

    kalemler.push({
      satir_metni: satirMetni,
      stok_kodu: stokKodu,
      stok_adi: stokAdi || null,
      aciklama: aciklama || null,
      miktar: miktar || null,
      teslim_tarihi: teslimTarihi,
      makine_kodlari: makineKodlari,
    });
  }

  return kalemler.length > 0 ? kalemler : null;
}

function metniAyristir(hamMetin: string, parcalar: MetinParcasi[] = []) {
  const talepNoTarih = hamMetin.match(/(\d{2}\.\d{2}\.\d{4})\s*\n?\s*SATINALMA TALEP FORMU\s*\n?\s*(\d+)/i);
  const bolum = hamMetin.match(/B[ÖO]L[ÜU]M\s*:?\s*(.+)/i);
  const kisi = hamMetin.match(/K[İI]Ş[İI]\s*:?\s*(.+)/i);

  const baslikBilgisi = {
    tarih: talepNoTarih ? talepNoTarih[1] : null,
    talep_no: talepNoTarih ? talepNoTarih[2] : null,
    bolum: bolum ? bolum[1].trim() : null,
    kisi: kisi ? kisi[1].trim() : null,
  };

  // Öncelik: sütun koordinatlarına göre ayrıştırma (güvenilir).
  if (parcalar.length > 0) {
    const tabloKalemleri = tablodanKalemleriCikar(parcalar);
    if (tabloKalemleri) return { baslikBilgisi, kalemler: tabloKalemleri };
  }

  // Yedek yöntem: başlık satırı tanınamayan/farklı düzendeki PDF'ler için düz metin ayrıştırma.
  const eslesmeler = [...hamMetin.matchAll(STOK_KODU_DESENI)];
  const bitisIsaretleri = ['DEPARTMAN SORUMLUSU', 'SATIN ALMA SORUMLUSU', 'TALEP ONAYI', 'Onay Tarihi'];

  const kalemler: Kalem[] = [];

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
        aciklama: ekAciklama || null, miktar, teslim_tarihi: teslimTarihi,
        makine_kodlari: makineKodlari,
      });
    }
  } else {
    // Tanınan bir stok kodu deseni bulunamazsa: genel satır satır dökümüne düş
    hamMetin.split('\n').map((s) => s.trim()).filter((s) => s.length > 0).forEach((satir) => {
      kalemler.push({ satir_metni: satir, stok_kodu: null, stok_adi: null, aciklama: null, miktar: null, teslim_tarihi: null, makine_kodlari: [] });
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
  let parcalar: MetinParcasi[] = [];
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const sonuc = await pdfParse(buf);
    hamMetin = sonuc.text || '';

    // İkinci geçiş: metni x/y koordinatlarıyla al (tablo sütunlarını ayırmak için).
    try {
      const konumlu = await pdfParse(buf, { pagerender: konumluRender } as any);
      parcalar = (konumlu.text || '')
        .split('\n\n')
        .map((s: string) => s.trim())
        .filter((s: string) => s.startsWith('['))
        .flatMap((s: string) => {
          try { return JSON.parse(s) as MetinParcasi[]; } catch { return []; }
        });
    } catch {
      // Konum çıkarımı başarısız olursa düz metin ayrıştırmasıyla devam edilir.
    }
  } catch (err: any) {
    return NextResponse.json({ error: `PDF okunamadı: ${err?.message || 'bilinmeyen hata'}` }, { status: 400 });
  }

  if (hamMetin.trim().length === 0) {
    return NextResponse.json({ error: 'PDF içinde okunabilir metin bulunamadı (taranmış görsel PDF olabilir)' }, { status: 400 });
  }

  const { baslikBilgisi, kalemler } = metniAyristir(hamMetin, parcalar);

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
      stok_adi: k.stok_adi,
      aciklama: k.aciklama,
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
