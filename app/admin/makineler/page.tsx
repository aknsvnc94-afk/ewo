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
  const [duzenlenenId, setDuzenlenenId] = useState<string | null>(null);
  const [duzenleForm, setDuzenleForm] = useState({ parca_kodu: '', parca_tanimi: '' });
  const [duzenlenenMakineId, setDuzenlenenMakineId] = useState<string | null>(null);
  const [makineAdiDuzenle, setMakineAdiDuzenle] = useState('');

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

  function duzenlemeyeBasla(p: Parca) {
    setDuzenlenenId(p.id);
    setDuzenleForm({ parca_kodu: p.parca_kodu || '', parca_tanimi: p.parca_tanimi });
    setMesaj('');
  }

  async function duzenlemeyiKaydet(id: string) {
    setKaydediliyor(true);
    try {
      const res = await fetch(`/api/yedek-parcalar/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parca_kodu: duzenleForm.parca_kodu, parca_tanimi: duzenleForm.parca_tanimi }),
      });
      const data = await res.json();
      if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
      setDuzenlenenId(null);
      await parcalariGetir(seciliMakineId);
    } finally {
      setKaydediliyor(false);
    }
  }

  async function parcaSil(p: Parca) {
    if (!confirm(`"${p.parca_tanimi}" parçasını silmek istediğinize emin misiniz?`)) return;
    setKaydediliyor(true);
    try {
      const res = await fetch(`/api/yedek-parcalar/${p.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
      await parcalariGetir(seciliMakineId);
    } finally {
      setKaydediliyor(false);
    }
  }

  function makineDuzenlemeyeBasla(m: Makine) {
    setDuzenlenenMakineId(m.id);
    setMakineAdiDuzenle(m.ad);
    setMesaj('');
  }

  async function makineAdiKaydet(id: string) {
    if (!makineAdiDuzenle.trim()) return;
    setKaydediliyor(true);
    try {
      const res = await fetch(`/api/makineler/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad: makineAdiDuzenle }),
      });
      const data = await res.json();
      if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
      setDuzenlenenMakineId(null);
      await makineleriGetir();
    } finally {
      setKaydediliyor(false);
    }
  }

  async function makineSil(m: Makine) {
    if (!confirm(`"${m.ad}" makinesini ve bu makineye ait tüm yedek parça kayıtlarını KALICI olarak silmek istediğinize emin misiniz?`)) return;
    setKaydediliyor(true);
    try {
      const res = await fetch(`/api/makineler/${m.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
      if (seciliMakineId === m.id) setSeciliMakineId('');
      await makineleriGetir();
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Makine Bazlı Yedek Parça</h1>
        <Link href="/panel/bakim"><button className="secondary">← Panele Dön</button></Link>
      </div>

      <div className="card">
        <h3>Yeni Makine Ekle</h3>
        <form onSubmit={makineEkle} className="row" style={{ maxWidth: 420 }}>
          <input placeholder="Makine adı" value={yeniMakineAdi} onChange={(e) => setYeniMakineAdi(e.target.value)} style={{ flex: 1 }} required />
          <button type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Ekleniyor...' : 'Makine Ekle'}</button>
        </form>
      </div>

      <div className="card">
        <h3>Makineler ({makineler.length})</h3>
        <div className="record-list">
          {makineler.length === 0 && <p className="muted">Henüz makine eklenmedi.</p>}
          {makineler.map((m) => (
            <div key={m.id} className="record-item" style={{ borderColor: seciliMakineId === m.id ? 'var(--accent)' : undefined }}>
              {duzenlenenMakineId === m.id ? (
                <div className="row">
                  <input value={makineAdiDuzenle} onChange={(e) => setMakineAdiDuzenle(e.target.value)} style={{ flex: 1 }} />
                  <button onClick={() => makineAdiKaydet(m.id)} disabled={kaydediliyor}>Kaydet</button>
                  <button className="secondary" onClick={() => setDuzenlenenMakineId(null)}>Vazgeç</button>
                </div>
              ) : (
                <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <strong style={{ cursor: 'pointer' }} onClick={() => setSeciliMakineId(m.id)}>{m.ad}</strong>
                  <div className="row">
                    <button className="secondary" onClick={() => setSeciliMakineId(m.id)}>Parçaları Göster</button>
                    <button className="secondary" onClick={() => makineDuzenlemeyeBasla(m)}>Düzenle</button>
                    <button className="danger" onClick={() => makineSil(m)}>Sil</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
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
              <div key={p.id} className="record-item">
                {duzenlenenId === p.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label className="muted">Parça Kodu
                      <input value={duzenleForm.parca_kodu} onChange={(e) => setDuzenleForm({ ...duzenleForm, parca_kodu: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
                    </label>
                    <label className="muted">Parça Tanımı
                      <input value={duzenleForm.parca_tanimi} onChange={(e) => setDuzenleForm({ ...duzenleForm, parca_tanimi: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
                    </label>
                    <div className="row">
                      <button onClick={() => duzenlemeyiKaydet(p.id)} disabled={kaydediliyor}>Kaydet</button>
                      <button className="secondary" onClick={() => setDuzenlenenId(null)}>Vazgeç</button>
                    </div>
                  </div>
                ) : (
                  <>
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
                    <div className="row" style={{ marginTop: 8 }}>
                      <button className="secondary" onClick={() => duzenlemeyeBasla(p)}>Düzenle</button>
                      <button className="danger" onClick={() => parcaSil(p)}>Sil</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
