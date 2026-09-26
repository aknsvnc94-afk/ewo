# Yardımcı Tesis Köprü Servisi — Kurulum

Bu klasör, web sitesinin parçası DEĞİLDİR ve Vercel'e deploy edilmez.
Fabrikada 7/24 açık kalan bir bilgisayarda ayrı olarak çalıştırılır.

## Ön Koşullar

- [Node.js](https://nodejs.org) (18 veya üzeri) bu bilgisayara kurulu olmalı
- RS485 bağlantısı kullanılacaksa, PC'ye bir USB-RS485 çevirici takılı olmalı
  (Windows'ta Aygıt Yöneticisi'nden "COM3" gibi bir port numarası görünür)

## Kurulum (tek seferlik)

```powershell
cd gateway
npm install
copy .env.example .env
```

`.env` dosyasını bir metin editörüyle açıp şunları doldur:

1. **SUPABASE_URL** ve **SUPABASE_SERVICE_ROLE_KEY** — Supabase projenizin
   **Settings → API** sayfasından alınır. `service_role` anahtarı gizlidir,
   kimseyle paylaşmayın ve bu dosyayı asla git'e eklemeyin (zaten `.gitignore`
   ile hariç tutulmuştur).

## Çalıştırma

```powershell
npm start
```

Terminal açık kaldığı sürece servis çalışır. Kapanınca durur — bu yüzden
kalıcı kullanım için Windows'ta bir **Görev Zamanlayıcı** görevi ya da
[NSSM](https://nssm.cc/) gibi bir araçla Windows servisi haline getirmeniz
önerilir (bu adımı istersen birlikte kurarız).

## Cihaz ve Ekipman Tanımlama

Bu servis, hangi cihazları/ekipmanları okuyacağını **Supabase'den** öğrenir —
koda gömülü değildir. Cihaz ve ekipman eklemek için web sitesindeki
**Bakım → Yardımcı Tesis Kontrol → Ayarlar** ekranını kullanın.

## Register Adresleri Hakkında

`FLOAT32_WORD_ORDER`, `.env` dosyasında ayarlanır ve AnKA GLC'nin ondalıklı
sıcaklık değerlerini nasıl paylaştığına bağlıdır. Üreticiden gelen Modbus
kılavuzunda "byte order" veya "word order" yazan kısma bakın; emin değilseniz
varsayılanla deneyip okunan değer anlamsız çıkarsa diğerini deneyin.
