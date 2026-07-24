'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Aksiyon = {
  id: string; tip: string; aciklama: string; plan_tarihi: string | null; durum: string;
  kapatma_aciklamasi: string | null; ariza_kayit_id: string;
  sorumlu: { ad_soyad: string } | null;
  kayit: { tezgah: string; kategori: string; durus_adi: string } | null;
};

function gecikmisMi(plan_tarihi: string | null, durum: string) {
  if (!plan_tarihi || durum === 'Kapatıldı') return false;
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  return new Date(plan_tarihi) < bugun;
}

export default function AdminAksiyonTakipPage() {
  const [aksiyonlar, setAksiyonlar] = useState<Aksiyon[]>([]);
  const [durumFiltre, setDurumFiltre] = useState('');
  const [mesaj, setMesaj] = useState('');

  async function getir() {
    const url = durumFiltre ? `/api/aksiyonlar?durum=${encodeURIComponent(durumFiltre)}` : '/api/aksiyonlar';
    const res = await fetch(url);
    const data = await res.json();
    setAksiyonlar(data.aksiyonlar || []);
  }

  useEffect(() => { getir(); }, [durumFiltre]);

  const sayimlar = useMemo(() => {
    const gecikmis = aksiyonlar.filter((a) => gecikmisMi(a.plan_tarihi, a.durum)).length;
    return {
      toplam: aksiyonlar.length,
      acik: aksiyonlar.filter((a) => a.durum === 'Açık').length,
      onayBekleyen: aksiyonlar.filter((a) => a.durum === 'Onay Bekliyor').length,
      kapatilan: aksiyonlar.filter((a) => a.durum === 'Kapatıldı').length,
      gecikmis,
    };
  }, [aksiyonlar]);

  async function durumDegistir(id: string, yeniDurum: string) {
    await fetch(`/api/aksiyonlar/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ durum: yeniDurum }),
    });
    getir();
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Aksiyon Takip</h1>
        <Link href="/admin"><button className="secondary">← Admin Paneline Dön</button></Link>
      </div>

      <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{sayimlar.toplam}</div><div className="muted">Toplam</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }} className="status-Beklemede">{sayimlar.acik}</div><div className="muted">Açık</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }} className="status-Devam">{sayimlar.onayBekleyen}</div><div className="muted">Onay Bekliyor</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }} className="status-Tamamlandı">{sayimlar.kapatilan}</div><div className="muted">Kapatıldı</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--danger)' }}>{sayimlar.gecikmis}</div><div className="muted">Gecikmiş</div>
        </div>
      </div>

      <div className="card">
        <select value={durumFiltre} onChange={(e) => setDurumFiltre(e.target.value)}>
          <option value="">Tüm Durumlar</option>
          <option value="Açık">Açık</option>
          <option value="Onay Bekliyor">Onay Bekliyor</option>
          <option value="Kapatıldı">Kapatıldı</option>
        </select>

        <div className="record-list" style={{ marginTop: 12 }}>
          {aksiyonlar.length === 0 && <p className="muted">Aksiyon bulunamadı.</p>}
          {aksiyonlar.map((a) => {
            const gecikmis = gecikmisMi(a.plan_tarihi, a.durum);
            return (
              <div key={a.id} className="record-item" style={{ borderLeft: `4px solid ${gecikmis ? 'var(--danger)' : 'var(--ok)'}` }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{a.kayit?.tezgah} — {a.kayit?.durus_adi}</strong>
                  <span className={gecikmis ? 'status-İptal' : 'status-Tamamlandı'} style={{ fontWeight: 700 }}>
                    {a.plan_tarihi ? new Date(a.plan_tarihi).toLocaleDateString('tr-TR') : 'Tarih yok'}
                    {gecikmis ? ' (GECİKMİŞ)' : ''}
                  </span>
                </div>
                <div className="muted">{a.tip === 'kok_neden' ? 'Kök Nedene Karşı Önlem' : 'Sıfır Arıza Eylemi'} · Sorumlu: {a.sorumlu?.ad_soyad || 'Atanmamış'}</div>
                <div style={{ marginTop: 6 }}>{a.aciklama}</div>
                {a.kapatma_aciklamasi && <div className="muted" style={{ marginTop: 6 }}>Kapatma notu: {a.kapatma_aciklamasi}</div>}
                <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
                  <span className={`status-${a.durum.replace(' ', '')}`}>{a.durum}</span>
                  <div className="row">
                    {a.durum === 'Onay Bekliyor' && (
                      <>
                        <button onClick={() => durumDegistir(a.id, 'Kapatıldı')}>Onayla</button>
                        <button className="secondary" onClick={() => durumDegistir(a.id, 'Açık')}>Geri Gönder</button>
                      </>
                    )}
                    {a.durum === 'Kapatıldı' && (
                      <button className="secondary" onClick={() => durumDegistir(a.id, 'Açık')}>Yeniden Aç</button>
                    )}
                    <Link href={`/admin/kayit/${a.ariza_kayit_id}`}><button className="secondary">Kaydı Gör</button></Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
