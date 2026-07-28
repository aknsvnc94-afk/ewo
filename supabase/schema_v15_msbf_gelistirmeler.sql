-- ============================================================
-- BAKIM YÖNETİM SİSTEMİ - Şema Güncelleme v15
-- Bu dosyayı Supabase SQL Editor'de, v1-v14'ten SONRA çalıştırın.
-- ============================================================

-- Geçmiş aylara ait arıza sayısı, EWO sisteminde henüz o dönem
-- kaydı olmayabileceğinden, ilk KPI dosyasından "manuel" olarak
-- (sabit değer) içe aktarılabilsin diye.
-- null ise: arıza sayısı EWO'daki KA kayıtlarından canlı hesaplanır.
-- dolu ise: bu sabit değer kullanılır (geçmiş ay içe aktarımı).
alter table kalip_baski_sayilari add column if not exists ariza_sayisi_manuel integer;
