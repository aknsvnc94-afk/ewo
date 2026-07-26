'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Makine = { id: string; ad: string; aktif: boolean };
type Parca = { id: string; kaynak: 'manuel' | 'siparis'; parca_kodu: string | null; parca_tanimi: string; tarih: string | null; ekleyen: string | null };

export default function MakinelerPage() {
  const [makineler, setMakineler] = useState<Makine[]>([]);
  const [seciliMakineId, setSeciliMakineId] = useState('');
  const [parcalar, setParcalar] = useState<Parca[]>([]);
  const [yeniMakineAdi, setYeniMakineAdi] = useState('');
  const [yeniParcaKodu, setYeniParcaKodu] = useState('');
  const [yeniParcaTanimi, setYeniParcaTanimi] = useState('');
  const [mesaj, setMesaj] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function makineleriGetir() {
    const res = await fetch('/api/makineler');
    const data = await res.json();
    setMakineler(data.makineler || []);
  }

  useEffect(() => { makineleriGetir(); }, []);

  async function parcalariGetir(makineId: string) {
    if (!makineId) { setParcalar([]); return; }
    const res = await fetch(`/api/yedek-parcalar?makine_id=${makineId}`);
    const data = await res.json();
    setParcalar(data.parcalar || []);
  }

  useEffect(() => { parcalariGetir(seciliMakineId); }, [seciliMakineId]);

  async function makineEkle(e: React.FormEvent) {
    e.preventDefault();
    setMesaj('');
    if (!yeniMakineAdi.trim()) return;
    setKaydediliyor(true);
    try {
      const res = await fetch('/api/makineler', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad: yeniMakineAdi }),
      });
      const data = await res.json();
      if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
      setYeniMakineAdi('');
      await makineleriGetir();
      setSeciliMakineId(data.makine.id);
    } finally {
      setKaydediliyor(false);
    }
  }

  async function parcaEkle(e: React.FormEvent) {
    e.preventDefault();
    setMesaj('');
    if (!seciliMakineId || !yeniParcaTanimi.trim()) return;
    setKaydediliyor(true);
    try {
      const res = await fetch('/api/yedek-parcalar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ makine_id: seciliMakineId, parca_kodu: yeniParcaKodu, parca_tanimi: yeniParcaTanimi }),
      });
      const data = await res.json();
      if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
      setYeniParcaKodu(''); setYeniParcaTanimi('');
      await parcalariGetir(seciliMakineId);
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Makine Bazlı Yedek Parça</h1>
        <Link href="/admin"><button className="secondary">← Panele Dön</button></Link>
      </div>

      <div className="card">
        <h3>Yeni Makine Ekle</h3>
        <form onSubmit={makineEkle} className="row" style={{ maxWidth: 420 }}>
          <input placeholder="Makine adı" value={yeniMakineAdi} onChange={(e) => setYeniMakineAdi(e.target.value)} style={{ flex: 1 }} required />
          <button type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Ekleniyor...' : 'Makine Ekle'}</button>
        </form>
      </div>

      <div className="card">
        <h3>Makine Seç</h3>
        <select value={seciliMakineId} onChange={(e) => setSeciliMakineId(e.target.value)} style={{ maxWidth: 320 }}>
          <option value="">Makine seçin...</option>
          {makineler.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}
        </select>
      </div>

      {mesaj && <p>{mesaj}</p>}

      {seciliMakineId && (
        <div className="card">
          <h3>Manuel Yedek Parça Ekle</h3>
          <form onSubmit={parcaEkle} className="row" style={{ maxWidth: 520, marginBottom: 16 }}>
            <input placeholder="Parça kodu (opsiyonel)" value={yeniParcaKodu} onChange={(e) => setYeniParcaKodu(e.target.value)} style={{ width: 160 }} />
            <input placeholder="Parça tanımı" value={yeniParcaTanimi} onChange={(e) => setYeniParcaTanimi(e.target.value)} style={{ flex: 1 }} required />
            <button type="submit" disabled={kaydediliyor}>Ekle</button>
          </form>

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
