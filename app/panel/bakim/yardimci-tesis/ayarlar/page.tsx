'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

type Cihaz = {
  id: string; ad: string; baglanti_tipi: 'rs485' | 'wifi_tcp';
  baglanti_ayarlari: { port?: string; baud_rate?: number; ip?: string };
  modbus_slave_id: number; aktif: boolean; son_gorulme: string | null;
};

type Ekipman = {
  id: string; ad: string; tur: string; kontrol_edilebilir: boolean;
  okuma_register_adresi: number | null; okuma_register_tipi: string | null; okuma_veri_tipi: string;
  birim: string | null; carpan: number;
  yazma_register_adresi: number | null; yazma_register_tipi: string | null;
  setpoint_register_adresi: number | null; setpoint_min: number | null; setpoint_max: number | null;
  aktif: boolean;
  cihaz: { id: string; ad: string } | null;
};

const BOS_CIHAZ_FORM = { ad: '', baglanti_tipi: 'rs485' as const, port: '', baud_rate: '9600', ip: '', tcp_port: '502', modbus_slave_id: '1' };
const BOS_EKIPMAN_FORM = {
  ad: '', tur: 'sicaklik', cihaz_id: '', kontrol_edilebilir: false,
  okuma_register_adresi: '', okuma_register_tipi: 'holding_register', okuma_veri_tipi: 'int16', birim: '', carpan: '1',
  yazma_register_adresi: '', yazma_register_tipi: 'coil',
  setpoint_register_adresi: '', setpoint_min: '', setpoint_max: '',
};

export default function YardimciTesisAyarlarPage() {
  const [cihazlar, setCihazlar] = useState<Cihaz[]>([]);
  const [ekipmanlar, setEkipmanlar] = useState<Ekipman[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');

  const [cihazForm, setCihazForm] = useState(BOS_CIHAZ_FORM);
  const [cihazGonderiliyor, setCihazGonderiliyor] = useState(false);

  const [ekipmanForm, setEkipmanForm] = useState(BOS_EKIPMAN_FORM);
  const [ekipmanGonderiliyor, setEkipmanGonderiliyor] = useState(false);
  const [ekipmanFormAcik, setEkipmanFormAcik] = useState(false);

  const verileriGetir = useCallback(async () => {
    const [cRes, eRes] = await Promise.all([
      fetch('/api/yardimci-tesis/cihazlar'),
      fetch('/api/yardimci-tesis/ekipmanlar'),
    ]);
    const cData = await cRes.json();
    const eData = await eRes.json();
    if (cRes.ok) setCihazlar(cData.cihazlar || []);
    if (eRes.ok) setEkipmanlar(eData.ekipmanlar || []);
    setYukleniyor(false);
  }, []);

  useEffect(() => { verileriGetir(); }, [verileriGetir]);

  async function cihazEkle(e: React.FormEvent) {
    e.preventDefault();
    setHata('');
    setCihazGonderiliyor(true);
    try {
      const baglanti_ayarlari = cihazForm.baglanti_tipi === 'rs485'
        ? { port: cihazForm.port, baud_rate: Number(cihazForm.baud_rate) }
        : { ip: cihazForm.ip, port: Number(cihazForm.tcp_port) };
      const res = await fetch('/api/yardimci-tesis/cihazlar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ad: cihazForm.ad, baglanti_tipi: cihazForm.baglanti_tipi,
          baglanti_ayarlari, modbus_slave_id: Number(cihazForm.modbus_slave_id),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setHata(data.error); return; }
      setCihazForm(BOS_CIHAZ_FORM);
      verileriGetir();
    } finally {
      setCihazGonderiliyor(false);
    }
  }

  async function cihazSil(id: string) {
    if (!confirm('Bu cihazı ve ona bağlı tüm ekipman tanımlarını silmek istediğinize emin misiniz?')) return;
    await fetch(`/api/yardimci-tesis/cihazlar/${id}`, { method: 'DELETE' });
    verileriGetir();
  }

  async function ekipmanEkle(e: React.FormEvent) {
    e.preventDefault();
    setHata('');
    setEkipmanGonderiliyor(true);
    try {
      const gonderilecek: any = {
        ad: ekipmanForm.ad, tur: ekipmanForm.tur, cihaz_id: ekipmanForm.cihaz_id,
        kontrol_edilebilir: ekipmanForm.kontrol_edilebilir,
        okuma_register_adresi: ekipmanForm.okuma_register_adresi ? Number(ekipmanForm.okuma_register_adresi) : null,
        okuma_register_tipi: ekipmanForm.okuma_register_tipi,
        okuma_veri_tipi: ekipmanForm.okuma_veri_tipi,
        birim: ekipmanForm.birim || null,
        carpan: ekipmanForm.carpan ? Number(ekipmanForm.carpan) : 1,
      };
      if (ekipmanForm.kontrol_edilebilir) {
        gonderilecek.yazma_register_adresi = ekipmanForm.yazma_register_adresi ? Number(ekipmanForm.yazma_register_adresi) : null;
        gonderilecek.yazma_register_tipi = ekipmanForm.yazma_register_tipi;
      }
      if (ekipmanForm.setpoint_register_adresi) {
        gonderilecek.setpoint_register_adresi = Number(ekipmanForm.setpoint_register_adresi);
        gonderilecek.setpoint_min = ekipmanForm.setpoint_min ? Number(ekipmanForm.setpoint_min) : null;
        gonderilecek.setpoint_max = ekipmanForm.setpoint_max ? Number(ekipmanForm.setpoint_max) : null;
      }
      const res = await fetch('/api/yardimci-tesis/ekipmanlar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gonderilecek),
      });
      const data = await res.json();
      if (!res.ok) { setHata(data.error); return; }
      setEkipmanForm(BOS_EKIPMAN_FORM);
      setEkipmanFormAcik(false);
      verileriGetir();
    } finally {
      setEkipmanGonderiliyor(false);
    }
  }

  async function ekipmanSil(id: string) {
    if (!confirm('Bu ekipman tanımını silmek istediğinize emin misiniz?')) return;
    await fetch(`/api/yardimci-tesis/ekipmanlar/${id}`, { method: 'DELETE' });
    verileriGetir();
  }

  if (yukleniyor) return <div className="container"><p className="muted">Yükleniyor...</p></div>;

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Yardımcı Tesis — Cihaz / Ekipman Ayarları</h1>
        <Link href="/panel/bakim/yardimci-tesis"><button className="secondary">← Kontrol Paneline Dön</button></Link>
      </div>

      {hata && <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{hata}</div>}

      {/* ================= CİHAZLAR ================= */}
      <div className="card">
        <h3>AnKA GLC Cihazları</h3>
        <table>
          <thead><tr><th>Ad</th><th>Bağlantı</th><th>Slave ID</th><th>Son Görülme</th><th>Durum</th><th></th></tr></thead>
          <tbody>
            {cihazlar.map((c) => (
              <tr key={c.id}>
                <td>{c.ad}</td>
                <td className="muted" style={{ fontSize: 12.5 }}>
                  {c.baglanti_tipi === 'rs485'
                    ? `RS485 · ${c.baglanti_ayarlari.port || '-'} @ ${c.baglanti_ayarlari.baud_rate || '-'} baud`
                    : `Wi-Fi (TCP) · ${c.baglanti_ayarlari.ip || '-'}`}
                </td>
                <td>{c.modbus_slave_id}</td>
                <td className="muted" style={{ fontSize: 12.5 }}>
                  {c.son_gorulme ? new Date(c.son_gorulme).toLocaleString('tr-TR') : 'hiç bağlanmadı'}
                </td>
                <td className={c.aktif ? 'status-Tamamlandı' : 'muted'}>{c.aktif ? 'Aktif' : 'Pasif'}</td>
                <td><button className="danger" onClick={() => cihazSil(c.id)}>Sil</button></td>
              </tr>
            ))}
            {cihazlar.length === 0 && <tr><td colSpan={6} className="muted">Henüz cihaz eklenmemiş.</td></tr>}
          </tbody>
        </table>

        <h4 style={{ marginTop: 18 }}>Yeni Cihaz Ekle</h4>
        <form onSubmit={cihazEkle}>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <label className="muted">Cihaz Adı
              <input required value={cihazForm.ad} onChange={(e) => setCihazForm({ ...cihazForm, ad: e.target.value })}
                placeholder="örn. Soğutma Odası GLC-1" style={{ display: 'block', marginTop: 4, width: 220 }} />
            </label>
            <label className="muted">Bağlantı Tipi
              <select value={cihazForm.baglanti_tipi} onChange={(e) => setCihazForm({ ...cihazForm, baglanti_tipi: e.target.value as any })} style={{ display: 'block', marginTop: 4 }}>
                <option value="rs485">RS485 (Seri Port)</option>
                <option value="wifi_tcp">Wi-Fi (Modbus TCP)</option>
              </select>
            </label>
            <label className="muted">Modbus Slave ID
              <input type="number" value={cihazForm.modbus_slave_id} onChange={(e) => setCihazForm({ ...cihazForm, modbus_slave_id: e.target.value })} style={{ display: 'block', marginTop: 4, width: 90 }} />
            </label>
          </div>

          {cihazForm.baglanti_tipi === 'rs485' ? (
            <div className="row" style={{ flexWrap: 'wrap', marginTop: 8 }}>
              <label className="muted">Seri Port (köprü PC'sindeki)
                <input required value={cihazForm.port} onChange={(e) => setCihazForm({ ...cihazForm, port: e.target.value })}
                  placeholder="örn. COM3" style={{ display: 'block', marginTop: 4, width: 140 }} />
              </label>
              <label className="muted">Baud Rate
                <input type="number" value={cihazForm.baud_rate} onChange={(e) => setCihazForm({ ...cihazForm, baud_rate: e.target.value })} style={{ display: 'block', marginTop: 4, width: 100 }} />
              </label>
            </div>
          ) : (
            <div className="row" style={{ flexWrap: 'wrap', marginTop: 8 }}>
              <label className="muted">IP Adresi
                <input required value={cihazForm.ip} onChange={(e) => setCihazForm({ ...cihazForm, ip: e.target.value })}
                  placeholder="örn. 192.168.1.50" style={{ display: 'block', marginTop: 4, width: 160 }} />
              </label>
              <label className="muted">TCP Port
                <input type="number" value={cihazForm.tcp_port} onChange={(e) => setCihazForm({ ...cihazForm, tcp_port: e.target.value })} style={{ display: 'block', marginTop: 4, width: 100 }} />
              </label>
            </div>
          )}
          <button type="submit" disabled={cihazGonderiliyor} style={{ marginTop: 10 }}>
            {cihazGonderiliyor ? 'Ekleniyor...' : 'Cihaz Ekle'}
          </button>
        </form>
      </div>

      {/* ================= EKİPMANLAR ================= */}
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>Ekipmanlar (Sensör / Pompa / Kompresör / Chiller)</h3>
          <button className="secondary" onClick={() => setEkipmanFormAcik(!ekipmanFormAcik)}>
            {ekipmanFormAcik ? 'Formu Kapat' : '+ Yeni Ekipman'}
          </button>
        </div>

        <table>
          <thead><tr><th>Ad</th><th>Tür</th><th>Cihaz</th><th>Okuma Adresi</th><th>Kontrol</th><th></th></tr></thead>
          <tbody>
            {ekipmanlar.map((e) => (
              <tr key={e.id}>
                <td>{e.ad}</td>
                <td>{e.tur}</td>
                <td className="muted">{e.cihaz?.ad || '-'}</td>
                <td className="muted" style={{ fontFamily: 'monospace', fontSize: 12.5 }}>
                  {e.okuma_register_adresi ?? '-'} ({e.okuma_register_tipi || '-'})
                </td>
                <td>{e.kontrol_edilebilir ? '✓' : '-'}</td>
                <td><button className="danger" onClick={() => ekipmanSil(e.id)}>Sil</button></td>
              </tr>
            ))}
            {ekipmanlar.length === 0 && <tr><td colSpan={6} className="muted">Henüz ekipman eklenmemiş.</td></tr>}
          </tbody>
        </table>

        {ekipmanFormAcik && (
          <form onSubmit={ekipmanEkle} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <label className="muted">Ekipman Adı
                <input required value={ekipmanForm.ad} onChange={(e) => setEkipmanForm({ ...ekipmanForm, ad: e.target.value })}
                  placeholder="örn. Kompresör 1" style={{ display: 'block', marginTop: 4, width: 200 }} />
              </label>
              <label className="muted">Tür
                <select value={ekipmanForm.tur} onChange={(e) => setEkipmanForm({ ...ekipmanForm, tur: e.target.value })} style={{ display: 'block', marginTop: 4 }}>
                  <option value="sicaklik">Sıcaklık</option>
                  <option value="pompa">Pompa</option>
                  <option value="kompresor">Kompresör</option>
                  <option value="chiller">Chiller</option>
                  <option value="diger">Diğer</option>
                </select>
              </label>
              <label className="muted">Bağlı Cihaz
                <select required value={ekipmanForm.cihaz_id} onChange={(e) => setEkipmanForm({ ...ekipmanForm, cihaz_id: e.target.value })} style={{ display: 'block', marginTop: 4 }}>
                  <option value="" disabled>Seçin</option>
                  {cihazlar.map((c) => <option key={c.id} value={c.id}>{c.ad}</option>)}
                </select>
              </label>
            </div>

            <p className="muted" style={{ marginTop: 12, marginBottom: 4, fontSize: 12.5 }}>OKUMA (İzleme) — üreticinin Modbus kılavuzundaki register adresi</p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <label className="muted">Register Adresi
                <input type="number" value={ekipmanForm.okuma_register_adresi} onChange={(e) => setEkipmanForm({ ...ekipmanForm, okuma_register_adresi: e.target.value })} style={{ display: 'block', marginTop: 4, width: 100 }} />
              </label>
              <label className="muted">Register Tipi
                <select value={ekipmanForm.okuma_register_tipi} onChange={(e) => setEkipmanForm({ ...ekipmanForm, okuma_register_tipi: e.target.value })} style={{ display: 'block', marginTop: 4 }}>
                  <option value="holding_register">Holding Register</option>
                  <option value="input_register">Input Register</option>
                  <option value="coil">Coil</option>
                  <option value="discrete_input">Discrete Input</option>
                </select>
              </label>
              <label className="muted">Veri Tipi
                <select value={ekipmanForm.okuma_veri_tipi} onChange={(e) => setEkipmanForm({ ...ekipmanForm, okuma_veri_tipi: e.target.value })} style={{ display: 'block', marginTop: 4 }}>
                  <option value="int16">int16</option>
                  <option value="uint16">uint16</option>
                  <option value="float32">float32</option>
                  <option value="bool">bool (açık/kapalı)</option>
                </select>
              </label>
              <label className="muted">Birim
                <input value={ekipmanForm.birim} onChange={(e) => setEkipmanForm({ ...ekipmanForm, birim: e.target.value })} placeholder="°C" style={{ display: 'block', marginTop: 4, width: 70 }} />
              </label>
              <label className="muted">Çarpan
                <input type="number" step="0.01" value={ekipmanForm.carpan} onChange={(e) => setEkipmanForm({ ...ekipmanForm, carpan: e.target.value })} style={{ display: 'block', marginTop: 4, width: 80 }} />
              </label>
            </div>

            <label className="muted" style={{ display: 'block', marginTop: 12 }}>
              <input type="checkbox" checked={ekipmanForm.kontrol_edilebilir} onChange={(e) => setEkipmanForm({ ...ekipmanForm, kontrol_edilebilir: e.target.checked })} style={{ marginRight: 6 }} />
              Bu ekipman siteden uzaktan kontrol edilebilsin (aç/kapat ve/veya setpoint)
            </label>

            {ekipmanForm.kontrol_edilebilir && (
              <>
                <p className="muted" style={{ marginTop: 12, marginBottom: 4, fontSize: 12.5 }}>YAZMA (Aç/Kapat)</p>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <label className="muted">Register Adresi
                    <input type="number" value={ekipmanForm.yazma_register_adresi} onChange={(e) => setEkipmanForm({ ...ekipmanForm, yazma_register_adresi: e.target.value })} style={{ display: 'block', marginTop: 4, width: 100 }} />
                  </label>
                  <label className="muted">Register Tipi
                    <select value={ekipmanForm.yazma_register_tipi} onChange={(e) => setEkipmanForm({ ...ekipmanForm, yazma_register_tipi: e.target.value })} style={{ display: 'block', marginTop: 4 }}>
                      <option value="coil">Coil</option>
                      <option value="holding_register">Holding Register</option>
                    </select>
                  </label>
                </div>

                <p className="muted" style={{ marginTop: 12, marginBottom: 4, fontSize: 12.5 }}>SETPOINT (opsiyonel — sıcaklık/değer ayarı gerekiyorsa)</p>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <label className="muted">Register Adresi
                    <input type="number" value={ekipmanForm.setpoint_register_adresi} onChange={(e) => setEkipmanForm({ ...ekipmanForm, setpoint_register_adresi: e.target.value })} style={{ display: 'block', marginTop: 4, width: 100 }} />
                  </label>
                  <label className="muted">Min Değer
                    <input type="number" value={ekipmanForm.setpoint_min} onChange={(e) => setEkipmanForm({ ...ekipmanForm, setpoint_min: e.target.value })} style={{ display: 'block', marginTop: 4, width: 90 }} />
                  </label>
                  <label className="muted">Max Değer
                    <input type="number" value={ekipmanForm.setpoint_max} onChange={(e) => setEkipmanForm({ ...ekipmanForm, setpoint_max: e.target.value })} style={{ display: 'block', marginTop: 4, width: 90 }} />
                  </label>
                </div>
              </>
            )}

            <button type="submit" disabled={ekipmanGonderiliyor} style={{ marginTop: 12 }}>
              {ekipmanGonderiliyor ? 'Ekleniyor...' : 'Ekipman Ekle'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
