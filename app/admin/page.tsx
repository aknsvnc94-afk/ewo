'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Kayit = { id: string; tamamlanma_durumu: string; personel: { ad_soyad: string } | null };
type IsEmri = { id: string; durum: string; atanan: { ad_soyad: string } | null };
type SiparisKalemi = { id: string; alindi: boolean };

export default function AdminDashboard() {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [isEmirleri, setIsEmirleri] = useState<IsEmri[]>([]);
  const [kalemler, setKalemler] = useState<SiparisKalemi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/records').then((r) => r.json()),
      fetch('/api/is-emirleri').then((r) => r.json()),
      fetch('/api/siparis-kalemi').then((r) => r.json()),
    ]).then(([kayitData, isEmriData, kalemData]) => {
      setKayitlar(kayitData.kayitlar || []);
      setIsEmirleri(isEmriData.isEmirleri || []);
      setKalemler(kalemData.kalemler || []);
      setYukleniyor(false);
    });
  }, []);

  const onayBekleyenEwo = useMemo(() => kayitlar.filter((k) => k.tamamlanma_durumu === 'Onay Bekliyor').length, [kayitlar]);
  const acikIsEmri = useMemo(() => isEmirleri.filter((i) => i.durum === 'Açık').length, [isEmirleri]);
  const kapaliIsEmri = useMemo(() => isEmirleri.filter((i) => i.durum === 'Kapatıldı').length, [isEmirleri]);
  const bekleyenMalzeme = useMemo(() => kalemler.filter((k) => !k.alindi).length, [kalemler]);

  const ewoGrafik = useMemo(() => {
    const sayac: Record<string, number> = {};
    kayitlar.forEach((k) => {
      const ad = k.personel?.ad_soyad || 'Atanmamış';
      sayac[ad] = (sayac[ad] || 0) + 1;
    });
    const girdiler = Object.entries(sayac).sort((a, b) => b[1] - a[1]);
    return { girdiler, maksimum: Math.max(1, ...girdiler.map(([, adet]) => adet)) };
  }, [kayitlar]);

  const isEmriGrafik = useMemo(() => {
    const sayac: Record<string, number> = {};
    isEmirleri.forEach((i) => {
      const ad = i.atanan?.ad_soyad || 'Atanmamış';
      sayac[ad] = (sayac[ad] || 0) + 1;
    });
    const girdiler = Object.entries(sayac).sort((a, b) => b[1] - a[1]);
    return { girdiler, maksimum: Math.max(1, ...girdiler.map(([, adet]) => adet)) };
  }, [isEmirleri]);

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1>Admin Paneli</h1>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Link href="/admin/ewo-arizalar"><button>EWO Arıza Kayıtları</button></Link>
          <Link href="/admin/is-emirleri"><button className="secondary">İş Emirleri</button></Link>
          <Link href="/admin/siparisler"><button className="secondary">Sipariş Takip</button></Link>
          <Link href="/admin/aksiyonlar"><button className="secondary">Aksiyon Takip</button></Link>
          <Link href="/admin/analiz"><button className="secondary">EWO Analiz / Pareto</button></Link>
          <Link href="/admin/bana-atananlar"><button className="secondary">Bana Atananlar</button></Link>
          <Link href="/admin/yeni-kayit"><button className="secondary">+ Yeni Kayıt</button></Link>
          <Link href="/admin/personel"><button className="secondary">Personel Yönetimi</button></Link>
        </div>
      </div>

      {yukleniyor ? <p className="muted">Yükleniyor...</p> : (
        <>
          {onayBekleyenEwo > 0 && (
            <Link href="/admin/ewo-arizalar" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ borderColor: 'var(--warn)', cursor: 'pointer' }}>
                <strong className="status-Devam">⚠ {onayBekleyenEwo} EWO kaydı onay bekliyor.</strong> Kontrol etmek için tıklayın.
              </div>
            </Link>
          )}

          <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: 1, minWidth: 130, textAlign: 'center', margin: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{kayitlar.length}</div>
              <div className="muted">Toplam EWO Arıza Kaydı</div>
            </div>
            <div className="card" style={{ flex: 1, minWidth: 130, textAlign: 'center', margin: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }} className="status-Beklemede">{acikIsEmri}</div>
              <div className="muted">Açık İş Emri</div>
            </div>
            <div className="card" style={{ flex: 1, minWidth: 130, textAlign: 'center', margin: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }} className="status-Tamamlandı">{kapaliIsEmri}</div>
              <div className="muted">Kapatılan İş Emri</div>
            </div>
            <div className="card" style={{ flex: 1, minWidth: 130, textAlign: 'center', margin: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{bekleyenMalzeme}</div>
              <div className="muted">Bekleyen Malzeme</div>
            </div>
          </div>

          <div className="card">
            <h3>Personel Bazlı Atanan EWO Sayısı</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ewoGrafik.girdiler.length === 0 && <p className="muted">Henüz kayıt yok</p>}
              {ewoGrafik.girdiler.map(([ad, adet]) => (
                <div key={ad} className="row" style={{ gap: 10 }}>
                  <div style={{ width: 140, fontSize: 13 }} className="muted">{ad}</div>
                  <div style={{ flex: 1, background: 'var(--panel-2)', borderRadius: 6, overflow: 'hidden', height: 18 }}>
                    <div style={{ width: `${(adet / ewoGrafik.maksimum) * 100}%`, background: 'var(--accent)', height: '100%' }} />
                  </div>
                  <div style={{ width: 24, textAlign: 'right', fontSize: 13 }}>{adet}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>Personel Bazlı Atanan İş Emri Sayısı</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {isEmriGrafik.girdiler.length === 0 && <p className="muted">Henüz kayıt yok</p>}
              {isEmriGrafik.girdiler.map(([ad, adet]) => (
                <div key={ad} className="row" style={{ gap: 10 }}>
                  <div style={{ width: 140, fontSize: 13 }} className="muted">{ad}</div>
                  <div style={{ flex: 1, background: 'var(--panel-2)', borderRadius: 6, overflow: 'hidden', height: 18 }}>
                    <div style={{ width: `${(adet / isEmriGrafik.maksimum) * 100}%`, background: 'var(--ka)', height: '100%' }} />
                  </div>
                  <div style={{ width: 24, textAlign: 'right', fontSize: 13 }}>{adet}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
