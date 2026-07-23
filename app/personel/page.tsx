'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Kayit = {
  id: string;
  tezgah: string;
  kategori: 'MA' | 'BA' | 'KA' | 'RA';
  durus_adi: string;
  baslangic: string;
  sure: string;
  aciklama: string;
  tamamlanma_durumu: string;
};

export default function PersonelPage() {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);

  async function verileriGetir() {
    const res = await fetch('/api/records');
    const data = await res.json();
    setKayitlar(data.kayitlar || []);
  }

  useEffect(() => { verileriGetir(); }, []);

  return (
    <div className="container">
      <h1>Bana Atanan Arızalar</h1>
      <div className="record-list">
        {kayitlar.length === 0 && <p className="muted">Şu anda size atanmış kayıt yok.</p>}
        {kayitlar.map((k) => (
          <Link key={k.id} href={`/personel/kayit/${k.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
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
