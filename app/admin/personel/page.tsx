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

  const [duzenlenenId, setDuzenlenenId] = useState<string | null>(null);
  const [duzenleForm, setDuzenleForm] = useState<{ ad_soyad: string; kullanici_adi: string; rol: string; yeni_sifre: string }>({ ad_soyad: '', kullanici_adi: '', rol: 'personel', yeni_sifre: '' });

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

  function duzenlemeyeBasla(p: Personel) {
    setDuzenlenenId(p.id);
    setDuzenleForm({ ad_soyad: p.ad_soyad, kullanici_adi: p.kullanici_adi, rol: p.rol, yeni_sifre: '' });
    setMesaj('');
  }

  async function duzenlemeyiKaydet(id: string) {
    setKaydediliyor(true);
    try {
      const body: any = {
        id,
        ad_soyad: duzenleForm.ad_soyad,
        kullanici_adi: duzenleForm.kullanici_adi,
        rol: duzenleForm.rol,
      };
      if (duzenleForm.yeni_sifre) body.yeni_sifre = duzenleForm.yeni_sifre;

      const res = await fetch('/api/personel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
      setMesaj('✓ Güncellendi');
      setDuzenlenenId(null);
      listeyiGetir();
    } finally {
      setKaydediliyor(false);
    }
  }

  async function personeliSil(p: Personel) {
    if (!confirm(`${p.ad_soyad} adlı personeli KALICI olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return;
    const res = await fetch('/api/personel', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    });
    const data = await res.json();
    if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
    setMesaj(`✓ ${p.ad_soyad} silindi`);
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
        </form>
        {mesaj && <div style={{ fontSize: 14, marginTop: 10 }}>{mesaj}</div>}
      </div>

      <div className="card">
        <h3>Mevcut Personel ({liste.length})</h3>
        <div className="record-list">
          {liste.map((p) => (
            <div key={p.id} className="record-item">
              {duzenlenenId === p.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label className="muted">Ad Soyad
                    <input value={duzenleForm.ad_soyad} onChange={(e) => setDuzenleForm({ ...duzenleForm, ad_soyad: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
                  </label>
                  <label className="muted">Kullanıcı Adı
                    <input value={duzenleForm.kullanici_adi} onChange={(e) => setDuzenleForm({ ...duzenleForm, kullanici_adi: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
                  </label>
                  <label className="muted">Rol
                    <select value={duzenleForm.rol} onChange={(e) => setDuzenleForm({ ...duzenleForm, rol: e.target.value })} style={{ width: '100%', marginTop: 4 }}>
                      <option value="personel">Personel</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <label className="muted">Yeni Şifre (değiştirmek istemiyorsan boş bırak)
                    <input value={duzenleForm.yeni_sifre} onChange={(e) => setDuzenleForm({ ...duzenleForm, yeni_sifre: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
                  </label>
                  <div className="row">
                    <button onClick={() => duzenlemeyiKaydet(p.id)} disabled={kaydediliyor}>Kaydet</button>
                    <button className="secondary" onClick={() => setDuzenlenenId(null)}>Vazgeç</button>
                  </div>
                </div>
              ) : (
                <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{p.ad_soyad}</strong>
                    <div className="muted">@{p.kullanici_adi} · {p.rol === 'admin' ? 'Admin' : 'Personel'}</div>
                    <div className={p.aktif ? 'status-Tamamlandı' : 'status-İptal'}>{p.aktif ? 'Aktif' : 'Pasif'}</div>
                  </div>
                  <div className="row">
                    <button className="secondary" onClick={() => duzenlemeyeBasla(p)}>Düzenle</button>
                    <button className="secondary" onClick={() => aktifligiDegistir(p)}>{p.aktif ? 'Pasif Yap' : 'Aktif Yap'}</button>
                    <button className="danger" onClick={() => personeliSil(p)}>Sil</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
