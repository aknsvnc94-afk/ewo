'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BOLUMLER, bolumdeIslemYapabilir, type BolumId } from '@/lib/bolumler';

type Oturum = {
  id: string; ad_soyad: string; rol: string;
  fabrikaAd: string | null; bolum: BolumId | null;
};

function Ikon({ ad, boyut = 20 }: { ad: string; boyut?: number }) {
  const ortak = {
    width: boyut, height: boyut, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  const yollar: Record<string, JSX.Element> = {
    tool: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>,
    factory: <><path d="M2 20h20" /><path d="M4 20V9l5 3V9l5 3V4h6v16" /></>,
    alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>,
    clipboard: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></>,
    check: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
    chart: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></>,
    gauge: <><path d="M12 14l4-4" /><circle cx="12" cy="14" r="8" /><path d="M12 2v2" /></>,
    package: <><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" /><path d="M3.3 7L12 12l8.7-5" /><path d="M12 22V12" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  };
  return <svg {...ortak}>{yollar[ad] || yollar.settings}</svg>;
}

export default function PanelPage() {
  const [oturum, setOturum] = useState<Oturum | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [seciliBolum, setSeciliBolum] = useState<BolumId>('bakim');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Oturum) => {
        setOturum(d);
        if (d.bolum) setSeciliBolum(d.bolum);
      })
      .catch(() => router.push('/'))
      .finally(() => setYukleniyor(false));
  }, [router]);

  const bolum = useMemo(() => BOLUMLER.find((b) => b.id === seciliBolum)!, [seciliBolum]);
  const yetkili = bolumdeIslemYapabilir(oturum, seciliBolum);
  const adminMi = oturum?.rol === 'admin' || oturum?.rol === 'superadmin';

  const gorunenModuller = bolum.moduller.filter((m) => (m.sadeceAdmin ? adminMi : true));

  async function cikisYap() {
    await fetch('/api/auth/login', { method: 'DELETE' });
    router.push('/');
  }

  if (yukleniyor) {
    return <div className="container"><p className="muted">Yükleniyor...</p></div>;
  }

  return (
    <div className="panel-duzen">
      <aside className="panel-kenar">
        <div className="panel-kenar-ust">
          <div className="panel-fabrika">{oturum?.fabrikaAd || 'Süper Admin'}</div>
          <div className="panel-kullanici">{oturum?.ad_soyad}</div>
        </div>

        <nav className="panel-menu">
          {BOLUMLER.map((b) => (
            <button
              key={b.id}
              className={`panel-menu-oge ${seciliBolum === b.id ? 'aktif' : ''}`}
              onClick={() => setSeciliBolum(b.id)}
            >
              <Ikon ad={b.ikon} boyut={18} />
              <span>{b.ad}</span>
              {oturum?.bolum === b.id && <span className="panel-rozet">Bölümünüz</span>}
            </button>
          ))}
        </nav>

        <div className="panel-kenar-alt">
          {adminMi && (
            <Link href="/admin/personel" className="panel-menu-oge">
              <Ikon ad="users" boyut={18} /><span>Personel</span>
            </Link>
          )}
          <button className="panel-menu-oge" onClick={cikisYap}>
            <Ikon ad="logout" boyut={18} /><span>Çıkış</span>
          </button>
        </div>
      </aside>

      <main className="panel-icerik">
        <div className="panel-baslik">
          <div>
            <h1>{bolum.ad}</h1>
            <p className="muted">{bolum.altBaslik}</p>
          </div>
        </div>

        {!yetkili && (
          <div className="panel-uyari">
            Bu bölümü görüntülüyorsunuz ancak işlem yapma yetkiniz yok. İşlem yapabilmek için
            {' '}<strong>{BOLUMLER.find((b) => b.id === oturum?.bolum)?.ad || 'kendi'}</strong> bölümünü seçin.
          </div>
        )}

        <div className="panel-kartlar">
          {gorunenModuller.map((m) => {
            const icerik = (
              <>
                <div className="panel-kart-ikon"><Ikon ad={m.ikon} /></div>
                <div className="panel-kart-ad">{m.ad}</div>
                <div className="panel-kart-aciklama">{m.aciklama}</div>
                {!m.hazir && <span className="panel-kart-etiket">Yakında</span>}
              </>
            );
            return m.hazir ? (
              <Link key={m.yol} href={m.yol} className="panel-kart">{icerik}</Link>
            ) : (
              <div key={m.yol} className="panel-kart pasif">{icerik}</div>
            );
          })}
        </div>

        {gorunenModuller.length === 0 && (
          <p className="muted">Bu bölümde size görünen bir modül yok.</p>
        )}
      </main>
    </div>
  );
}
