'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

function tarih(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('tr-TR');
}

export default function PdfGorunumuPage() {
  const params = useParams();
  const id = params?.id as string;
  const [kayit, setKayit] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/records/${id}`).then((r) => r.json()).then((data) => setKayit(data.kayit));
  }, [id]);

  if (!kayit) return <div style={{ padding: 20 }}>Yükleniyor...</div>;

  const turler = ['PLC', 'Yazılım', 'Mekanik', 'Elektrik', 'Hidrolik', 'Pnömatik'];
  const secilenTurler: string[] = kayit.ariza_turu || [];
  const onlemlerKok = (kayit.onlemler_kok_neden || []).filter((o: any) => o?.aciklama);
  const onlemlerSifir = (kayit.onlemler_sifir_ariza || []).filter((o: any) => o?.aciklama);

  return (
    <>
      <style>{`
        body { background: #fff; color: #111; font-family: Arial, sans-serif; }
        .pdf-page { max-width: 900px; margin: 0 auto; padding: 24px; }
        .pdf-title { text-align: center; font-size: 18px; font-weight: 700; border: 2px solid #000; padding: 8px; margin-bottom: 0; }
        table.pdf-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        table.pdf-table td, table.pdf-table th { border: 1px solid #000; padding: 6px 8px; font-size: 12px; vertical-align: top; }
        table.pdf-table th { background: #e5e5e5; text-align: left; }
        .lbl { font-weight: 700; background: #f0f0f0; white-space: nowrap; }
        .print-btn { margin: 16px 0; }
        @media print {
          .print-btn { display: none; }
          .pdf-page { padding: 0; }
        }
      `}</style>
      <div className="pdf-page">
        <button className="print-btn" onClick={() => window.print()}>PDF Olarak Kaydet / Yazdır</button>

        <div className="pdf-title">ARIZA MÜDAHALE ve ANALİZ FORMU (EWO)</div>

        <table className="pdf-table">
          <tbody>
            <tr>
              <td className="lbl">Tarih</td><td>{tarih(kayit.baslangic)}</td>
              <td className="lbl">Vardiya</td><td>{kayit.vardiya ?? ''}</td>
              <td className="lbl">Makine No</td><td>{kayit.tezgah}</td>
            </tr>
            <tr>
              <td className="lbl">Müdahale eden Bakımcı</td><td colSpan={3}>{kayit.personel?.ad_soyad || ''}</td>
              <td className="lbl">Doküman no</td><td>{kayit.dokuman_no || 'F13-31(R00)'}</td>
            </tr>
          </tbody>
        </table>

        <table className="pdf-table">
          <tbody>
            <tr>
              <td className="lbl">Arıza türü</td>
              <td colSpan={5}>
                {turler.map((t) => `${secilenTurler.includes(t) ? '☑' : '☐'} ${t}`).join('   ')}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="pdf-table">
          <thead>
            <tr>
              <th>Arıza başlangıcı</th><th>Müdahale başlangıcı</th><th>Teşhis başlangıcı</th>
              <th>Tamir başlangıcı</th><th>Yedek parça bekleme</th><th>Yeniden montaj başlangıcı</th>
              <th>Makinenin başlatılması</th><th>Üretim başlangıcı</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{tarih(kayit.zaman_ariza_baslangic)}</td>
              <td>{tarih(kayit.zaman_mudahale_baslangic)}</td>
              <td>{tarih(kayit.zaman_teshis_baslangic)}</td>
              <td>{tarih(kayit.zaman_tamir_baslangic)}</td>
              <td>{tarih(kayit.zaman_yedek_parca_bekleme)}</td>
              <td>{tarih(kayit.zaman_montaj_baslangic)}</td>
              <td>{tarih(kayit.zaman_makine_baslatilma)}</td>
              <td>{tarih(kayit.zaman_uretim_baslangic)}</td>
            </tr>
          </tbody>
        </table>

        <table className="pdf-table">
          <tbody>
            <tr><td className="lbl" style={{ width: 160 }}>Arızanın tanımı</td><td>{kayit.arizanin_tanimi || ''}</td></tr>
            <tr><td className="lbl">Direk Sebep ve çözümü</td><td>{kayit.direk_sebep_cozum || ''}</td></tr>
          </tbody>
        </table>

        <table className="pdf-table">
          <thead>
            <tr><th>Direk Sebep</th><th>Neden 1</th><th>Neden 2</th><th>Neden 3</th><th>Neden 4</th><th>Neden 5</th><th>Kök Sebep Tipi</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>{kayit.direk_sebep || ''}</td><td>{kayit.neden_1 || ''}</td><td>{kayit.neden_2 || ''}</td>
              <td>{kayit.neden_3 || ''}</td><td>{kayit.neden_4 || ''}</td><td>{kayit.neden_5 || ''}</td>
              <td>{kayit.kok_neden_turu || ''}</td>
            </tr>
          </tbody>
        </table>

        <table className="pdf-table">
          <thead><tr><th colSpan={3}>Makine Arızasının Kök Nedenlerine Karşı Önlemler</th></tr>
            <tr><th>#</th><th>Önlem</th><th>Sorumlu / Plan Tarihi</th></tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{onlemlerKok[i]?.aciklama || ''}</td>
                <td>{onlemlerKok[i] ? `${onlemlerKok[i].sorumlu || ''} / ${onlemlerKok[i].plan_tarihi || ''}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="pdf-table">
          <thead><tr><th colSpan={3}>Sıfır Arızayı Sürdürmek İçin Eylemler</th></tr>
            <tr><th>#</th><th>Eylem</th><th>Sorumlu / Plan Tarihi</th></tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map((i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{onlemlerSifir[i]?.aciklama || ''}</td>
                <td>{onlemlerSifir[i] ? `${onlemlerSifir[i].sorumlu || ''} / ${onlemlerSifir[i].plan_tarihi || ''}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="pdf-table">
          <tbody>
            <tr>
              <td className="lbl">Analiz sorumlusu</td><td>{kayit.analiz_sorumlusu || ''}</td>
              <td className="lbl">Sonuç</td><td colSpan={3}>{kayit.sonuc || ''}</td>
            </tr>
            <tr>
              <td className="lbl">Yönetici Onayı</td><td></td>
              <td className="lbl">İmza</td><td></td>
              <td className="lbl">Tarih</td><td></td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: 'right', fontSize: 11, color: '#666' }}>{kayit.dokuman_no || 'F13-31(R00)'}</div>
      </div>
    </>
  );
}
