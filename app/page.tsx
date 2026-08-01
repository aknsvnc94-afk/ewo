'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Fabrika = { id: string; ad: string; kod: string };

const SUPERADMIN_SECIMI = '__superadmin__';

export default function LoginPage() {
  const [fabrikalar, setFabrikalar] = useState<Fabrika[]>([]);
  const [fabrikaSecimi, setFabrikaSecimi] = useState('');
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [pin, setPin] = useState('');
  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/fabrikalar')
      .then((res) => res.json())
      .then((data) => setFabrikalar(data.fabrikalar || []))
      .catch(() => {});
  }, []);

  async function girisYap(e: React.FormEvent) {
    e.preventDefault();
    setHata('');
    if (!fabrikaSecimi) {
      setHata('Lütfen fabrika seçin');
      return;
    }
    setYukleniyor(true);
    try {
      const fabrika_id = fabrikaSecimi === SUPERADMIN_SECIMI ? null : fabrikaSecimi;
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kullanici_adi: kullaniciAdi, pin, fabrika_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHata(data.error || 'Giriş başarısız');
        return;
      }
      if (data.rol === 'superadmin') router.push('/admin/personel');
      else router.push('/panel');
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <div className="login-brand-mark">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <div>
            <div className="login-brand-ad">Bakım Yönetim Sistemi</div>
            <div className="login-brand-alt">Fabrika Operasyon Platformu</div>
          </div>
        </div>

        <div className="login-baslik">Kullanıcı Girişi</div>

        <form onSubmit={girisYap}>
          <div className="login-alan">
            <label htmlFor="fabrika">Fabrika</label>
            <select
              id="fabrika"
              value={fabrikaSecimi}
              onChange={(e) => setFabrikaSecimi(e.target.value)}
              required
            >
              <option value="" disabled>Seçiniz</option>
              {fabrikalar.map((f) => (
                <option key={f.id} value={f.id}>{f.ad}</option>
              ))}
              <option value={SUPERADMIN_SECIMI}>Süper Admin</option>
            </select>
          </div>

          <div className="login-alan">
            <label htmlFor="kullanici">Kullanıcı Adı</label>
            <input
              id="kullanici"
              value={kullaniciAdi}
              onChange={(e) => setKullaniciAdi(e.target.value)}
              autoCapitalize="none"
              required
            />
          </div>

          <div className="login-alan">
            <label htmlFor="sifre">Şifre</label>
            <input
              id="sifre"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          </div>

          {hata && <div className="login-hata">{hata}</div>}

          <button type="submit" disabled={yukleniyor} style={{ width: '100%', marginTop: 4 }}>
            {yukleniyor ? 'Giriş yapılıyor...' : 'Giriş'}
          </button>
        </form>

        <div className="login-surum">v2.0</div>
      </div>

      <div className="login-gorsel">
        <div className="login-gorsel-glow" />
        <div className="login-gorsel-ic">
          <svg viewBox="0 0 420 230" width="100%" style={{ maxWidth: 420, marginBottom: 30 }} role="img" aria-label="Fabrika operasyon panosu görseli">
            <rect x="70" y="18" width="280" height="164" rx="10" fill="#131c2e" stroke="#253251" strokeWidth="2" />
            <rect x="70" y="18" width="280" height="26" rx="10" fill="#1a2540" />
            <circle cx="86" cy="31" r="3.5" fill="#ef4444" /><circle cx="99" cy="31" r="3.5" fill="#f59e0b" /><circle cx="112" cy="31" r="3.5" fill="#22c55e" />
            <rect x="86" y="58" width="74" height="40" rx="6" fill="#1a2540" />
            <rect x="94" y="80" width="42" height="9" rx="3" fill="#3b82f6" />
            <rect x="170" y="58" width="74" height="40" rx="6" fill="#1a2540" />
            <rect x="178" y="80" width="30" height="9" rx="3" fill="#22c55e" />
            <rect x="254" y="58" width="74" height="40" rx="6" fill="#1a2540" />
            <rect x="262" y="80" width="48" height="9" rx="3" fill="#f59e0b" />
            <rect x="86" y="112" width="242" height="56" rx="6" fill="#1a2540" />
            <rect x="98" y="146" width="20" height="14" rx="2" fill="#3b82f6" />
            <rect x="126" y="134" width="20" height="26" rx="2" fill="#3b82f6" />
            <rect x="154" y="124" width="20" height="36" rx="2" fill="#3b82f6" />
            <rect x="182" y="138" width="20" height="22" rx="2" fill="#60a5fa" />
            <rect x="210" y="130" width="20" height="30" rx="2" fill="#60a5fa" />
            <rect x="238" y="120" width="20" height="40" rx="2" fill="#60a5fa" />
            <rect x="266" y="140" width="20" height="20" rx="2" fill="#60a5fa" />
            <rect x="294" y="128" width="20" height="32" rx="2" fill="#60a5fa" />
            <rect x="150" y="182" width="120" height="8" rx="3" fill="#253251" />
            <rect x="176" y="190" width="68" height="14" rx="4" fill="#1a2540" stroke="#253251" strokeWidth="1.5" />
            <g stroke="#3b82f6" strokeWidth="2.5" fill="none" strokeLinecap="round">
              <circle cx="40" cy="150" r="17" />
              <path d="M40 128v-8M40 180v-8M18 150h-8M70 150h8M25 135l-6-6M55 165l6 6M55 135l6-6M25 165l-6 6" />
            </g>
            <circle cx="40" cy="150" r="6" fill="#3b82f6" />
            <g stroke="#22c55e" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M372 60l10 10 18-20" />
              <circle cx="386" cy="66" r="24" strokeWidth="2" opacity="0.5" />
            </g>
          </svg>

          <h2>Fabrika operasyonları tek platformda</h2>
          <p>Bakım, kalite ve üretim süreçlerinizi bölüm bazlı olarak yönetin.</p>

          <div className="login-ozellikler">
            <div className="login-ozellik"><strong>Bakım</strong>Arıza ve iş emri takibi</div>
            <div className="login-ozellik"><strong>Kalite</strong>Uygunsuzluk ve DÖF</div>
            <div className="login-ozellik"><strong>Üretim</strong>Operasyon takibi</div>
          </div>
        </div>
      </div>
    </div>
  );
}
