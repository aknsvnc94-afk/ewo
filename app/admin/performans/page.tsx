'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { parseBaskiBuffer, kalipKoduNormalize, kalipKoduKismiCikar } from '@/lib/kalipBaskiParse';
import { parseGecmisKpiBuffer } from '@/lib/kalipKpiGecmisParse';

type Kayit = {
  id: string; tezgah: string; kategori: string; baslangic: string; sure_sn: number;
  tamamlanma_durumu: string; kalip_kodu: string | null;
};

type BaskiKaydi = { kalip_kodu: string; kalip_kodu_normalize: string; ay: string; yt_baski: number | null; guncel_baski_toplam: number; ariza_sayisi_manuel: number | null };

type Sekme = 'mttr' | 'mtbf' | 'msbf' | 'duruslar';

function saniyeToOkunabilir(sn: number) {
  if (!sn || sn <= 0) return '0 dk';
  const saat = Math.floor(sn / 3600);
  const dk = Math.round((sn % 3600) / 60);
  if (saat > 0) return `${saat} sa ${dk} dk`;
  return `${dk} dk`;
}

function bugunISO(gunOnce = 0) {
  const d = new Date();
  d.setDate(d.getDate() - gunOnce);
  return d.toISOString().slice(0, 10);
}

function buAyYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PerformansPage() {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [sekme, setSekme] = useState<Sekme>('mttr');

  const [baslangicTarihi, setBaslangicTarihi] = useState(bugunISO(30));
  const [bitisTarihi, setBitisTarihi] = useState(bugunISO(0));
  const [kategoriFiltre, setKategoriFiltre] = useState('');
  const [tezgahFiltre, setTezgahFiltre] = useState('');

  const [msbfAy, setMsbfAy] = useState(buAyYYYYMM());
  const [ayVerisi, setAyVerisi] = useState<BaskiKaydi[]>([]); // sadece seçilen ayın kayıtları
  const [tumVeri, setTumVeri] = useState<BaskiKaydi[]>([]); // kümülatif (ömür boyu) özet için — seçilen aya kadarki tüm kayıtlar
  const [baskiYukleniyor, setBaskiYukleniyor] = useState(false);
  const [baskiMesaj, setBaskiMesaj] = useState('');

  const [gecmisYil, setGecmisYil] = useState(new Date().getFullYear());
  const [gecmisYukleniyor, setGecmisYukleniyor] = useState(false);
  const [gecmisMesaj, setGecmisMesaj] = useState('');
  const [temizleniyor, setTemizleniyor] = useState(false);

  async function verileriGetir(ay: string) {
    const [ayRes, tumRes] = await Promise.all([
      fetch(`/api/kalip-baski?ay=${ay}`),
      fetch(`/api/kalip-baski?ayaKadar=${ay}`),
    ]);
    const ayData = await ayRes.json();
    const tumData = await tumRes.json();
    setAyVerisi(ayData.kayitlar || []);
    setTumVeri(tumData.kayitlar || []);
  }

  const [mevcutAylar, setMevcutAylar] = useState<string[]>([]);

  useEffect(() => { verileriGetir(msbfAy); }, [msbfAy]);

  async function mevcutAylariGuncelle(otomatikSecEnSonAy = false) {
    const res = await fetch('/api/kalip-baski?ayaKadar=2099-12');
    const data = await res.json();
    const tumKayitlar: BaskiKaydi[] = data.kayitlar || [];
    if (tumKayitlar.length > 0) {
      const aylar = Array.from(new Set(tumKayitlar.map((k) => k.ay))).sort();
      setMevcutAylar(aylar);
      if (otomatikSecEnSonAy) setMsbfAy(aylar[aylar.length - 1]);
    }
  }

  // Sayfa ilk açıldığında, bugünün takvim ayı yerine SİSTEMDE KAYITLI EN SON ayı
  // otomatik seçer — böylece yükleme yapılıp sayfa yenilendiğinde veri "kaybolmuş"
  // gibi görünmez (sadece farklı bir aya bakılmış olur). Ayrıca mevcut ay listesini de doldurur.
  useEffect(() => {
    mevcutAylariGuncelle(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function baskiDosyaYukle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBaskiYukleniyor(true);
    setBaskiMesaj('Dosya okunuyor...');
    try {
      const buf = await file.arrayBuffer();
      const { kayitlar, toplamSatir, hata } = parseBaskiBuffer(buf);
      if (hata) { setBaskiMesaj(`Hata: ${hata}`); return; }
      if (kayitlar.length === 0) {
        setBaskiMesaj(`Toplam ${toplamSatir} satır tarandı, geçerli kalıp kodu bulunamadı.`);
        return;
      }
      setBaskiMesaj(`${kayitlar.length} kalıp bulundu, ${msbfAy} öncesiyle karşılaştırılıp gönderiliyor...`);
      const res = await fetch('/api/kalip-baski', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kayitlar, ay: msbfAy, hesaplaDelta: true }),
      });
      const data = await res.json();
      if (!res.ok) { setBaskiMesaj(`Hata: ${data.error}`); return; }
      setBaskiMesaj(`✓ ${data.islenen} kalıbın ${msbfAy} ayı verisi kaydedildi (o ayki baskı, bir önceki ayın kümülatif değeriyle farkı alınarak hesaplandı)`);
      verileriGetir(msbfAy);
      mevcutAylariGuncelle();
    } catch (err: any) {
      setBaskiMesaj(`Hata: Dosya okunamadı (${err?.message || 'bilinmeyen hata'})`);
    } finally {
      setBaskiYukleniyor(false);
      e.target.value = '';
    }
  }

  async function gecmisDosyaYukle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setGecmisYukleniyor(true);
    setGecmisMesaj('Dosya okunuyor...');
    try {
      const buf = await file.arrayBuffer();
      const { kayitlar, kalipSayisi, hata } = parseGecmisKpiBuffer(buf, gecmisYil);
      if (hata) { setGecmisMesaj(`Hata: ${hata}`); return; }
      setGecmisMesaj(`${kalipSayisi} kalıba ait ${kayitlar.length} aylık kayıt bulundu, gönderiliyor...`);
      const res = await fetch('/api/kalip-baski', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kayitlar, hesaplaDelta: false }),
      });
      const data = await res.json();
      if (!res.ok) { setGecmisMesaj(`Hata: ${data.error}`); return; }
      setGecmisMesaj(`✓ ${kalipSayisi} kalıbın geçmiş ay verileri (${data.islenen} kayıt) içe aktarıldı`);
      verileriGetir(msbfAy);
      mevcutAylariGuncelle();
    } catch (err: any) {
      setGecmisMesaj(`Hata: Dosya okunamadı (${err?.message || 'bilinmeyen hata'})`);
    } finally {
      setGecmisYukleniyor(false);
      e.target.value = '';
    }
  }

  async function tumVerileriTemizle() {
    if (!confirm('Tüm kalıp baskı sayısı verilerini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
    setTemizleniyor(true);
    try {
      const res = await fetch('/api/kalip-baski', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setBaskiMesaj(`Hata: ${data.error}`); return; }
      setBaskiMesaj(`✓ ${data.silinen} kayıt silindi`);
      verileriGetir(msbfAy);
      mevcutAylariGuncelle();
    } finally {
      setTemizleniyor(false);
    }
  }

  // Seçilen ayın TAM İÇİNDE (o ay başı - o ay sonu) oluşan KA arızalarını kalıp koduna göre say
  const buAyArizaSayaci = useMemo(() => {
    const [yil, ayNo] = msbfAy.split('-').map(Number);
    const sayac: Record<string, number> = {};
    kayitlar.forEach((k) => {
      if (k.kategori !== 'KA' || !k.kalip_kodu || !k.baslangic) return;
      const t = new Date(k.baslangic);
      if (t.getFullYear() !== yil || t.getMonth() + 1 !== ayNo) return;
      const norm = kalipKoduNormalize(kalipKoduKismiCikar(k.kalip_kodu));
      sayac[norm] = (sayac[norm] || 0) + 1;
    });
    return sayac;
  }, [kayitlar, msbfAy]);

  // Seçilen AYA KADAR (ömür boyu) oluşan KA arızalarını kalıp koduna göre kümülatif say
  const kumulatifArizaSayaci = useMemo(() => {
    const [yil, ayNo] = msbfAy.split('-').map(Number);
    const ayinSonu = new Date(yil, ayNo, 0, 23, 59, 59);
    const sayac: Record<string, number> = {};
    kayitlar.forEach((k) => {
      if (k.kategori !== 'KA' || !k.kalip_kodu || !k.baslangic) return;
      const t = new Date(k.baslangic);
      if (t > ayinSonu) return;
      const norm = kalipKoduNormalize(kalipKoduKismiCikar(k.kalip_kodu));
      sayac[norm] = (sayac[norm] || 0) + 1;
    });
    return sayac;
  }, [kayitlar, msbfAy]);

  // TEŞHİS: EWO'daki TÜM KA (kalıp arızası) kayıtlarının HAM kalıp kodu değerleri
  // (normalize edilmeden) — sistemde gerçekten ne yazdığını görmek için
  const hamKalipKoduListesi = useMemo(() => {
    const liste: { ham: string; normalize: string; adet: number }[] = [];
    const gruplar: Record<string, { ham: string; adet: number }> = {};
    kayitlar.forEach((k) => {
      if (k.kategori !== 'KA' || !k.kalip_kodu) return;
      const norm = kalipKoduNormalize(kalipKoduKismiCikar(k.kalip_kodu));
      if (!gruplar[norm]) gruplar[norm] = { ham: k.kalip_kodu, adet: 0 };
      gruplar[norm].adet += 1;
    });
    Object.entries(gruplar).forEach(([norm, g]) => liste.push({ ham: g.ham, normalize: norm, adet: g.adet }));
    return liste.sort((a, b) => b.adet - a.adet);
  }, [kayitlar]);

  // AYLIK: seçilen ayın kendi verileri (o ay baskı / o ay arıza / o ayki MSBF)
  const msbfAylikSonuclar = useMemo(() => {
    const map: Record<string, { ayBaskisi: number | null; ayArizaSayisi: number; ayMsbf: number | null; kaynak: string }> = {};
    ayVerisi.forEach((b) => {
      const arizaSayisi = b.ariza_sayisi_manuel ?? (buAyArizaSayaci[b.kalip_kodu_normalize] || 0);
      const ayBaskisi = b.yt_baski;
      const msbf = ayBaskisi !== null && arizaSayisi > 0 ? ayBaskisi / arizaSayisi : null;
      map[b.kalip_kodu_normalize] = {
        ayBaskisi, ayArizaSayisi: arizaSayisi, ayMsbf: msbf,
        kaynak: b.ariza_sayisi_manuel !== null && b.ariza_sayisi_manuel !== undefined ? 'İçe Aktarılan' : 'EWO (Canlı)',
      };
    });
    return map;
  }, [ayVerisi, buAyArizaSayaci]);

  // BİRLEŞİK tablo: her kalıp için hem bu ayki hem ömür boyu (kümülatif) MSBF yan yana
  const msbfBirlesikSonuclar = useMemo(() => {
    const enSonMap: Record<string, BaskiKaydi> = {};
    [...tumVeri].sort((a, b) => a.ay.localeCompare(b.ay)).forEach((b) => {
      enSonMap[b.kalip_kodu_normalize] = b; // en son (en büyük ay) kayıt kalır
    });
    const manuelToplamMap: Record<string, number> = {};
    const herhangiManuelVarMi: Record<string, boolean> = {};
    tumVeri.forEach((b) => {
      if (b.ariza_sayisi_manuel !== null && b.ariza_sayisi_manuel !== undefined) {
        manuelToplamMap[b.kalip_kodu_normalize] = (manuelToplamMap[b.kalip_kodu_normalize] || 0) + b.ariza_sayisi_manuel;
        herhangiManuelVarMi[b.kalip_kodu_normalize] = true;
      }
    });

    return Object.entries(enSonMap)
      .map(([norm, b]) => {
        const omurArizaSayisi = herhangiManuelVarMi[norm] ? manuelToplamMap[norm] : (kumulatifArizaSayaci[norm] || 0);
        const omurMsbf = omurArizaSayisi > 0 && b.guncel_baski_toplam !== null ? b.guncel_baski_toplam / omurArizaSayisi : null;
        const ay = msbfAylikSonuclar[norm];
        return {
          kalip_kodu: b.kalip_kodu, kalip_kodu_normalize: norm,
          ayBaskisi: ay?.ayBaskisi ?? null, ayArizaSayisi: ay?.ayArizaSayisi ?? 0, ayMsbf: ay?.ayMsbf ?? null,
          omurBaski: b.guncel_baski_toplam ?? 0, omurArizaSayisi, omurMsbf,
          kaynak: ay?.kaynak ?? (herhangiManuelVarMi[norm] ? 'İçe Aktarılan' : 'EWO (Canlı)'),
        };
      })
      .sort((a, b) => {
        if (a.omurMsbf === null) return 1;
        if (b.omurMsbf === null) return -1;
        return a.omurMsbf - b.omurMsbf;
      });
  }, [tumVeri, kumulatifArizaSayaci, msbfAylikSonuclar]);

  const [genisletilenKalip, setGenisletilenKalip] = useState<string | null>(null);

  const [tabanBaski, setTabanBaski] = useState(6500757);
  const [tabanAriza, setTabanAriza] = useState(499);
  const [tabanAciklama, setTabanAciklama] = useState('Diğer aylardan gelen kümülatif toplam');
  const [tabanDuzenleniyor, setTabanDuzenleniyor] = useState(false);
  const [tabanKaydediliyor, setTabanKaydediliyor] = useState(false);

  async function tabanDegerleriGetir() {
    const res = await fetch('/api/msbf-taban');
    const data = await res.json();
    // Veritabanında henüz kayıtlı bir taban değer yoksa (0/0), sayfadaki
    // varsayılan (önceden konuşulan) değerleri koru — üzerine yazma.
    if (data.taban && (data.taban.taban_baski || data.taban.taban_ariza)) {
      setTabanBaski(data.taban.taban_baski || 0);
      setTabanAriza(data.taban.taban_ariza || 0);
      setTabanAciklama(data.taban.aciklama || '');
    }
  }

  useEffect(() => { tabanDegerleriGetir(); }, []);

  async function tabanKaydet() {
    setTabanKaydediliyor(true);
    try {
      await fetch('/api/msbf-taban', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taban_baski: tabanBaski, taban_ariza: tabanAriza, aciklama: tabanAciklama }),
      });
      setTabanDuzenleniyor(false);
    } finally {
      setTabanKaydediliyor(false);
    }
  }

  // Her kalıp için, o kalıba ait TÜM ayların (yüklü olan) ay bazlı baskı/arıza/MSBF
  // dökümü — satıra tıklayınca açılan detay için
  const kalipAylikGecmisMap = useMemo(() => {
    const map: Record<string, { ay: string; guncel: number; baski: number | null; ariza: number; msbf: number | null; kalip_kodu: string }[]> = {};

    function oAyinCanliArizaSayaci(yil: number, ayNo: number) {
      const sayac: Record<string, number> = {};
      kayitlar.forEach((k) => {
        if (k.kategori !== 'KA' || !k.kalip_kodu || !k.baslangic) return;
        const t = new Date(k.baslangic);
        if (t.getFullYear() !== yil || t.getMonth() + 1 !== ayNo) return;
        const norm = kalipKoduNormalize(kalipKoduKismiCikar(k.kalip_kodu));
        sayac[norm] = (sayac[norm] || 0) + 1;
      });
      return sayac;
    }

    const ayGruplari: Record<string, BaskiKaydi[]> = {};
    tumVeri.forEach((b) => {
      if (!ayGruplari[b.ay]) ayGruplari[b.ay] = [];
      ayGruplari[b.ay].push(b);
    });

    Object.entries(ayGruplari).forEach(([ay, kayitlarBuAy]) => {
      const [yil, ayNo] = ay.split('-').map(Number);
      const canliSayac = oAyinCanliArizaSayaci(yil, ayNo);
      kayitlarBuAy.forEach((b) => {
        const ariza = b.ariza_sayisi_manuel ?? (canliSayac[b.kalip_kodu_normalize] || 0);
        const msbf = b.yt_baski !== null && ariza > 0 ? b.yt_baski / ariza : null;
        if (!map[b.kalip_kodu_normalize]) map[b.kalip_kodu_normalize] = [];
        map[b.kalip_kodu_normalize].push({ ay, guncel: b.guncel_baski_toplam ?? 0, baski: b.yt_baski, ariza, msbf, kalip_kodu: b.kalip_kodu });
      });
    });

    Object.values(map).forEach((liste) => liste.sort((a, b) => a.ay.localeCompare(b.ay)));
    return map;
  }, [tumVeri, kayitlar]);

  // Tabloda satır olarak gösterilecek tüm kalıp kodları (herhangi bir ayda veri yüklenmiş olan)
  const tumKalipListesi = useMemo(() => {
    const adMap: Record<string, string> = {};
    tumVeri.forEach((b) => { adMap[b.kalip_kodu_normalize] = b.kalip_kodu; });
    return Object.entries(adMap)
      .map(([norm, kod]) => ({ norm, kod }))
      .sort((a, b) => a.kod.localeCompare(b.kod));
  }, [tumVeri]);

  const msbfGoruntulenen = msbfBirlesikSonuclar; // artık her zaman sadece Fompak/Martur

  // Genel Toplam MSBF = Taban Değer + (SEÇİLEN AYDA tüm kalıplarda oluşan toplam)
  // Not: "ömür boyu" (kümülatif ERP değeri) DEĞİL, o ayki gerçekleşen (fark alınmış) değerler kullanılır.
  const genelOrtalamaMsbf = useMemo(() => {
    const toplamAyBaski = msbfBirlesikSonuclar.reduce((t, s) => t + (s.ayBaskisi ?? 0), 0);
    const toplamAyAriza = msbfBirlesikSonuclar.reduce((t, s) => t + s.ayArizaSayisi, 0);
    const toplamBaski = toplamAyBaski + tabanBaski;
    const toplamAriza = toplamAyAriza + tabanAriza;
    return { toplamBaski, toplamAriza, msbf: toplamAriza > 0 ? toplamBaski / toplamAriza : null };
  }, [msbfBirlesikSonuclar, tabanBaski, tabanAriza]);

  // Teşhis: bu ay KA arızası olan ama baskı verisi hiç yüklenmemiş Fompak/Martur kalıp kodları
  // (sadece FOM/MAR gösteriliyor çünkü bu özellik yalnızca bu iki müşteri için kapsamlı)
  const eslesmeyenKalipKodlari = useMemo(() => {
    const yuklenenSet = new Set(tumVeri.map((b) => b.kalip_kodu_normalize));
    const eksikler = new Set<string>();
    Object.keys(kumulatifArizaSayaci).forEach((norm) => {
      if (!(norm.startsWith('FOM') || norm.startsWith('MAR'))) return;
      if (!yuklenenSet.has(norm)) eksikler.add(norm);
    });
    return Array.from(eksikler);
  }, [tumVeri, kumulatifArizaSayaci]);

  useEffect(() => {
    fetch('/api/records').then((r) => r.json()).then((data) => {
      setKayitlar(data.kayitlar || []);
      setYukleniyor(false);
    });
  }, []);

  const tezgahListesi = useMemo(
    () => Array.from(new Set(kayitlar.map((k) => k.tezgah).filter(Boolean))).sort(),
    [kayitlar]
  );

  const filtrelenmis = useMemo(() => {
    const bas = new Date(baslangicTarihi + 'T00:00:00');
    const bit = new Date(bitisTarihi + 'T23:59:59');
    return kayitlar.filter((k) => {
      if (!k.baslangic) return false;
      const t = new Date(k.baslangic);
      if (t < bas || t > bit) return false;
      if (kategoriFiltre && k.kategori !== kategoriFiltre) return false;
      if (tezgahFiltre && k.tezgah !== tezgahFiltre) return false;
      return true;
    });
  }, [kayitlar, baslangicTarihi, bitisTarihi, kategoriFiltre, tezgahFiltre]);

  const donemSaniye = useMemo(() => {
    const bas = new Date(baslangicTarihi + 'T00:00:00').getTime();
    const bit = new Date(bitisTarihi + 'T23:59:59').getTime();
    return Math.max(1, (bit - bas) / 1000);
  }, [baslangicTarihi, bitisTarihi]);

  // Tezgah bazında gruplama
  const tezgahGruplari = useMemo(() => {
    const map: Record<string, { adet: number; toplamSure: number }> = {};
    filtrelenmis.forEach((k) => {
      if (!map[k.tezgah]) map[k.tezgah] = { adet: 0, toplamSure: 0 };
      map[k.tezgah].adet += 1;
      map[k.tezgah].toplamSure += k.sure_sn || 0;
    });
    return map;
  }, [filtrelenmis]);

  const genelAdet = filtrelenmis.length;
  const genelToplamSure = filtrelenmis.reduce((t, k) => t + (k.sure_sn || 0), 0);
  const genelMTTR = genelAdet > 0 ? genelToplamSure / genelAdet : 0;
  const genelMTBF = genelAdet > 0 ? Math.max(0, (donemSaniye - genelToplamSure) / genelAdet) : 0;

  const mttrSiralamasi = useMemo(() => {
    return Object.entries(tezgahGruplari)
      .map(([tezgah, g]) => ({ tezgah, mttr: g.toplamSure / g.adet, adet: g.adet }))
      .sort((a, b) => b.mttr - a.mttr);
  }, [tezgahGruplari]);

  const mtbfSiralamasi = useMemo(() => {
    return Object.entries(tezgahGruplari)
      .map(([tezgah, g]) => ({ tezgah, mtbf: Math.max(0, (donemSaniye - g.toplamSure) / g.adet), adet: g.adet }))
      .sort((a, b) => a.mtbf - b.mtbf); // en düşük MTBF (en sorunlu) üstte
  }, [tezgahGruplari, donemSaniye]);

  const duruşSiralamasi = useMemo(() => {
    return Object.entries(tezgahGruplari)
      .map(([tezgah, g]) => ({ tezgah, toplamSure: g.toplamSure, adet: g.adet }))
      .sort((a, b) => b.toplamSure - a.toplamSure);
  }, [tezgahGruplari]);

  const enUzunArizalar = useMemo(() => {
    return [...filtrelenmis].sort((a, b) => (b.sure_sn || 0) - (a.sure_sn || 0)).slice(0, 10);
  }, [filtrelenmis]);

  const maksMttr = Math.max(1, ...mttrSiralamasi.map((s) => s.mttr));
  const maksDurus = Math.max(1, ...duruşSiralamasi.map((s) => s.toplamSure));

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Performans Göstergeleri</h1>
        <Link href="/admin"><button className="secondary">← Panele Dön</button></Link>
      </div>
      <p className="muted">MTTR, MTBF ve arıza duruş süreleri — seçilen tarih aralığı ve filtrelere göre hesaplanır.</p>

      {sekme !== 'msbf' && (
        <div className="card">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <label className="muted">Başlangıç Tarihi
              <input type="date" value={baslangicTarihi} onChange={(e) => setBaslangicTarihi(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
            </label>
            <label className="muted">Bitiş Tarihi
              <input type="date" value={bitisTarihi} onChange={(e) => setBitisTarihi(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
            </label>
            <label className="muted">Kategori
              <select value={kategoriFiltre} onChange={(e) => setKategoriFiltre(e.target.value)} style={{ display: 'block', marginTop: 4 }}>
                <option value="">Tüm Kategoriler</option>
                <option value="MA">MA - Makine Arızası</option>
                <option value="BA">BA - Montaj Banko Arızası</option>
                <option value="KA">KA - Kalıp Arızası</option>
                <option value="RA">RA - Robot Arızası</option>
                <option value="GT">GT - Genel Tesis</option>
              </select>
            </label>
            <label className="muted">Makine
              <select value={tezgahFiltre} onChange={(e) => setTezgahFiltre(e.target.value)} style={{ display: 'block', marginTop: 4 }}>
                <option value="">Tüm Makineler</option>
                {tezgahListesi.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      <div className="row" style={{ marginBottom: 14 }}>
        <button className={sekme === 'mttr' ? '' : 'secondary'} onClick={() => setSekme('mttr')}>MTTR</button>
        <button className={sekme === 'mtbf' ? '' : 'secondary'} onClick={() => setSekme('mtbf')}>MTBF</button>
        <button className={sekme === 'msbf' ? '' : 'secondary'} onClick={() => setSekme('msbf')}>MSBF (Kalıp)</button>
        <button className={sekme === 'duruslar' ? '' : 'secondary'} onClick={() => setSekme('duruslar')}>Arıza Duruş Süreleri</button>
      </div>

      {sekme === 'msbf' ? (
        <>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>Kalıp Baskı Sayısı Excel Yükle (Aylık)</h3>
              <button className="danger" onClick={tumVerileriTemizle} disabled={temizleniyor}>
                {temizleniyor ? 'Siliniyor...' : 'Tüm Baskı Verilerini Temizle'}
              </button>
            </div>
            <p className="muted">
              Kalıp Kodu ve YT_Baskı (ERP'nin verdiği <strong>kümülatif</strong> değer) sütunlarını içeren dosyayı,
              ilgili ayı seçip yükleyin. O ayki gerçek baskı sayısı, bir önceki yüklü ayın kümülatif değeriyle
              farkı alınarak otomatik hesaplanır.
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <label className="muted">Yükleme/Görüntüleme Ayı
                <input type="month" value={msbfAy} onChange={(e) => setMsbfAy(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
              </label>
              {mevcutAylar.length > 0 && (
                <label className="muted">Veya Mevcut Aylardan Seç
                  <select value={mevcutAylar.includes(msbfAy) ? msbfAy : ''} onChange={(e) => setMsbfAy(e.target.value)} style={{ display: 'block', marginTop: 4 }}>
                    <option value="" disabled>Ay seçin...</option>
                    {mevcutAylar.map((ay) => <option key={ay} value={ay}>{ay}</option>)}
                  </select>
                </label>
              )}
              <label className="muted">Dosya
                <input type="file" accept=".xlsx,.xls" onChange={baskiDosyaYukle} disabled={baskiYukleniyor} style={{ display: 'block', marginTop: 4 }} />
              </label>
            </div>
            {baskiMesaj && <p style={{ marginTop: 10 }}>{baskiMesaj}</p>}
          </div>

          <div className="card" style={{ borderColor: 'var(--accent)' }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700 }}>
                  {genelOrtalamaMsbf.msbf !== null ? Math.round(genelOrtalamaMsbf.msbf).toLocaleString('tr-TR') : '-'}
                </div>
                <div className="muted">
                  Genel Toplam MSBF ({msbfAy} itibarıyla) = Taban Değer + {msbfAy} Ayında Oluşan Toplam
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {genelOrtalamaMsbf.toplamBaski.toLocaleString('tr-TR')} baskı / {genelOrtalamaMsbf.toplamAriza.toLocaleString('tr-TR')} arıza
                  {' '}(Taban: {tabanBaski.toLocaleString('tr-TR')} baskı / {tabanAriza.toLocaleString('tr-TR')} arıza)
                </div>
              </div>
              <button className="secondary" onClick={() => setTabanDuzenleniyor(!tabanDuzenleniyor)}>
                {tabanDuzenleniyor ? 'Kapat' : 'Taban Değeri Düzenle'}
              </button>
            </div>
            {tabanDuzenleniyor && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <p className="muted">
                  Diğer aylardan/kaynaklardan gelen kümülatif baskı ve arıza sayısını buraya girin.
                  Bu değer, <strong>seçilen ayda oluşan toplam</strong> ile toplanarak Genel Toplam MSBF'yi oluşturur
                  (sistemdeki kalıpların ömür boyu kümülatif değeriyle karıştırılmaz).
                </p>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <label className="muted">Taban Baskı Sayısı
                    <input type="number" value={tabanBaski} onChange={(e) => setTabanBaski(Number(e.target.value))} style={{ display: 'block', marginTop: 4, width: 160 }} />
                  </label>
                  <label className="muted">Taban Arıza Sayısı
                    <input type="number" value={tabanAriza} onChange={(e) => setTabanAriza(Number(e.target.value))} style={{ display: 'block', marginTop: 4, width: 120 }} />
                  </label>
                </div>
                <label className="muted" style={{ display: 'block', marginTop: 8 }}>Açıklama (opsiyonel)
                  <input value={tabanAciklama} onChange={(e) => setTabanAciklama(e.target.value)} placeholder="örn. Ocak-Nisan diğer kaynaklardan gelen toplam" style={{ display: 'block', marginTop: 4, width: '100%' }} />
                </label>
                <button style={{ marginTop: 10 }} onClick={tabanKaydet} disabled={tabanKaydediliyor}>
                  {tabanKaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            )}
          </div>

          <details className="card">
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>🔍 Teşhis: EWO'daki KA Arızalarının Kalıp Kodları (Ham Veri)</summary>
            <p className="muted" style={{ marginTop: 10 }}>
              Bu liste, EWO Arıza Kayıtları'ndaki (kategori=KA) kalıp kodu alanının <strong>tam olarak ne yazdığını</strong>
              gösterir — baskı sayısı Excel'indeki kodlarla (örn. FOM001, FOM-008) karşılaştırıp format farkı olup
              olmadığını görebilirsiniz. Toplam {hamKalipKoduListesi.length} farklı kalıp kodu, tüm zamanlar.
            </p>
            {hamKalipKoduListesi.length === 0 ? (
              <p className="muted" style={{ color: 'var(--danger)' }}>
                EWO'da hiç KA (Kalıp Arızası) kaydı bulunamadı — ya hiç arıza yüklenmemiş ya da hiçbirinde kalıp kodu alanı dolu değil.
              </p>
            ) : (
              <table>
                <thead><tr><th>Ham Kalıp Kodu (EWO'daki hali)</th><th>Normalize Edilmiş Hali</th><th>Arıza Sayısı</th></tr></thead>
                <tbody>
                  {hamKalipKoduListesi.slice(0, 50).map((h) => (
                    <tr key={h.normalize}>
                      <td style={{ fontFamily: 'monospace' }}>{h.ham}</td>
                      <td style={{ fontFamily: 'monospace' }} className="muted">{h.normalize}</td>
                      <td>{h.adet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {hamKalipKoduListesi.length > 50 && <p className="muted">...ve {hamKalipKoduListesi.length - 50} tane daha (sadece ilk 50 gösteriliyor)</p>}
          </details>

          <details className="card">
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Geçmiş Ay Verilerini Toplu İçe Aktar (Ocak-Mayıs vb.)</summary>
            <p className="muted" style={{ marginTop: 10 }}>
              İlk KPI dosyanız gibi aylık blok yapılı bir Excel'den, sadece Fompak (FOM) ve Martur (MAR) kalıplarının
              dolu olan aylarını (o ay gerçekleşen baskı, güncel kümülatif baskı ve arıza sayısı) toplu olarak içe aktarır.
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <label className="muted">Yıl
                <input type="number" value={gecmisYil} onChange={(e) => setGecmisYil(Number(e.target.value))} style={{ display: 'block', marginTop: 4, width: 100 }} />
              </label>
              <label className="muted">Dosya
                <input type="file" accept=".xlsx,.xls" onChange={gecmisDosyaYukle} disabled={gecmisYukleniyor} style={{ display: 'block', marginTop: 4 }} />
              </label>
            </div>
            {gecmisMesaj && <p style={{ marginTop: 10 }}>{gecmisMesaj}</p>}
          </details>

          <div className="card" style={{ overflowX: 'auto' }}>
            <h3>Fompak + Martur — Kalıp Bazında Aylık Baskı ve MSBF Tablosu ({tumKalipListesi.length} kalıp)</h3>
            <p className="muted">
              Sol taraf: her ayın ERP'den yüklenen ham kümülatif baskı sayısı, ay ay yan yana ilerler.
              Sağ taraf: ikinci aydan itibaren, bir önceki ayın kümülatif değeri çıkarılarak hesaplanan
              o ayki gerçek baskı sayısı, arıza sayısı ve MSBF.
            </p>
            {tumKalipListesi.length === 0 || mevcutAylar.length === 0 ? (
              <p className="muted">Henüz baskı sayısı yüklenmedi.</p>
            ) : (
              <table style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ verticalAlign: 'bottom' }}>Kalıp Kodu</th>
                    <th colSpan={mevcutAylar.length} style={{ textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      ERP Baskı Sayıları (Kümülatif)
                    </th>
                    {mevcutAylar.slice(1).map((ay) => (
                      <th key={ay} colSpan={3} style={{ textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        {ay} Aylık Hesaplanan
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {mevcutAylar.map((ay) => <th key={ay}>{ay}</th>)}
                    {mevcutAylar.slice(1).map((ay) => (
                      <React.Fragment key={ay}>
                        <th>Baskı</th><th>Arıza</th><th>MSBF</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tumKalipListesi.map(({ norm, kod }) => {
                    const gecmis = kalipAylikGecmisMap[norm] || [];
                    const ayMap: Record<string, { guncel: number; baski: number | null; ariza: number; msbf: number | null }> = {};
                    gecmis.forEach((g) => { ayMap[g.ay] = g; });
                    return (
                      <tr key={norm}>
                        <td>{kod}</td>
                        {mevcutAylar.map((ay) => (
                          <td key={ay}>
                            {ayMap[ay] ? ayMap[ay].guncel.toLocaleString('tr-TR') : <span className="muted">-</span>}
                          </td>
                        ))}
                        {mevcutAylar.slice(1).map((ay) => {
                          const g = ayMap[ay];
                          return (
                            <React.Fragment key={ay}>
                              <td>{g && g.baski !== null ? g.baski.toLocaleString('tr-TR') : <span className="muted">-</span>}</td>
                              <td>{g ? g.ariza : <span className="muted">-</span>}</td>
                              <td className={g && g.ariza > 0 ? '' : 'muted'}>
                                {g && g.msbf !== null ? Math.round(g.msbf).toLocaleString('tr-TR') : '-'}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : yukleniyor ? <p className="muted">Yükleniyor...</p> : genelAdet === 0 ? (
        <div className="card"><p className="muted">Seçilen filtrelerde kayıt bulunamadı.</p></div>
      ) : (
        <>
          {sekme === 'mttr' && (
            <>
              <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
                <div className="card" style={{ flex: 1, minWidth: 160, textAlign: 'center', margin: 0 }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{saniyeToOkunabilir(genelMTTR)}</div>
                  <div className="muted">Genel MTTR (Ortalama Onarım Süresi)</div>
                </div>
                <div className="card" style={{ flex: 1, minWidth: 160, textAlign: 'center', margin: 0 }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{genelAdet}</div>
                  <div className="muted">Toplam Arıza Sayısı</div>
                </div>
              </div>
              <div className="card">
                <h3>Makine Bazında MTTR (En Uzun → En Kısa)</h3>
                <p className="muted">Yüksek MTTR, o makinedeki arızaların ortalama olarak daha uzun sürede giderildiğini gösterir.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {mttrSiralamasi.map((s) => (
                    <div key={s.tezgah}>
                      <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                        <span>{s.tezgah}</span>
                        <span className="muted">{saniyeToOkunabilir(s.mttr)} · {s.adet} arıza</span>
                      </div>
                      <div style={{ background: 'var(--panel-2)', borderRadius: 6, overflow: 'hidden', height: 16 }}>
                        <div style={{ width: `${(s.mttr / maksMttr) * 100}%`, background: 'var(--warn)', height: '100%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {sekme === 'mtbf' && (
            <>
              <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
                <div className="card" style={{ flex: 1, minWidth: 160, textAlign: 'center', margin: 0 }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{saniyeToOkunabilir(genelMTBF)}</div>
                  <div className="muted">Genel MTBF (Arızalar Arası Ortalama Süre)</div>
                </div>
                <div className="card" style={{ flex: 1, minWidth: 160, textAlign: 'center', margin: 0 }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{genelAdet}</div>
                  <div className="muted">Toplam Arıza Sayısı</div>
                </div>
              </div>
              <div className="card" style={{ borderColor: 'var(--border)' }}>
                <p className="muted" style={{ margin: 0 }}>
                  ⓘ MTBF, seçilen dönemin takvim süresinden toplam arıza süresi çıkarılarak yaklaşık olarak hesaplanır
                  (gerçek makine çalışma/duruş telemetrisi olmadığından bu bir yaklaşımdır).
                </p>
              </div>
              <div className="card">
                <h3>Makine Bazında MTBF (En Düşük → En Yüksek)</h3>
                <p className="muted">Düşük MTBF, o makinenin diğerlerine göre daha sık arıza yaptığını gösterir — önceliklendirme için kullanılabilir.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {mtbfSiralamasi.map((s) => {
                    const maksMtbf = Math.max(1, ...mtbfSiralamasi.map((x) => x.mtbf));
                    return (
                      <div key={s.tezgah}>
                        <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                          <span>{s.tezgah}</span>
                          <span className="muted">{saniyeToOkunabilir(s.mtbf)} · {s.adet} arıza</span>
                        </div>
                        <div style={{ background: 'var(--panel-2)', borderRadius: 6, overflow: 'hidden', height: 16 }}>
                          <div style={{ width: `${(s.mtbf / maksMtbf) * 100}%`, background: 'var(--danger)', height: '100%' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {sekme === 'duruslar' && (
            <>
              <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
                <div className="card" style={{ flex: 1, minWidth: 160, textAlign: 'center', margin: 0 }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{saniyeToOkunabilir(genelToplamSure)}</div>
                  <div className="muted">Toplam Duruş Süresi</div>
                </div>
                <div className="card" style={{ flex: 1, minWidth: 160, textAlign: 'center', margin: 0 }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{genelAdet}</div>
                  <div className="muted">Toplam Arıza Sayısı</div>
                </div>
              </div>
              <div className="card">
                <h3>Makine Bazında Toplam Duruş Süresi</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {duruşSiralamasi.map((s) => (
                    <div key={s.tezgah}>
                      <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                        <span>{s.tezgah}</span>
                        <span className="muted">{saniyeToOkunabilir(s.toplamSure)} · {s.adet} arıza</span>
                      </div>
                      <div style={{ background: 'var(--panel-2)', borderRadius: 6, overflow: 'hidden', height: 16 }}>
                        <div style={{ width: `${(s.toplamSure / maksDurus) * 100}%`, background: 'var(--accent)', height: '100%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <h3>En Uzun Süren 10 Arıza</h3>
                <table>
                  <thead><tr><th>Makine</th><th>Kategori</th><th>Başlangıç</th><th>Süre</th></tr></thead>
                  <tbody>
                    {enUzunArizalar.map((k) => (
                      <tr key={k.id}>
                        <td>{k.tezgah}</td>
                        <td><span className={`badge badge-${k.kategori}`}>{k.kategori}</span></td>
                        <td>{new Date(k.baslangic).toLocaleString('tr-TR')}</td>
                        <td>{saniyeToOkunabilir(k.sure_sn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
