'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type IsEmri = {
  id: string; is_emri_no: string; onarilan_kodu: string; onarilan_tanimi: string;
  problem_tanimi: string; tarih: string; tesis_adi: string;
  durum: string; yapilan_is: string | null; kapatma_tarihi: string | null;
};

export default function PersonelIsEmirleriPage() {
  const [isEmirleri, setIsEmirleri] = useState<IsEmri[]>([]);
  const [acikId, setAcikId] = useState<string | null>(null);
  const [yapilanIs, setYapilanIs] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function getir() {
    const res = await fetch('/api/is-emirleri');
    const data = await res.json();
    setIsEmirleri(data.isEmirleri || []);
  }

  useEffect(() => { getir(); }, []);

  async function kapat(id: string) {
    if (yapilanIs.trim().length < 5) return;
    setKaydediliyor(true);
    try {
      await fetch(`/api/is-emirleri/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yapilan_is: yapilanIs, durum: 'Kapatıldı' }),
      });
      setAcikId(null); setYapilanIs('');
      getir();
    } finally {
      setKaydediliyor(false);
    }
  }

  const acikIsler = isEmirleri.filter((i) => i.durum === 'Açık');
  const kapaliIsler = isEmirleri.filter((i) => i.durum === 'Kapatıldı');

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>İş Emirlerim</h1>
        <Link href="/personel"><button className="secondary">← Arızalarıma Dön</button></Link>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }} className="status-Beklemede">{acikIsler.length}</div>
          <div className="muted">Açık</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 100, textAlign: 'center', margin: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }} className="status-Tamamlandı">{kapaliIsler.length}</div>
          <div className="muted">Kapatıldı</div>
        </div>
      </div>

      <div className="record-list">
        {isEmirleri.length === 0 && <p className="muted">Size atanmış iş emri yok.</p>}
        {isEmirleri.map((i) => (
          <div key={i.id} className="record-item">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{i.onarilan_kodu}</strong>
              <span className={i.durum === 'Kapatıldı' ? 'status-Tamamlandı' : 'status-Beklemede'}>{i.durum}</span>
            </div>
            <div className="muted">{i.onarilan_tanimi}</div>
            <div style={{ marginTop: 6 }}>{i.problem_tanimi}</div>
            <div className="muted">İş Emri No: {i.is_emri_no} · {i.tarih ? new Date(i.tarih).toLocaleString('tr-TR') : '-'}</div>

            {i.durum === 'Kapatıldı' ? (
              <div className="muted" style={{ marginTop: 8 }}>
                <strong>Yapılan iş:</strong> {i.yapilan_is}<br />
                {i.kapatma_tarihi ? new Date(i.kapatma_tarihi).toLocaleString('tr-TR') : ''}
              </div>
            ) : acikId === i.id ? (
              <div style={{ marginTop: 8 }}>
                <textarea
                  placeholder="Yaptığınız işi yazın (en az 5 karakter)"
                  value={yapilanIs}
                  onChange={(e) => setYapilanIs(e.target.value)}
                  rows={3}
                  style={{ width: '100%' }}
                />
                <div className="row" style={{ marginTop: 6 }}>
                  <button onClick={() => kapat(i.id)} disabled={kaydediliyor || yapilanIs.trim().length < 5}>
                    {kaydediliyor ? 'Kaydediliyor...' : 'İşi Bitir ve Kapat'}
                  </button>
                  <button className="secondary" onClick={() => { setAcikId(null); setYapilanIs(''); }}>Vazgeç</button>
                </div>
              </div>
            ) : (
              <button className="secondary" style={{ marginTop: 8 }} onClick={() => { setAcikId(i.id); setYapilanIs(''); }}>
                Yapılan İşi Yaz / Kapat
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
