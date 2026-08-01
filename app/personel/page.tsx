'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const EWO_ESIK_SANIYE = 20 * 60;

type Kayit = {
  id: string;
  tezgah: string;
  kategori: 'MA' | 'BA' | 'KA' | 'RA';
  durus_adi: string;
  baslangic: string;
  sure: string;
  sure_sn: number;
  aciklama: string;
  tamamlanma_durumu: string;
};

export default function PersonelPage() {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [fabrikaAdim, setFabrikaAdim] = useState<string | null>(null);
  const [adSoyad, setAdSoyad] = useState<string | null>(null);
  const [tezgahFiltre, setTezgahFiltre] = useState('');
  const [durumFiltre, setDurumFiltre] = useState('');

  async function verileriGetir() {
    const res = await fetch('/api/records');
    const data = await res.json();
    setKayitlar(data.kayitlar || []);
  }

  useEffect(() => {
    verileriGetir();
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      setFabrikaAdim(d.fabrikaAd || null);
      setAdSoyad(d.ad_soyad || null);
    }).catch(() => {});
  }, []);

  const toplam = kayitlar.length;
  const tamamlanan = kayitlar.filter((k) => k.tamamlanma_durumu === 'Tamamlandı').length;
  const onayBekleyen = kayitlar.filter((k) => k.tamamlanma_durumu === 'Onay Bekliyor').length;
  const bekleyen = kayitlar.filter((k) => ['Beklemede', 'Devam Ediyor'].includes(k.tamamlanma_durumu)).length;
  const ewoDoldurulmasiBekleyen = kayitlar.filter((k) =>
    (k.sure_sn || 0) > EWO_ESIK_SANIYE && ['Beklemede', 'Devam Ediyor'].includes(k.tamamlanma_durumu)
  ).length;

  const tezgahListesi = useMemo(
    () => Array.from(new Set(kayitlar.map((k) => k.tezgah).filter(Boolean))).sort(),
    [kayitlar]
  );

  const gosterilecekler = useMemo(() => {
    let liste = [...kayitlar];
    if (tezgahFiltre) liste = liste.filter((k) => k.tezgah === tezgahFiltre);
    if (durumFiltre === 'doldur') {
      liste = liste.filter((k) => (k.sure_sn || 0) > EWO_ESIK_SANIYE && ['Beklemede', 'Devam Ediyor'].includes(k.tamamlanma_durumu));
    } else if (durumFiltre === 'onay') {
      liste = liste.filter((k) => k.tamamlanma_durumu === 'Onay Bekliyor');
    } else if (durumFiltre === 'tamamlandi') {
      liste = liste.filter((k) => k.tamamlanma_durumu === 'Tamamlandı');
    }
    return liste;
  }, [kayitlar, tezgahFiltre, durumFiltre]);

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>{adSoyad || 'Arızalarım'}</h1>
          <div className="muted">Bana Atanan Arızalar{fabrikaAdim ? ` · ${fabrikaAdim}` : ''}</div>
        </div>
        <div className="row">
          <Link href="/panel/bakim/is-emirleri-personel"><button className="secondary">İş Emirlerim</button></Link>
          <Link href="/panel/bakim/malzemeler"><button className="secondary">Gelen Malzemeler</button></Link>
          <Link href="/personel/makineler"><button className="secondary">Makine Yedek Parça</button></Link>
          <Link href="/panel/bakim/aksiyonlar-personel"><button className="secondary">Aksiyonlarım</button></Link>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{toplam}</div>
          <div className="muted">Toplam Atanan</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }} className="status-Beklemede">{bekleyen}</div>
          <div className="muted">Bekleyen</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }} className="status-Devam">{onayBekleyen}</div>
          <div className="muted">Onay Bekliyor</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }} className="status-Tamamlandı">{tamamlanan}</div>
          <div className="muted">Admin Onaylı</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{ewoDoldurulmasiBekleyen}</div>
          <div className="muted">EWO Doldurulması Bekleyen</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <select value={tezgahFiltre} onChange={(e) => setTezgahFiltre(e.target.value)}>
          <option value="">Tüm Makineler</option>
          {tezgahListesi.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={durumFiltre} onChange={(e) => setDurumFiltre(e.target.value)}>
          <option value="">Tüm Durumlar</option>
          <option value="doldur">Doldurulması Gereken EWO</option>
          <option value="onay">Onay Bekliyor</option>
          <option value="tamamlandi">Tamamlandı</option>
        </select>
      </div>

      <div className="record-list">
        {gosterilecekler.length === 0 && <p className="muted">Gösterilecek kayıt yok.</p>}
        {gosterilecekler.map((k) => (
          <Link key={k.id} href={`/panel/bakim/bana-atananlar/kayit/${k.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="record-item">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{k.tezgah}</strong>
                <span className={`badge badge-${k.kategori}`}>{k.kategori}</span>
              </div>
              <div className="muted">{k.durus_adi} · {k.baslangic ? new Date(k.baslangic).toLocaleString('tr-TR') : '-'} · {k.sure}</div>
              {k.aciklama && <div style={{ marginTop: 6 }}>{k.aciklama}</div>}
              <div className={`status-${k.tamamlanma_durumu?.replace(' ', '')}`} style={{ marginTop: 6, fontWeight: 600 }}>
                {k.tamamlanma_durumu} — Detay için dokunun →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
