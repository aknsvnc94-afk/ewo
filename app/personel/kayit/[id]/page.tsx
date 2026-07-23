'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ResimYukleyici from '@/components/ResimYukleyici';

const ARIZA_TURLERI = ['PLC', 'Yazılım', 'Mekanik', 'Elektrik', 'Hidrolik', 'Pnömatik'];
const MIN_KARAKTER = 10;
const EWO_ESIK_SANIYE = 20 * 60; // 20 dakika

export default function PersonelKayitFormu() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [kayit, setKayit] = useState<any>(null);
  const [arizaTuru, setArizaTuru] = useState<string[]>([]);
  const [tanim, setTanim] = useState('');
  const [cozum, setCozum] = useState('');
  const [resimler, setResimler] = useState<string[]>([]);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [mesaj, setMesaj] = useState('');

  useEffect(() => {
    fetch(`/api/records/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setMesaj(data.error); return; }
        setKayit(data.kayit);
        setArizaTuru(data.kayit.ariza_turu || []);
        setTanim(data.kayit.arizanin_tanimi || '');
        setCozum(data.kayit.direk_sebep_cozum || '');
        setResimler(data.kayit.cozum_resimleri || []);
      });
  }, [id]);

  function turSec(tur: string) {
    setArizaTuru((mevcut) => (mevcut.includes(tur) ? mevcut.filter((t) => t !== tur) : [...mevcut, tur]));
  }

  const gecerli = arizaTuru.length > 0 && tanim.trim().length >= MIN_KARAKTER && cozum.trim().length >= MIN_KARAKTER;

  async function kaydet(gonder: boolean) {
    setKaydediliyor(true);
    setMesaj('');
    try {
      const payload: any = {
        id,
        ariza_turu: arizaTuru,
        arizanin_tanimi: tanim,
        direk_sebep_cozum: cozum,
      };
      if (gonder) payload.tamamlanma_durumu = 'Onay Bekliyor';

      const res = await fetch('/api/update-record', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setMesaj(`Hata: ${data.error}`); return; }
      if (gonder) router.push('/personel');
      else setMesaj('✓ Taslak kaydedildi');
    } finally {
      setKaydediliyor(false);
    }
  }

  async function hizliTamamla() {
    setKaydediliyor(true);
    try {
      const res = await fetch('/api/update-record', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, tamamlanma_durumu: 'Tamamlandı' }),
      });
      if (res.ok) router.push('/personel');
    } finally {
      setKaydediliyor(false);
    }
  }

  if (!kayit) return <div className="container"><p className="muted">{mesaj || 'Yükleniyor...'}</p></div>;

  const ewoGerekli = (kayit.sure_sn || 0) > EWO_ESIK_SANIYE;

  if (!ewoGerekli) {
    return (
      <div className="container">
        <h1>{kayit.tezgah}</h1>
        <p className="muted">{kayit.durus_adi} · {kayit.sure} · {kayit.baslangic ? new Date(kayit.baslangic).toLocaleString('tr-TR') : '-'}</p>
        <div className="card">
          <p>Bu duruş 20 dakikanın altında olduğu için detaylı EWO analiz formu gerekmiyor.</p>
          <button onClick={hizliTamamla} disabled={kaydediliyor}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Tamamlandı Olarak İşaretle'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Arıza Bildirimi</h1>
      <p className="muted">{kayit.tezgah} · {kayit.durus_adi} · {kayit.sure} · {kayit.baslangic ? new Date(kayit.baslangic).toLocaleString('tr-TR') : '-'}</p>
      <p className="muted">Bu duruş 20 dakikanın üzerinde olduğu için tam analiz gerekiyor. Kalan detaylar (zaman çizelgesi, kök neden analizi, önlemler) admin tarafından tamamlanacak.</p>

      <div className="card">
        <h3>Arıza Türü *</h3>
        <div className="row">
          {ARIZA_TURLERI.map((t) => (
            <label key={t} className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={arizaTuru.includes(t)} onChange={() => turSec(t)} /> {t}
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Arızanın Tanımı *</h3>
        <textarea
          value={tanim}
          onChange={(e) => setTanim(e.target.value)}
          rows={4}
          minLength={MIN_KARAKTER}
          placeholder={`En az ${MIN_KARAKTER} karakter yazın...`}
          style={{ width: '100%' }}
        />
        <div className="muted">{tanim.trim().length}/{MIN_KARAKTER} karakter</div>
      </div>

      <div className="card">
        <h3>Direk Sebep ve Çözümü *</h3>
        <textarea
          value={cozum}
          onChange={(e) => setCozum(e.target.value)}
          rows={4}
          minLength={MIN_KARAKTER}
          placeholder={`En az ${MIN_KARAKTER} karakter yazın...`}
          style={{ width: '100%' }}
        />
        <div className="muted">{cozum.trim().length}/{MIN_KARAKTER} karakter</div>
      </div>

      <div className="card">
        <h3>Çözüm Fotoğrafları</h3>
        <ResimYukleyici kayitId={id} resimler={resimler} onDegisti={setResimler} />
      </div>

      {mesaj && <p>{mesaj}</p>}

      <div className="row" style={{ marginBottom: 24 }}>
        <button className="secondary" onClick={() => kaydet(false)} disabled={kaydediliyor}>Taslak Kaydet</button>
        <button onClick={() => kaydet(true)} disabled={kaydediliyor || !gecerli}>
          {kaydediliyor ? 'Gönderiliyor...' : 'Tamamla ve Gönder'}
        </button>
      </div>
      {!gecerli && <p className="muted">Göndermek için: en az bir arıza türü seçin, tanım ve çözüm alanlarına en az {MIN_KARAKTER} karakter yazın.</p>}
    </div>
  );
}
