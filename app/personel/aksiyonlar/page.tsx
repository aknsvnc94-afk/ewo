'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Aksiyon = {
  id: string; tip: string; aciklama: string; plan_tarihi: string | null; durum: string;
  kapatma_aciklamasi: string | null; ariza_kayit_id: string;
  kayit: { tezgah: string; kategori: string; durus_adi: string } | null;
};

function gecikmisMi(plan_tarihi: string | null, durum: string) {
  if (!plan_tarihi || durum === 'Kapatıldı') return false;
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  return new Date(plan_tarihi) < bugun;
}

export default function PersonelAksiyonlarPage() {
  const [aksiyonlar, setAksiyonlar] = useState<Aksiyon[]>([]);
  const [acikNotId, setAcikNotId] = useState<string | null>(null);
  const [not, setNot] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function getir() {
    const res = await fetch('/api/aksiyonlar');
    const data = await res.json();
    setAksiyonlar(data.aksiyonlar || []);
  }

  useEffect(() => { getir(); }, []);

  async function kapatmaGonder(id: string) {
    setGonderiliyor(true);
    try {
      await fetch(`/api/aksiyonlar/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durum: 'Onay Bekliyor', kapatma_aciklamasi: not }),
      });
      setAcikNotId(null); setNot('');
      getir();
    } finally {
      setGonderiliyor(false);
    }
  }

  const toplam = aksiyonlar.length;
  const acik = aksiyonlar.filter((a) => a.durum === 'Açık').length;
  const onayBekleyen = aksiyonlar.filter((a) => a.durum === 'Onay Bekliyor').length;
  const kapatilan = aksiyonlar.filter((a) => a.durum === 'Kapatıldı').length;
  const gecikmis = aksiyonlar.filter((a) => gecikmisMi(a.plan_tarihi, a.durum)).length;

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Aksiyonlarım</h1>
        <Link href="/personel"><button className="secondary">← Arızalarıma Dön</button></Link>
      </div>

      <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: 90, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{toplam}</div><div className="muted">Toplam</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 90, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }} className="status-Beklemede">{acik}</div><div className="muted">Açık</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 90, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }} className="status-Devam">{onayBekleyen}</div><div className="muted">Onay Bekliyor</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 90, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }} className="status-Tamamlandı">{kapatilan}</div><div className="muted">Kapatıldı</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 90, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--danger)' }}>{gecikmis}</div><div className="muted">Gecikmiş</div>
        </div>
      </div>

      <div className="record-list">
        {aksiyonlar.length === 0 && <p className="muted">Size atanmış aksiyon yok.</p>}
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
              <div className="muted">{a.tip === 'kok_neden' ? 'Kök Nedene Karşı Önlem' : 'Sıfır Arıza Eylemi'}</div>
              <div style={{ marginTop: 6 }}>{a.aciklama}</div>
              <div className={`status-${a.durum.replace(' ', '')}`} style={{ marginTop: 6, fontWeight: 600 }}>{a.durum}</div>

              {a.durum === 'Açık' && (
                acikNotId === a.id ? (
                  <div style={{ marginTop: 8 }}>
                    <textarea
                      placeholder="Kapatma açıklaması (ne yaptınız?)"
                      value={not}
                      onChange={(e) => setNot(e.target.value)}
                      rows={2}
                      style={{ width: '100%' }}
                    />
                    <div className="row" style={{ marginTop: 6 }}>
                      <button onClick={() => kapatmaGonder(a.id)} disabled={gonderiliyor || not.trim().length === 0}>
                        {gonderiliyor ? 'Gönderiliyor...' : 'Kapatma İsteği Gönder'}
                      </button>
                      <button className="secondary" onClick={() => { setAcikNotId(null); setNot(''); }}>Vazgeç</button>
                    </div>
                  </div>
                ) : (
                  <button className="secondary" style={{ marginTop: 8 }} onClick={() => { setAcikNotId(a.id); setNot(''); }}>
                    Kapat
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
