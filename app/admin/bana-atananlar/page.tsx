'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Kayit = {
  id: string;
  tezgah: string;
  kategori: 'MA' | 'BA' | 'KA' | 'RA' | 'GT';
  durus_adi: string;
  baslangic: string;
  sure: string;
  aciklama: string;
  tamamlanma_durumu: string;
};

export default function BanaAtananlarPage() {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);

  async function verileriGetir() {
    const res = await fetch('/api/records?atanan=me');
    const data = await res.json();
    setKayitlar(data.kayitlar || []);
  }

  useEffect(() => { verileriGetir(); }, []);

  const toplam = kayitlar.length;
  const tamamlanan = kayitlar.filter((k) => k.tamamlanma_durumu === 'Tamamlandı').length;
  const onayBekleyen = kayitlar.filter((k) => k.tamamlanma_durumu === 'Onay Bekliyor').length;
  const bekleyen = kayitlar.filter((k) => ['Beklemede', 'Devam Ediyor'].includes(k.tamamlanma_durumu)).length;

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Bana Atananlar</h1>
        <Link href="/admin"><button className="secondary">← Admin Paneline Dön</button></Link>
      </div>
      <p className="muted">Kendinize atadığınız kayıtlar burada listelenir; personel formuyla aynı şekilde EWO detaylarını doldurabilirsiniz.</p>

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
          <div className="muted">Tamamlandı</div>
        </div>
      </div>

      <div className="record-list">
        {kayitlar.length === 0 && <p className="muted">Kendinize atadığınız kayıt yok.</p>}
        {kayitlar.map((k) => (
          <Link key={k.id} href={`/panel/bakim/bana-atananlar/kayit/${k.id}?donus=admin`} style={{ textDecoration: 'none', color: 'inherit' }}>
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
