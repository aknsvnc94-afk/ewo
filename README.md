# EWO Arıza Takip Sistemi (Web)

Plaskar bakım ekibi için ERP arıza kayıtlarını yükleme, personele atama ve
personelin mobil/PC üzerinden detay (aksiyon, kök neden, tamamlanma durumu)
doldurmasını sağlayan web uygulaması. Telefonda "ana ekrana ekle" ile
uygulama gibi çalışır (PWA).

## Mimari
- **Frontend:** Next.js 14 (App Router) + PWA
- **Backend:** Next.js API Routes
- **Veritabanı:** Supabase (Postgres)
- **Giriş:** Kullanıcı adı + PIN (imzalı cookie ile 30 gün oturum)
- **Barındırma:** Vercel (frontend) + Supabase (veritabanı) — ikisi de ücretsiz planla başlar

## Kurulum Adımları

### 1) Supabase projesi oluştur
1. https://supabase.com üzerinde yeni proje aç
2. SQL Editor'e girip şu sırayla çalıştır:
   - `supabase/schema.sql`
   - `supabase/schema_v2_ewo_form.sql`
   - `supabase/schema_v3_guncelleme.sql`
   - `supabase/schema_v4_aksiyonlar.sql`
3. Kendi admin kullanıcını ekle (PIN'i kendi belirlediğinle değiştir):
   ```sql
   insert into personel (ad_soyad, kullanici_adi, pin_hash, rol)
   values ('Akın Sevinç', 'akin', crypt('SENIN_SIFREN', gen_salt('bf')), 'admin');
   ```
   (Diğer personelleri artık `/admin/personel` sayfasından, SQL yazmadan ekleyebilir/düzenleyebilir/silebilirsin.)
4. Settings > API sayfasından `Project URL` ve `service_role`/`secret` key'i kopyala
5. **Storage bucket oluştur (fotoğraf yüklemeleri için):**
   - Sol menüden **Storage** → **New bucket**
   - İsim: `cozum-resimleri`
   - **Public bucket** seçeneğini AÇIK bırak (fotoğrafların görüntülenebilmesi için gerekli)
   - Create

### 2) Ortam değişkenleri
`.env.example` dosyasını `.env.local` olarak kopyala ve Supabase bilgilerini gir:
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SESSION_SECRET=uzun-rastgele-bir-metin
```

### 3) Yerelde çalıştır (test için)
```bash
npm install
npm run dev
```
http://localhost:3000 adresinden test edebilirsin.

### 4) Vercel'e deploy et
1. Bu klasörü bir GitHub reposuna push et
2. https://vercel.com üzerinde "Import Project" ile repoyu bağla
3. Environment Variables kısmına `.env.local` içeriğini gir
4. Deploy et — sana `https://xxx.vercel.app` gibi bir adres verecek

### 5) Telefonda kullanım
Vercel adresini telefonda tarayıcıda aç → paylaş/menü > "Ana Ekrana Ekle".
Artık uygulama gibi ikonla açılır.

## Kullanım Akışı
1. **Admin (sen):** `/admin/personel` sayfasından bakım personeline kullanıcı adı + şifre tanımla
   (düzenleme, şifre sıfırlama, pasif yapma ve silme seçenekleri de burada)
2. **Admin:** ERP'den Excel export al → `/admin` sayfasından yükle (tarayıcıda parse edilir,
   4.5MB sunucu sınırına takılmaz), MA/BA/KA/RA'ya otomatik ayrılır, mükerrer kayıtlar atlanır
3. **Admin:** Kayıtları filtrele/sırala (tarih, süre, tezgah), seç → personele topluca ata
4. **Personel:** `/personel`'de kendine atanan kayıtları ve özet sayılarını (toplam/bekleyen/
   onay bekleyen/onaylı) görür. Bir kayda dokunduğunda:
   - **20 dakikadan KISA duruşlarda:** sadece "Tamamlandı" işaretler, form yok
   - **20 dakikadan UZUN duruşlarda:** Arıza Türü + Arızanın Tanımı + Direk Sebep ve Çözümü
     (en az 10 karakter, boş bırakılamaz) + isteğe bağlı fotoğraf ekler, "Tamamla ve Gönder" der
     → kayıt "Onay Bekliyor" durumuna geçer
5. **Admin:** `/admin` üzerinden "İncele" ile (sadece 20dk üzeri kayıtlarda görünür) zaman
   çizelgesi, 5 Neden analizi, Kök Sebep Tipi (Çalışma koşullarının izlenmemesi / Proje
   zayıflığı / Dış etkenler / Temel şartların eksikliği / Yetersiz bakım / Eksik beceri-yetkinlik),
   önlemler (her satırda **personel listesinden Sorumlu seçilir**) ve sonucu doldurur;
   "Üretim Başlangıcını Hesapla" ile bitiş saatini arıza başlangıcı + süreden otomatik alabilir.
   Sonra **Onaylar** veya **Personele geri gönderir**
6. **Admin/Personel:** "PDF Görüntüle/İndir" ile formu orijinal EWO (F13-31) formatında
   yazdırılabilir görünümde açar, tarayıcının "Yazdır > PDF olarak kaydet" seçeneğiyle indirir
7. **Admin:** Ana panelde personel bazlı atanan iş sayısı grafiğini görür
8. **Aksiyon Takip (`/admin/aksiyonlar`, personel için `/personel/aksiyonlar`):** Önlem
   tablolarında sorumlu atanan her satır burada ayrı bir görev olarak izlenir. Personel işini
   bitirince "Kapat" der, not girer → admin onayına düşer. Admin onaylar ya da geri gönderir.
   Termin tarihi geçmiş ve hâlâ kapatılmamış aksiyonlar **kırmızı**, diğerleri **yeşil** kenarlıkla
   gösterilir; üstte toplam/açık/onay bekleyen/kapatılan/gecikmiş sayıları görünür.
9. **EWO Analiz / Pareto (`/admin/analiz`):** MA / KA / BA / RA olmak üzere 4 ayrı bölüm.
   Her bölümde sadece 20dk üzeri (EWO gerektiren) arızalar dahil edilir: MA/BA/RA için **tezgah**
   bazında, KA için **kalıp kodu** bazında Pareto grafiği + açık/kapalı EWO sayıları gösterilir.

## Sonraki Aşamalar (yol haritası)
- [ ] Telegram bot ile yeni atama bildirimi (senin AnKA GLC botunla entegre edilebilir)
- [ ] Pareto/KPI dashboard sayfası — kök neden türü, kategori (MA/BA/KA/RA) ve tezgah
      bazında toplam duruş süresi analizleri
- [ ] Excel'e geri dışa aktarma (raporlama için)
- [ ] Gerçek PWA ikonları (public/icon-192.png, icon-512.png ekle)

## Notlar
- `service_role` key çok güçlü bir anahtardır, sadece sunucu tarafında (.env.local, Vercel env vars)
  kullanılır, asla frontend koduna veya GitHub'a commit edilmemelidir (.gitignore'da .env.local var).
- Mükerrer kayıt kontrolü TEZGAH + BAŞLANGIÇ + DURUŞ KODU + İŞ EMRİ DETAY KODU + SÜRE kombinasyonuyla yapılır.
  ERP export formatı değişirse `app/api/import/route.ts` içindeki `COLS` dizisini güncelle.
