'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Kalem = {
  id: string; satir_metni: string; stok_kodu: string | null; miktar: string | null; teslim_tarihi: string | null;
  alindi: boolean; alinma_tarihi: string | null;
  alan: { ad_soyad: string } | null;
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

export default function SiparisDetayPage() {
  const params = useParams();
  const id = params?.id as string;
  const [siparis, setSiparis] = useState<any>(null);
  const [kalemler, setKalemler] = useState<Kalem[]>([]);

  async function getir() {
    const res = await fetch(`/api/siparis/${id}`);
    const data = await res.json();
    if (data.error) return;
    setSiparis(data.siparis);
    setKalemler(data.kalemler || []);
  }

  useEffect(() => { getir(); }, [id]);

  if (!siparis) return <div className="container"><p className="muted">Yükleniyor...</p></div>;

  const alinan = kalemler.filter((k) => k.alindi).length;

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{siparis.talep_no ? `Talep No: ${siparis.talep_no}` : siparis.dosya_adi}</h1>
        <Link href="/admin/siparisler"><button className="secondary">← Sipariş Listesine Dön</button></Link>
      </div>
      <p className="muted">
        {siparis.bolum && <>Bölüm: {siparis.bolum} · </>}
        {siparis.kisi && <>Talep Eden: {siparis.kisi} · </>}
        {siparis.tarih && <>Talep Tarihi: {siparis.tarih} · </>}
        Yüklenme: {new Date(siparis.yuklenme_tarihi).toLocaleString('tr-TR')} · Yükleyen: {siparis.yukleyen?.ad_soyad || '-'}
        {siparis.pdf_url && <> · <a href={siparis.pdf_url} target="_blank" rel="noopener noreferrer">Orijinal PDF</a></>}
      </p>

      <div className="card">
        <h3>Kalemler ({alinan}/{kalemler.length} alındı)</h3>
        <table>
          <thead><tr><th>#</th><th>Stok Kodu</th><th>Açıklama</th><th>Miktar</th><th>Teslim Tarihi</th><th>Durum</th><th>Alan</th><th>Tarih/Saat</th></tr></thead>
          <tbody>
            {kalemler.map((k, i) => {
              const gecikmis = gecikmisMi(k.teslim_tarihi, k.alindi);
              return (
                <tr key={k.id}>
                  <td>{i + 1}</td>
                  <td>{k.stok_kodu || '-'}</td>
                  <td>{k.stok_kodu ? k.satir_metni.split('—')[1]?.split('|')[0]?.trim() : k.satir_metni}</td>
                  <td>{k.miktar || '-'}</td>
                  <td style={{ color: gecikmis ? 'var(--danger)' : undefined, fontWeight: gecikmis ? 700 : undefined }}>
                    {k.teslim_tarihi || '-'} {gecikmis ? '(GECİKMİŞ)' : ''}
                  </td>
                  <td className={k.alindi ? 'status-Tamamlandı' : 'status-Beklemede'}>{k.alindi ? 'Alındı' : 'Bekliyor'}</td>
                  <td>{k.alan?.ad_soyad || '-'}</td>
                  <td>{k.alinma_tarihi ? new Date(k.alinma_tarihi).toLocaleString('tr-TR') : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="record-list mobile-only">
          {kalemler.map((k, i) => {
            const gecikmis = gecikmisMi(k.teslim_tarihi, k.alindi);
            return (
              <div key={k.id} className="record-item" style={{ borderLeft: gecikmis ? '4px solid var(--danger)' : undefined }}>
                <div>{i + 1}. {k.stok_kodu ? `${k.stok_kodu} — ` : ''}{k.stok_kodu ? k.satir_metni.split('—')[1]?.split('|')[0]?.trim() : k.satir_metni}</div>
                {k.miktar && <div className="muted">Miktar: {k.miktar}</div>}
                {k.teslim_tarihi && <div className={gecikmis ? '' : 'muted'} style={{ color: gecikmis ? 'var(--danger)' : undefined, fontWeight: gecikmis ? 700 : undefined }}>Teslim: {k.teslim_tarihi} {gecikmis ? '(GECİKMİŞ)' : ''}</div>}
                <div className={k.alindi ? 'status-Tamamlandı' : 'status-Beklemede'}>{k.alindi ? 'Alındı' : 'Bekliyor'}</div>
                {k.alindi && <div className="muted">{k.alan?.ad_soyad} · {k.alinma_tarihi ? new Date(k.alinma_tarihi).toLocaleString('tr-TR') : ''}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
