'use client';
import { useEffect, useState } from 'react';

type Kayit = {
  id: string;
  tezgah: string;
  kategori: 'MA' | 'BA' | 'KA' | 'RA';
  durus_adi: string;
  baslangic: string;
  sure: string;
  aciklama: string;
  tamamlanma_durumu: string;
  personel: { ad_soyad: string } | null;
};

type Personel = { id: string; ad_soyad: string };

export default function AdminPage() {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [personelListesi, setPersonelListesi] = useState<Personel[]>([]);
  const [secililer, setSecililer] = useState<Set<string>>(new Set());
  const [atanacakPersonel, setAtanacakPersonel] = useState('');
  const [kategoriFiltre, setKategoriFiltre] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [mesaj, setMesaj] = useState('');

  async function verileriGetir() {
    const url = kategoriFiltre ? `/api/records?kategori=${kategoriFiltre}` : '/api/records';
    const res = await fetch(url);
    const data = await res.json();
    setKayitlar(data.kayitlar || []);
  }

  async function personelGetir() {
    const res = await fetch('/api/personel');
    const data = await res.json();
    setPersonelListesi(data.personel || []);
  }

  useEffect(() => {
    verileriGetir();
    personelGetir();
  }, [kategoriFiltre]);

  async function dosyaYukle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setYukleniyor(true);
    setMesaj('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setMesaj(`Hata: ${data.error}`);
      } else {
        setMesaj(`✓ ${data.eklenen} yeni kayıt eklendi (${data.atlanan_mukerrer} mükerrer atlandı)`);
        verileriGetir();
      }
    } finally {
      setYukleniyor(false);
      e.target.value = '';
    }
  }

  function toggleSecim(id: string) {
    const yeni = new Set(secililer);
    yeni.has(id) ? yeni.delete(id) : yeni.add(id);
    setSecililer(yeni);
  }

  async function ataYap() {
    if (!atanacakPersonel || secililer.size === 0) return;
    const res = await fetch('/api/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kayit_idler: Array.from(secililer), personel_id: atanacakPersonel }),
    });
    const data = await res.json();
    if (res.ok) {
      setMesaj(`✓ ${data.atanan_sayi} kayıt atandı`);
      setSecililer(new Set());
      verileriGetir();
    }
  }

  return (
    <div className="container">
      <h1>Admin Paneli</h1>

      <div className="card">
        <h3>ERP Excel Yükle</h3>
        <p className="muted">ANA VERİ formatındaki .xlsx dosyasını seçin. Mükerrer kayıtlar otomatik atlanır.</p>
        <input type="file" accept=".xlsx,.xls" onChange={dosyaYukle} disabled={yukleniyor} />
        {mesaj && <p style={{ marginTop: 10 }}>{mesaj}</p>}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>Arıza Kayıtları ({kayitlar.length})</h3>
          <select value={kategoriFiltre} onChange={(e) => setKategoriFiltre(e.target.value)}>
            <option value="">Tüm Kategoriler</option>
            <option value="MA">MA - Makine Arızası</option>
            <option value="BA">BA - Montaj Banko Arızası</option>
            <option value="KA">KA - Kalıp Arızası</option>
            <option value="RA">RA - Robot Arızası</option>
          </select>
        </div>

        <div className="row" style={{ margin: '12px 0' }}>
          <select value={atanacakPersonel} onChange={(e) => setAtanacakPersonel(e.target.value)}>
            <option value="">Personel seç...</option>
            {personelListesi.map((p) => (
              <option key={p.id} value={p.id}>{p.ad_soyad}</option>
            ))}
          </select>
          <button onClick={ataYap} disabled={!atanacakPersonel || secililer.size === 0}>
            Seçilenleri Ata ({secililer.size})
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th></th><th>Tezgah</th><th>Kategori</th><th>Duruş</th><th>Başlangıç</th><th>Süre</th><th>Durum</th><th>Atanan</th>
            </tr>
          </thead>
          <tbody>
            {kayitlar.map((k) => (
              <tr key={k.id}>
                <td><input type="checkbox" checked={secililer.has(k.id)} onChange={() => toggleSecim(k.id)} /></td>
                <td>{k.tezgah}</td>
                <td><span className={`badge badge-${k.kategori}`}>{k.kategori}</span></td>
                <td>{k.durus_adi}</td>
                <td>{k.baslangic ? new Date(k.baslangic).toLocaleString('tr-TR') : '-'}</td>
                <td>{k.sure}</td>
                <td className={`status-${k.tamamlanma_durumu?.replace(' ', '')}`}>{k.tamamlanma_durumu}</td>
                <td>{k.personel?.ad_soyad || <span className="muted">Atanmadı</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="record-list mobile-only">
          {kayitlar.map((k) => (
            <div key={k.id} className="record-item">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <label className="row">
                  <input type="checkbox" checked={secililer.has(k.id)} onChange={() => toggleSecim(k.id)} />
                  <strong>{k.tezgah}</strong>
                </label>
                <span className={`badge badge-${k.kategori}`}>{k.kategori}</span>
              </div>
              <div className="muted">{k.durus_adi}</div>
              <div className="muted">{k.baslangic ? new Date(k.baslangic).toLocaleString('tr-TR') : '-'} · {k.sure}</div>
              <div className={`status-${k.tamamlanma_durumu?.replace(' ', '')}`}>{k.tamamlanma_durumu}</div>
              <div className="muted">{k.personel?.ad_soyad || 'Atanmadı'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
