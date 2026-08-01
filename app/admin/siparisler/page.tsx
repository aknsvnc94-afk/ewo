'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Siparis = {
  id: string; dosya_adi: string; yuklenme_tarihi: string;
  talep_no: string | null; tarih: string | null; bolum: string | null; kisi: string | null;
  yukleyen: { ad_soyad: string } | null;
  toplam_kalem: number; alinan_kalem: number;
  departman_onayi: boolean; satinalma_onayi: boolean; talep_onayi: boolean;
};

export default function SiparislerPage() {
  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [mesaj, setMesaj] = useState('');

  async function getir() {
    const res = await fetch('/api/siparis');
    const data = await res.json();
    setSiparisler(data.siparisler || []);
  }

  useEffect(() => { getir(); }, []);

  async function siparisSil(s: Siparis, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`"${s.talep_no ? `Talep No: ${s.talep_no}` : s.dosya_adi}" siparişini ve tüm kalemlerini KALICI olarak silmek istediğinize emin misiniz?`)) return;
    const res = await fetch(`/api/siparis/${s.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
    setMesaj('✓ Sipariş silindi');
    getir();
  }

  async function dosyaYukle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setYukleniyor(true);
    setMesaj('PDF işleniyor...');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/siparis/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
      const makineMesaji = data.makine_eslesme_sayisi > 0 ? `, ${data.makine_eslesme_sayisi} makine eşleşmesi bulundu` : '';
      setMesaj(`✓ ${data.kalem_sayisi} satır çıkarıldı${makineMesaji}`);
      getir();
    } finally {
      setYukleniyor(false);
      e.target.value = '';
    }
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Sipariş Takip</h1>
        <Link href="/admin"><button className="secondary">← Admin Paneline Dön</button></Link>
      </div>

      <div className="card">
        <h3>Sipariş PDF Yükle</h3>
        <p className="muted">ERP'den siparişi açtıktan sonra oluşan PDF'i buraya yükleyin. Sistem PDF'teki metni satır satır çıkarıp listeler.</p>
        <input type="file" accept=".pdf" onChange={dosyaYukle} disabled={yukleniyor} />
        {mesaj && <p style={{ marginTop: 10 }}>{mesaj}</p>}
      </div>

      <div className="card">
        <h3>Yüklenen Siparişler ({siparisler.length})</h3>
        <div className="record-list">
          {siparisler.length === 0 && <p className="muted">Henüz sipariş yüklenmedi.</p>}
          {siparisler.map((s) => (
            <Link key={s.id} href={`/panel/bakim/siparisler/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="record-item">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{s.talep_no ? `Talep No: ${s.talep_no}` : s.dosya_adi}</strong>
                  <span className={s.alinan_kalem === s.toplam_kalem && s.toplam_kalem > 0 ? 'status-Tamamlandı' : 'status-Beklemede'}>
                    {s.alinan_kalem}/{s.toplam_kalem} alındı
                  </span>
                </div>
                <div className="muted">{s.dosya_adi}</div>
                {(s.bolum || s.kisi) && <div className="muted">{s.bolum} · {s.kisi}</div>}
                <div className="muted">
                  {s.tarih ? `Talep Tarihi: ${s.tarih} · ` : ''}
                  Yüklenme: {new Date(s.yuklenme_tarihi).toLocaleString('tr-TR')} · Yükleyen: {s.yukleyen?.ad_soyad || '-'}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="danger" onClick={(e) => siparisSil(s, e)}>Sil</button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
