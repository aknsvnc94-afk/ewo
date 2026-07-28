'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Kayit = {
  id: string; tezgah: string; kategori: string; baslangic: string; sure_sn: number;
  tamamlanma_durumu: string;
};

type Sekme = 'mttr' | 'mtbf' | 'duruslar';

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

export default function PerformansPage() {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [sekme, setSekme] = useState<Sekme>('mttr');

  const [baslangicTarihi, setBaslangicTarihi] = useState(bugunISO(30));
  const [bitisTarihi, setBitisTarihi] = useState(bugunISO(0));
  const [kategoriFiltre, setKategoriFiltre] = useState('');
  const [tezgahFiltre, setTezgahFiltre] = useState('');

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

      <div className="row" style={{ marginBottom: 14 }}>
        <button className={sekme === 'mttr' ? '' : 'secondary'} onClick={() => setSekme('mttr')}>MTTR</button>
        <button className={sekme === 'mtbf' ? '' : 'secondary'} onClick={() => setSekme('mtbf')}>MTBF</button>
        <button className={sekme === 'duruslar' ? '' : 'secondary'} onClick={() => setSekme('duruslar')}>Arıza Duruş Süreleri</button>
      </div>

      {yukleniyor ? <p className="muted">Yükleniyor...</p> : genelAdet === 0 ? (
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
