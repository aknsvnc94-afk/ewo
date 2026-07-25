-- ============================================================
-- EWO TAKİP SİSTEMİ - Şema Güncelleme v9
-- Bu dosyayı Supabase SQL Editor'de, v1-v8'den SONRA çalıştırın.
-- ============================================================

-- Giriş denemesi sınırlaması (brute-force koruması) için
alter table personel add column if not exists basarisiz_giris_sayisi int not null default 0;
alter table personel add column if not exists kilit_bitis timestamptz;
