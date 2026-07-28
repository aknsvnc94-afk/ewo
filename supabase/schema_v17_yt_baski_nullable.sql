-- ============================================================
-- BAKIM YÖNETİM SİSTEMİ - Şema Güncelleme v17
-- Bu dosyayı Supabase SQL Editor'de, v1-v16'dan SONRA çalıştırın.
-- ============================================================

-- yt_baski (o ay gerçekleşen baskı sayısı), bir önceki ayın kümülatif
-- değeriyle farkı alınarak hesaplanıyor. Eğer bir kalıp için ilk kez
-- veri yükleniyorsa (önceki ay verisi yoksa), bu fark hesaplanamaz ve
-- null kalması gerekir — bu yüzden NOT NULL kısıtını kaldırıyoruz.
alter table kalip_baski_sayilari alter column yt_baski drop not null;
alter table kalip_baski_sayilari alter column yt_baski drop default;
