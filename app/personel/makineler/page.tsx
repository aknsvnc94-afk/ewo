'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Makine = { id: string; ad: string; aktif: boolean };
type Parca = { id: string; kaynak: 'manuel' | 'siparis'; parca_kodu: string | null; parca_tanimi: string; tarih: string | null; ekleyen: string | null };

export default function PersonelMakinelerPage() {
  const [makineler, setMakineler] = useState<Makine[]>([]);
  const [seciliMakineId, setSeciliMakineId] = useState('');
  const [parcalar, setParcalar] = useState<Parca[]>([]);

  useEffect(() => {
    fetch('/api/makineler').then((r) => r.json()).then((d) => setMakineler(d.makineler || []));
  }, []);

  useEffect(() => {
    if (!seciliMakineId) { setParcalar([]); return; }
    fetch(`/api/yedek-parcalar?makine_id=${seciliMakineId}`).then((r) => r.json()).then((d) => setParcalar(d.parcalar || []));
  }, [seciliMakineId]);

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Makine Yedek Parçaları</h1>
        <Link href="/personel"><button className="secondary">← Arızalarıma Dön</button></Link>
      </div>

      <div className="card">
        <h3>Makine Seç</h3>
        <select value={seciliMakineId} onChange={(e) => setSeciliMakineId(e.target.value)} style={{ maxWidth: 320 }}>
          <option value="">Makine seçin...</option>
          {makineler.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}
        </select>
      </div>

      {seciliMakineId && (
        <div className="card">
          <h3>Bu Makinede Kullanılan Parçalar ({parcalar.length})</h3>
          <div className="record-list">
            {parcalar.length === 0 && <p className="muted">Henüz kayıtlı parça yok.</p>}
            {parcalar.map((p) => (
              <div key={`${p.kaynak}-${p.id}`} className="record-item">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{p.parca_kodu ? `${p.parca_kodu} — ${p.parca_tanimi}` : p.parca_tanimi}</strong>
                  <span className={p.kaynak === 'manuel' ? 'badge badge-BA' : 'badge badge-MA'}>
                    {p.kaynak === 'manuel' ? 'Manuel' : 'Sipariş'}
                  </span>
                </div>
                <div className="muted">
                  {p.tarih ? new Date(p.tarih).toLocaleDateString('tr-TR') : '-'}
                  {p.ekleyen ? ` · ${p.ekleyen}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
