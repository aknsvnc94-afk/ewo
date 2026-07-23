'use client';
import { useState } from 'react';
import { resimSikistir } from '@/lib/imageCompress';

export default function ResimYukleyici({
  kayitId, resimler, onDegisti,
}: { kayitId: string; resimler: string[]; onDegisti: (yeni: string[]) => void }) {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState('');

  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setYukleniyor(true);
    setHata('');
    try {
      const sikistirilmis = await resimSikistir(file);
      const fd = new FormData();
      fd.append('file', sikistirilmis, 'foto.jpg');
      fd.append('kayit_id', kayitId);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setHata(data.error || 'Yükleme başarısız'); return; }
      onDegisti(data.resimler);
    } catch (err: any) {
      setHata(err?.message || 'Resim işlenemedi');
    } finally {
      setYukleniyor(false);
      e.target.value = '';
    }
  }

  async function resimSil(url: string) {
    const res = await fetch('/api/upload-image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kayit_id: kayitId, url }),
    });
    const data = await res.json();
    if (res.ok) onDegisti(data.resimler);
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        {resimler.map((url) => (
          <div key={url} style={{ position: 'relative' }}>
            <img src={url} alt="çözüm görseli" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
            <button
              type="button"
              onClick={() => resimSil(url)}
              className="danger"
              style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, padding: 0, borderRadius: '50%', fontSize: 12, lineHeight: '22px' }}
            >×</button>
          </div>
        ))}
      </div>
      <label>
        <input type="file" accept="image/*" capture="environment" onChange={dosyaSecildi} disabled={yukleniyor} style={{ display: 'none' }} />
        <span className="secondary" style={{ display: 'inline-block', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}>
          {yukleniyor ? 'Yükleniyor...' : '📷 Fotoğraf Ekle'}
        </span>
      </label>
      {hata && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 6 }}>{hata}</div>}
    </div>
  );
}
