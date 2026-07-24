'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const EWO_ESIK_SANIYE = 20 * 60;

const BOLUMLER: { kod: 'MA' | 'KA' | 'BA' | 'RA'; baslik: string; grupAlan: 'tezgah' | 'kalip_kodu'; grupEtiket: string }[] = [
  { kod: 'MA', baslik: 'Makine Arızası', grupAlan: 'tezgah', grupEtiket: 'Tezgah' },
  { kod: 'KA', baslik: 'Kalıp Arızası', grupAlan: 'kalip_kodu', grupEtiket: 'Kalıp Kodu' },
  { kod: 'BA', baslik: 'Montaj Banko Arızası', grupAlan: 'tezgah', grupEtiket: 'Tezgah' },
  { kod: 'RA', baslik: 'Robot Arızası', grupAlan: 'tezgah', grupEtiket: 'Tezgah' },
];

type Kayit = {
  id: string; tezgah: string; kalip_kodu: string | null; kategori: string;
  sure_sn: number; tamamlanma_durumu: string;
};

export default function EwoAnalizPage() {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [aktifBolum, setAktifBolum] = useState<'MA' | 'KA' | 'BA' | 'RA'>('MA');
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    fetch('/api/records').then((r) => r.json()).then((data) => {
      setKayitlar(data.kayitlar || []);
      setYukleniyor(false);
    });
  }, []);

  const bolum = BOLUMLER.find((b) => b.kod === aktifBolum)!;

  const veri = useMemo(() => {
    const buBolumKayitlari = kayitlar.filter((k) => k.kategori === aktifBolum && (k.sure_sn || 0) > EWO_ESIK_SANIYE);

    // Pareto: grup alanına göre say, azalan sırala, kümülatif % hesapla
    const sayac: Record<string, number> = {};
    buBolumKayitlari.forEach((k) => {
      const grup = (bolum.grupAlan === 'kalip_kodu' ? k.kalip_kodu : k.tezgah) || 'Belirtilmemiş';
      sayac[grup] = (sayac[grup] || 0) + 1;
    });
    const toplam = buBolumKayitlari.length;
    let kumulatif = 0;
    const paretoSatirlari = Object.entries(sayac)
      .sort((a, b) => b[1] - a[1])
      .map(([grup, adet]) => {
        kumulatif += adet;
        return { grup, adet, yuzde: toplam ? (adet / toplam) * 100 : 0, kumulatifYuzde: toplam ? (kumulatif / toplam) * 100 : 0 };
      });

    const kapali = buBolumKayitlari.filter((k) => k.tamamlanma_durumu === 'Tamamlandı').length;
    const acik = toplam - kapali;

    return { toplam, paretoSatirlari, acik, kapali };
  }, [kayitlar, aktifBolum, bolum.grupAlan]);

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>EWO Analiz / Pareto</h1>
        <Link href="/admin"><button className="secondary">← Admin Paneline Dön</button></Link>
      </div>
      <p className="muted">Sadece 20 dakikanın üzerindeki (EWO gerektiren) arızalar bu analize dahildir.</p>

      <div className="row" style={{ marginBottom: 14 }}>
        {BOLUMLER.map((b) => (
          <button
            key={b.kod}
            className={aktifBolum === b.kod ? '' : 'secondary'}
            onClick={() => setAktifBolum(b.kod)}
          >
            {b.kod} - {b.baslik}
          </button>
        ))}
      </div>

      {yukleniyor ? <p className="muted">Yükleniyor...</p> : (
        <>
          <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{veri.toplam}</div>
              <div className="muted">Toplam EWO ({bolum.kod})</div>
            </div>
            <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }} className="status-Beklemede">{veri.acik}</div>
              <div className="muted">Açık EWO</div>
            </div>
            <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }} className="status-Tamamlandı">{veri.kapali}</div>
              <div className="muted">Kapalı (Onaylı) EWO</div>
            </div>
          </div>

          <div className="card">
            <h3>{bolum.baslik} Paretosu ({bolum.grupEtiket} bazında)</h3>
            {veri.paretoSatirlari.length === 0 && <p className="muted">Bu kategoride 20 dakika üzeri arıza kaydı yok.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {veri.paretoSatirlari.map((s) => (
                <div key={s.grup}>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                    <span>{s.grup}</span>
                    <span className="muted">{s.adet} adet · kümülatif %{s.kumulatifYuzde.toFixed(0)}</span>
                  </div>
                  <div style={{ background: 'var(--panel-2)', borderRadius: 6, overflow: 'hidden', height: 16 }}>
                    <div style={{ width: `${s.yuzde}%`, background: 'var(--accent)', height: '100%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
