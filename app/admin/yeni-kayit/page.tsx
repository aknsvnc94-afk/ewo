'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function YeniKayitPage() {
  const router = useRouter();
  const [tezgah, setTezgah] = useState('');
  const [kategori, setKategori] = useState('MA');
  const [durusAdi, setDurusAdi] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [kalipKodu, setKalipKodu] = useState('');
  const [atananPersonel, setAtananPersonel] = useState('');
  const [personelListesi, setPersonelListesi] = useState<{ id: string; ad_soyad: string }[]>([]);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [mesaj, setMesaj] = useState('');

  const [aksiyonlar, setAksiyonlar] = useState<{ aciklama: string; sorumlu_personel_id: string; plan_tarihi: string }[]>([]);

  useEffect(() => {
    fetch('/api/personel').then((r) => r.json()).then((data) => {
      setPersonelListesi((data.personel || []).filter((p: any) => p.aktif));
    });
  }, []);

  function aksiyonEkle() {
    setAksiyonlar([...aksiyonlar, { aciklama: '', sorumlu_personel_id: '', plan_tarihi: '' }]);
  }
  function aksiyonGuncelle(i: number, alan: string, deger: string) {
    const yeni = [...aksiyonlar];
    (yeni[i] as any)[alan] = deger;
    setAksiyonlar(yeni);
  }
  function aksiyonSil(i: number) {
    setAksiyonlar(aksiyonlar.filter((_, idx) => idx !== i));
  }

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setKaydediliyor(true);
    setMesaj('');
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tezgah, kategori, durus_adi: durusAdi, aciklama, kalip_kodu: kalipKodu || null,
          atanan_personel_id: atananPersonel || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }

      for (const a of aksiyonlar) {
        if (!a.aciklama.trim()) continue;
        await fetch('/api/aksiyonlar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ariza_kayit_id: data.id,
            aciklama: a.aciklama,
            sorumlu_personel_id: a.sorumlu_personel_id || null,
            plan_tarihi: a.plan_tarihi || null,
          }),
        });
      }

      router.push('/admin');
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Yeni Arıza Kaydı / Görev</h1>
        <Link href="/admin"><button className="secondary">← Admin Paneline Dön</button></Link>
      </div>
      <p className="muted">ERP'den gelmeyen, doğrudan tanımlamak istediğiniz arızalar veya görevler için kullanın.</p>

      <form onSubmit={kaydet}>
        <div className="card">
          <h3>Kayıt Bilgileri</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <label className="muted">Tezgah *
              <input value={tezgah} onChange={(e) => setTezgah(e.target.value)} required style={{ width: '100%', marginTop: 4 }} />
            </label>
            <label className="muted">Kategori *
              <select value={kategori} onChange={(e) => setKategori(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                <option value="MA">MA - Makine Arızası</option>
                <option value="BA">BA - Montaj Banko Arızası</option>
                <option value="KA">KA - Kalıp Arızası</option>
                <option value="RA">RA - Robot Arızası</option>
                <option value="GT">GT - Genel Tesis</option>
              </select>
            </label>
            {kategori === 'KA' && (
              <label className="muted">Kalıp Kodu
                <input value={kalipKodu} onChange={(e) => setKalipKodu(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
              </label>
            )}
            <label className="muted">Atanacak Personel
              <select value={atananPersonel} onChange={(e) => setAtananPersonel(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                <option value="">Atanmadı</option>
                {personelListesi.map((p) => <option key={p.id} value={p.id}>{p.ad_soyad}</option>)}
              </select>
            </label>
          </div>
          <label className="muted" style={{ display: 'block', marginTop: 10 }}>Duruş Adı / Başlık *
            <input value={durusAdi} onChange={(e) => setDurusAdi(e.target.value)} required style={{ width: '100%', marginTop: 4 }} />
          </label>
          <label className="muted" style={{ display: 'block', marginTop: 10 }}>Açıklama
            <textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} rows={3} style={{ width: '100%', marginTop: 4 }} />
          </label>
        </div>

        <div className="card">
          <h3>Aksiyonlar (opsiyonel)</h3>
          <p className="muted">Sorumlu seçilen aksiyonlar, personelin "Aksiyonlarım" sayfasında görünür.</p>
          {aksiyonlar.map((a, i) => (
            <div key={i} className="row" style={{ marginBottom: 8 }}>
              <input placeholder="Aksiyon açıklaması" value={a.aciklama} onChange={(e) => aksiyonGuncelle(i, 'aciklama', e.target.value)} style={{ flex: 2 }} />
              <select value={a.sorumlu_personel_id} onChange={(e) => aksiyonGuncelle(i, 'sorumlu_personel_id', e.target.value)} style={{ flex: 1 }}>
                <option value="">Sorumlu seç...</option>
                {personelListesi.map((p) => <option key={p.id} value={p.id}>{p.ad_soyad}</option>)}
              </select>
              <input type="date" value={a.plan_tarihi} onChange={(e) => aksiyonGuncelle(i, 'plan_tarihi', e.target.value)} style={{ flex: 1 }} />
              <button type="button" className="danger" onClick={() => aksiyonSil(i)}>Sil</button>
            </div>
          ))}
          <button type="button" className="secondary" onClick={aksiyonEkle}>+ Aksiyon Ekle</button>
        </div>

        {mesaj && <p>{mesaj}</p>}
        <div className="row" style={{ marginBottom: 24 }}>
          <button type="submit" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor...' : 'Kaydı Oluştur'}</button>
        </div>
      </form>
    </div>
  );
}
