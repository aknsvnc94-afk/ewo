'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Personel = { id: string; ad_soyad: string; kullanici_adi: string; rol: string; aktif: boolean };

export default function PersonelYonetimiPage() {
  const [liste, setListe] = useState<Personel[]>([]);
  const [adSoyad, setAdSoyad] = useState('');
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [sifre, setSifre] = useState('');
  const [rol, setRol] = useState('personel');
  const [mesaj, setMesaj] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function listeyiGetir() {
    const res = await fetch('/api/personel');
    const data = await res.json();
    setListe(data.personel || []);
  }

  useEffect(() => { listeyiGetir(); }, []);

  async function personelEkle(e: React.FormEvent) {
    e.preventDefault();
    setMesaj('');
    setKaydediliyor(true);
    try {
      const res = await fetch('/api/personel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_soyad: adSoyad, kullanici_adi: kullaniciAdi, sifre, rol }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMesaj(`Hata: ${data.error}`);
      } else {
        setMesaj(`✓ ${adSoyad} eklendi. Kullanıcı adı: ${kullaniciAdi.toLowerCase()}`);
        setAdSoyad(''); setKullaniciAdi(''); setSifre(''); setRol('personel');
        listeyiGetir();
      }
    } finally {
      setKaydediliyor(false);
    }
  }

  async function aktifligiDegistir(p: Personel) {
    await fetch('/api/personel', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, aktif: !p.aktif }),
    });
    listeyiGetir();
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Personel Yönetimi</h1>
        <Link href="/admin"><button className="secondary">← Admin Paneline Dön</button></Link>
      </div>

      <div className="card">
        <h3>Yeni Personel Ekle</h3>
        <form onSubmit={personelEkle} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
          <input placeholder="Ad Soyad" value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} required />
          <input placeholder="Kullanıcı adı" value={kullaniciAdi} onChange={(e) => setKullaniciAdi(e.target.value)} required />
          <input placeholder="Şifre (en az 4 karakter)" value={sifre} onChange={(e) => setSifre(e.target.value)} required minLength={4} />
          <select value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="personel">Personel</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Ekleniyor...' : 'Personel Ekle'}</button>
          {mesaj && <div style={{ fontSize: 14 }}>{mesaj}</div>}
        </form>
      </div>

      <div className="card">
        <h3>Mevcut Personel ({liste.length})</h3>
        <table>
          <thead><tr><th>Ad Soyad</th><th>Kullanıcı Adı</th><th>Rol</th><th>Durum</th><th></th></tr></thead>
          <tbody>
            {liste.map((p) => (
              <tr key={p.id}>
                <td>{p.ad_soyad}</td>
                <td>{p.kullanici_adi}</td>
                <td>{p.rol === 'admin' ? 'Admin' : 'Personel'}</td>
                <td className={p.aktif ? 'status-Tamamlandı' : 'status-İptal'}>{p.aktif ? 'Aktif' : 'Pasif'}</td>
                <td><button className="secondary" onClick={() => aktifligiDegistir(p)}>{p.aktif ? 'Pasif Yap' : 'Aktif Yap'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="record-list mobile-only">
          {liste.map((p) => (
            <div key={p.id} className="record-item">
              <strong>{p.ad_soyad}</strong>
              <div className="muted">@{p.kullanici_adi} · {p.rol === 'admin' ? 'Admin' : 'Personel'}</div>
              <div className={p.aktif ? 'status-Tamamlandı' : 'status-İptal'}>{p.aktif ? 'Aktif' : 'Pasif'}</div>
              <button className="secondary" style={{ marginTop: 8 }} onClick={() => aktifligiDegistir(p)}>
                {p.aktif ? 'Pasif Yap' : 'Aktif Yap'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
