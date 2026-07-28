'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { parseBaskiBuffer, kalipKoduNormalize } from '@/lib/kalipBaskiParse';
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

  useEffect(() => { verileriGetir(msbfAy); }, [msbfAy]);

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
      const norm = kalipKoduNormalize(k.kalip_kodu);
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
      const norm = kalipKoduNormalize(k.kalip_kodu);
      sayac[norm] = (sayac[norm] || 0) + 1;
    });
    return sayac;
  }, [kayitlar, msbfAy]);

  // AYLIK tablo: seçilen ayın kendi verileri (Güncel Baskı / O Ay Baskı / Arıza / MSBF)
  const msbfAylikSonuclar = useMemo(() => {
    return ayVerisi
      .map((b) => {
        const arizaSayisi = b.ariza_sayisi_manuel ?? (buAyArizaSayaci[b.kalip_kodu_normalize] || 0);
        const ayBaskisi = b.yt_baski; // null olabilir (ilk yüklenen ay, önceki veri yoksa)
        const msbf = ayBaskisi !== null && arizaSayisi > 0 ? ayBaskisi / arizaSayisi : null;
        return {
          kalip_kodu: b.kalip_kodu, kalip_kodu_normalize: b.kalip_kodu_normalize,
          guncelToplam: b.guncel_baski_toplam, ayBaskisi, arizaSayisi, msbf,
          kaynak: b.ariza_sayisi_manuel !== null && b.ariza_sayisi_manuel !== undefined ? 'İçe Aktarılan' : 'EWO (Canlı)',
        };
      })
      .sort((a, b) => {
        if (a.msbf === null) return 1;
        if (b.msbf === null) return -1;
        return a.msbf - b.msbf;
      });
  }, [ayVerisi, buAyArizaSayaci]);

  // KÜMÜLATİF (ömür boyu) özet: her kalıp için EN SON güncel (kümülatif) baskı değeri
  // (zaten kümülatif olduğu için toplanmaz, en güncel kayıt alınır) / o ana kadarki toplam arıza
  const msbfKumulatifSonuclar = useMemo(() => {
    const enSonMap: Record<string, BaskiKaydi> = {};
    [...tumVeri].sort((a, b) => a.ay.localeCompare(b.ay)).forEach((b) => {
      enSonMap[b.kalip_kodu_normalize] = b; // en son (en büyük ay) kayıt kalır
    });
    const manuelToplamMap: Record<string, number> = {};
    let herhangiManuelVarMi: Record<string, boolean> = {};
    tumVeri.forEach((b) => {
      if (b.ariza_sayisi_manuel !== null && b.ariza_sayisi_manuel !== undefined) {
        manuelToplamMap[b.kalip_kodu_normalize] = (manuelToplamMap[b.kalip_kodu_normalize] || 0) + b.ariza_sayisi_manuel;
        herhangiManuelVarMi[b.kalip_kodu_normalize] = true;
      }
    });

    return Object.entries(enSonMap)
      .map(([norm, b]) => {
        const arizaSayisi = herhangiManuelVarMi[norm] ? manuelToplamMap[norm] : (kumulatifArizaSayaci[norm] || 0);
        const msbf = arizaSayisi > 0 ? b.guncel_baski_toplam / arizaSayisi : null;
        return { kalip_kodu: b.kalip_kodu, kalip_kodu_normalize: norm, guncelToplam: b.guncel_baski_toplam, arizaSayisi, msbf };
      })
      .sort((a, b) => {
        if (a.msbf === null) return 1;
        if (b.msbf === null) return -1;
        return a.msbf - b.msbf;
      });
  }, [tumVeri, kumulatifArizaSayaci]);

  const genelOrtalamaMsbf = useMemo(() => {
    const gecerli = msbfKumulatifSonuclar.filter((s) => s.msbf !== null);
    const toplamBaski = gecerli.reduce((t, s) => t + s.guncelToplam, 0);
    const toplamAriza = gecerli.reduce((t, s) => t + s.arizaSayisi, 0);
    return toplamAriza > 0 ? toplamBaski / toplamAriza : null;
  }, [msbfKumulatifSonuclar]);

  const fomMarOrtalamaMsbf = useMemo(() => {
    const fomMar = msbfKumulatifSonuclar.filter((s) => s.kalip_kodu_normalize.startsWith('FOM') || s.kalip_kodu_normalize.startsWith('MAR'));
    const gecerli = fomMar.filter((s) => s.msbf !== null);
    const toplamBaski = gecerli.reduce((t, s) => t + s.guncelToplam, 0);
    const toplamAriza = gecerli.reduce((t, s) => t + s.arizaSayisi, 0);
    return { adet: fomMar.length, msbf: toplamAriza > 0 ? toplamBaski / toplamAriza : null };
  }, [msbfKumulatifSonuclar]);

  // Teşhis: bu ay KA arızası olan ama baskı verisi hiç yüklenmemiş kalıp kodları
  const eslesmeyenKalipKodlari = useMemo(() => {
    const yuklenenSet = new Set(tumVeri.map((b) => b.kalip_kodu_normalize));
    const eksikler = new Set<string>();
    Object.keys(kumulatifArizaSayaci).forEach((norm) => {
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
              <label className="muted">Ay
                <input type="month" value={msbfAy} onChange={(e) => setMsbfAy(e.target.value)} style={{ display: 'block', marginTop: 4 }} />
              </label>
              <label className="muted">Dosya
                <input type="file" accept=".xlsx,.xls" onChange={baskiDosyaYukle} disabled={baskiYukleniyor} style={{ display: 'block', marginTop: 4 }} />
              </label>
            </div>
            {baskiMesaj && <p style={{ marginTop: 10 }}>{baskiMesaj}</p>}
          </div>

          <div className="card">
            <h3>Geçmiş Ay Verilerini Toplu İçe Aktar</h3>
            <p className="muted">
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
          </div>

          <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: 1, minWidth: 180, textAlign: 'center', margin: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {genelOrtalamaMsbf !== null ? Math.round(genelOrtalamaMsbf).toLocaleString('tr-TR') : '-'}
              </div>
              <div className="muted">Ömür Boyu Genel Ortalama MSBF ({msbfKumulatifSonuclar.length} kalıp, {msbfAy} itibarıyla)</div>
            </div>
            <div className="card" style={{ flex: 1, minWidth: 180, textAlign: 'center', margin: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {fomMarOrtalamaMsbf.msbf !== null ? Math.round(fomMarOrtalamaMsbf.msbf).toLocaleString('tr-TR') : '-'}
              </div>
              <div className="muted">Fompak + Martur Ömür Boyu Genel MSBF ({fomMarOrtalamaMsbf.adet} kalıp)</div>
            </div>
          </div>

          {eslesmeyenKalipKodlari.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--warn)' }}>
              <h3 className="status-Devam">⚠ Baskı Sayısı Yüklenmemiş Kalıplar</h3>
              <p className="muted">
                Bu kalıplarda EWO'da KA arızası kaydı var ama baskı sayısı henüz yüklenmediği için MSBF hesaplanamıyor:
              </p>
              <p style={{ fontFamily: 'monospace', fontSize: 13 }}>{eslesmeyenKalipKodlari.join(', ')}</p>
            </div>
          )}

          <div className="card">
            <h3>{msbfAy} — Kalıp Bazında Aylık MSBF (En Düşük → En Yüksek)</h3>
            <p className="muted">
              Bu, orijinal KPI dosyanızdaki aylık sütun yapısının birebir karşılığıdır: Güncel Baskı Sayısı (ERP'den,
              kümülatif) → O Ay Baskı Sayısı (fark) → Arıza Sayısı → MSBF.
            </p>
            {msbfAylikSonuclar.length === 0 ? (
              <p className="muted">{msbfAy} için henüz baskı sayısı yüklenmedi.</p>
            ) : (
              <table>
                <thead><tr><th>Kalıp Kodu</th><th>Güncel Baskı Sayısı (ERP)</th><th>{msbfAy} Ayı Baskı Sayısı</th><th>Arıza Sayısı</th><th>MSBF</th><th>Kaynak</th></tr></thead>
                <tbody>
                  {msbfAylikSonuclar.map((s) => (
                    <tr key={s.kalip_kodu_normalize}>
                      <td>{s.kalip_kodu}</td>
                      <td>{s.guncelToplam.toLocaleString('tr-TR')}</td>
                      <td>{s.ayBaskisi !== null ? s.ayBaskisi.toLocaleString('tr-TR') : <span className="muted">İlk ay, veri yok</span>}</td>
                      <td>{s.arizaSayisi}</td>
                      <td className={s.arizaSayisi > 0 ? '' : 'muted'}>
                        {s.msbf !== null ? Math.round(s.msbf).toLocaleString('tr-TR') : 'Arıza yok'}
                      </td>
                      <td className="muted" style={{ fontSize: 12 }}>{s.kaynak}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h3>Ömür Boyu Kümülatif MSBF ({msbfAy} itibarıyla) — Kalıp Bazında</h3>
            <p className="muted">Kalıbın üretime girdiğinden bu yana toplam baskı sayısı / toplam arıza sayısı.</p>
            {msbfKumulatifSonuclar.length === 0 ? (
              <p className="muted">Henüz baskı sayısı yüklenmedi.</p>
            ) : (
              <table>
                <thead><tr><th>Kalıp Kodu</th><th>Ömür Boyu Toplam Baskı</th><th>Ömür Boyu Toplam Arıza</th><th>Kümülatif MSBF</th></tr></thead>
                <tbody>
                  {msbfKumulatifSonuclar.map((s) => (
                    <tr key={s.kalip_kodu_normalize}>
                      <td>{s.kalip_kodu}</td>
                      <td>{s.guncelToplam.toLocaleString('tr-TR')}</td>
                      <td>{s.arizaSayisi}</td>
                      <td className={s.arizaSayisi > 0 ? '' : 'muted'}>
                        {s.msbf !== null ? Math.round(s.msbf).toLocaleString('tr-TR') : 'Arıza yok'}
                      </td>
                    </tr>
                  ))}
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
