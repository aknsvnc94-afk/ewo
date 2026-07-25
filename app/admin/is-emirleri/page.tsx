'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { parseIsEmriBuffer } from '@/lib/isEmriParse';

type IsEmri = {
  id: string; is_emri_no: string; onarilan_kodu: string; onarilan_tanimi: string;
  problem_tanimi: string; tarih: string; tesis_adi: string;
  durum: string; yapilan_is: string | null; kapatma_tarihi: string | null;
  atanan: { ad_soyad: string } | null; kapatan: { ad_soyad: string } | null;
};

type Personel = { id: string; ad_soyad: string; aktif: boolean };

export default function IsEmirleriPage() {
  const [isEmirleri, setIsEmirleri] = useState<IsEmri[]>([]);
  const [personelListesi, setPersonelListesi] = useState<Personel[]>([]);
  const [secililer, setSecililer] = useState<Set<string>>(new Set());
  const [atanacakPersonel, setAtanacakPersonel] = useState('');
  const [durumFiltre, setDurumFiltre] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [mesaj, setMesaj] = useState('');

  async function verileriGetir() {
    const url = durumFiltre ? `/api/is-emirleri?durum=${durumFiltre}` : '/api/is-emirleri';
    const res = await fetch(url);
    const data = await res.json();
    setIsEmirleri(data.isEmirleri || []);
  }

  async function personelGetir() {
    const res = await fetch('/api/personel');
    const data = await res.json();
    setPersonelListesi((data.personel || []).filter((p: Personel) => p.aktif));
  }

  useEffect(() => { verileriGetir(); personelGetir(); }, [durumFiltre]);

  async function dosyaYukle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setYukleniyor(true);
    setMesaj('Dosya okunuyor...');
    try {
      const buf = await file.arrayBuffer();
      const { kayitlar, toplamSatir, hata } = parseIsEmriBuffer(buf);
      if (hata) { setMesaj(`Hata: ${hata}`); return; }
      if (kayitlar.length === 0) {
        setMesaj(`Toplam ${toplamSatir} satır tarandı, geçerli iş emri bulunamadı.`);
        return;
      }
      setMesaj(`${kayitlar.length} iş emri bulundu, gönderiliyor...`);
      const res = await fetch('/api/is-emirleri', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kayitlar }),
      });
      const data = await res.json();
      if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
      setMesaj(`✓ ${data.eklenen} yeni iş emri eklendi (${data.atlanan_mukerrer} mükerrer atlandı)`);
      verileriGetir();
    } catch (err: any) {
      setMesaj(`Hata: Dosya okunamadı (${err?.message || 'bilinmeyen hata'})`);
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
    const res = await fetch('/api/is-emirleri/assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_emri_idler: Array.from(secililer), personel_id: atanacakPersonel }),
    });
    const data = await res.json();
    if (res.ok) {
      setMesaj(`✓ ${data.atanan_sayi} iş emri atandı`);
      setSecililer(new Set());
      verileriGetir();
    }
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>İş Emirleri</h1>
        <Link href="/admin"><button className="secondary">← Admin Paneline Dön</button></Link>
      </div>

      <div className="card">
        <h3>Günlük İş Emri Excel Yükle</h3>
        <p className="muted">Açık iş emirleri dökümünü (başlıksız format) buraya yükleyin. Mükerrer iş emri numaraları otomatik atlanır.</p>
        <input type="file" accept=".xlsx,.xls" onChange={dosyaYukle} disabled={yukleniyor} />
        {mesaj && <p style={{ marginTop: 10 }}>{mesaj}</p>}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>İş Emirleri ({isEmirleri.length})</h3>
          <select value={durumFiltre} onChange={(e) => setDurumFiltre(e.target.value)}>
            <option value="">Tüm Durumlar</option>
            <option value="Açık">Açık</option>
            <option value="Kapatıldı">Kapatıldı</option>
          </select>
        </div>

        <div className="row" style={{ margin: '12px 0' }}>
          <select value={atanacakPersonel} onChange={(e) => setAtanacakPersonel(e.target.value)}>
            <option value="">Personel seç...</option>
            {personelListesi.map((p) => <option key={p.id} value={p.id}>{p.ad_soyad}</option>)}
          </select>
          <button onClick={ataYap} disabled={!atanacakPersonel || secililer.size === 0}>
            Seçilenleri Ata ({secililer.size})
          </button>
        </div>

        <table>
          <thead>
            <tr><th></th><th>İş Emri No</th><th>Onarılan Kodu</th><th>Onarılan Tanımı</th><th>Problem</th><th>Tarih</th><th>Durum</th><th>Atanan</th><th>Yapılan İş</th></tr>
          </thead>
          <tbody>
            {isEmirleri.map((i) => (
              <tr key={i.id}>
                <td><input type="checkbox" checked={secililer.has(i.id)} onChange={() => toggleSecim(i.id)} /></td>
                <td>{i.is_emri_no}</td>
                <td>{i.onarilan_kodu}</td>
                <td className="muted" style={{ maxWidth: 200 }}>{i.onarilan_tanimi}</td>
                <td className="muted" style={{ maxWidth: 220 }}>{i.problem_tanimi}</td>
                <td>{i.tarih ? new Date(i.tarih).toLocaleString('tr-TR') : '-'}</td>
                <td className={i.durum === 'Kapatıldı' ? 'status-Tamamlandı' : 'status-Beklemede'}>{i.durum}</td>
                <td>{i.atanan?.ad_soyad || <span className="muted">Atanmadı</span>}</td>
                <td className="muted" style={{ maxWidth: 200 }}>
                  {i.yapilan_is || '-'}
                  {i.kapatma_tarihi && <div style={{ fontSize: 11 }}>{i.kapatan?.ad_soyad} · {new Date(i.kapatma_tarihi).toLocaleString('tr-TR')}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="record-list mobile-only">
          {isEmirleri.map((i) => (
            <div key={i.id} className="record-item">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <label className="row">
                  <input type="checkbox" checked={secililer.has(i.id)} onChange={() => toggleSecim(i.id)} />
                  <strong>{i.is_emri_no}</strong>
                </label>
                <span className={i.durum === 'Kapatıldı' ? 'status-Tamamlandı' : 'status-Beklemede'}>{i.durum}</span>
              </div>
              <div className="muted">{i.onarilan_kodu} — {i.onarilan_tanimi}</div>
              <div style={{ marginTop: 4 }}>{i.problem_tanimi}</div>
              <div className="muted">{i.tarih ? new Date(i.tarih).toLocaleString('tr-TR') : '-'}</div>
              <div className="muted">Atanan: {i.atanan?.ad_soyad || 'Atanmadı'}</div>
              {i.yapilan_is && (
                <div className="muted" style={{ marginTop: 4 }}>
                  Yapılan iş: {i.yapilan_is}<br />
                  {i.kapatan?.ad_soyad} · {i.kapatma_tarihi ? new Date(i.kapatma_tarihi).toLocaleString('tr-TR') : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
