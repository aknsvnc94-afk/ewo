'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Kalem = {
  id: string; satir_metni: string; stok_kodu: string | null; miktar: string | null; teslim_tarihi: string | null;
  alindi: boolean; alinma_tarihi: string | null;
  alan: { ad_soyad: string } | null;
  siparis: { id: string; dosya_adi: string; talep_no: string | null; yuklenme_tarihi: string } | null;
};

function turkceTarihToDate(t: string | null): Date | null {
  if (!t) return null;
  const [g, a, y] = t.split('.');
  if (!g || !a || !y) return null;
  return new Date(Number(y), Number(a) - 1, Number(g));
}

function gecikmisMi(teslimTarihi: string | null, alindi: boolean) {
  if (!teslimTarihi || alindi) return false;
  const t = turkceTarihToDate(teslimTarihi);
  if (!t) return false;
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  return t < bugun;
}

export default function MalzemelerPage() {
  const [kalemler, setKalemler] = useState<Kalem[]>([]);
  const [sadeceBekleyen, setSadeceBekleyen] = useState(true);
  const [isleniyor, setIsleniyor] = useState<string | null>(null);

  async function getir() {
    const res = await fetch('/api/siparis-kalemi');
    const data = await res.json();
    setKalemler(data.kalemler || []);
  }

  useEffect(() => { getir(); }, []);

  async function alindiIsaretle(id: string, deger: boolean) {
    setIsleniyor(id);
    try {
      await fetch(`/api/siparis-kalemi/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alindi: deger }),
      });
      await getir();
    } finally {
      setIsleniyor(null);
    }
  }

  const gosterilecekler = sadeceBekleyen ? kalemler.filter((k) => !k.alindi) : kalemler;

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Gelen Malzemeler</h1>
        <Link href="/personel"><button className="secondary">← Arızalarıma Dön</button></Link>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <label className="row">
          <input type="checkbox" checked={sadeceBekleyen} onChange={(e) => setSadeceBekleyen(e.target.checked)} />
          Sadece bekleyenleri göster
        </label>
      </div>

      <div className="record-list">
        {gosterilecekler.length === 0 && <p className="muted">Gösterilecek malzeme yok.</p>}
        {gosterilecekler.map((k) => {
          const gecikmis = gecikmisMi(k.teslim_tarihi, k.alindi);
          const aciklama = k.stok_kodu ? k.satir_metni.split('—')[1]?.split('|')[0]?.trim() : k.satir_metni;
          return (
            <div key={k.id} className="record-item" style={{ borderLeft: gecikmis ? '4px solid var(--danger)' : undefined }}>
              <div>{k.stok_kodu ? `${k.stok_kodu} — ` : ''}{aciklama}</div>
              {k.miktar && <div className="muted">Miktar: {k.miktar}</div>}
              {k.teslim_tarihi && (
                <div style={{ color: gecikmis ? 'var(--danger)' : undefined, fontWeight: gecikmis ? 700 : undefined }} className={gecikmis ? '' : 'muted'}>
                  Teslim Tarihi: {k.teslim_tarihi} {gecikmis ? '(GECİKMİŞ)' : ''}
                </div>
              )}
              <div className="muted">{k.siparis?.talep_no ? `Talep No: ${k.siparis.talep_no}` : k.siparis?.dosya_adi}</div>
              {k.alindi ? (
                <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
                  <span className="status-Tamamlandı">✓ {k.alan?.ad_soyad} tarafından alındı — {k.alinma_tarihi ? new Date(k.alinma_tarihi).toLocaleString('tr-TR') : ''}</span>
                  <button className="secondary" onClick={() => alindiIsaretle(k.id, false)} disabled={isleniyor === k.id}>Geri Al</button>
                </div>
              ) : (
                <button style={{ marginTop: 8 }} onClick={() => alindiIsaretle(k.id, true)} disabled={isleniyor === k.id}>
                  {isleniyor === k.id ? 'İşleniyor...' : 'Alındı'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
