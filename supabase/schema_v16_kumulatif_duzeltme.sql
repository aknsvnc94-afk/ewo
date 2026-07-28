-- ============================================================
-- BAKIM YÖNETİM SİSTEMİ - Şema Güncelleme v16
-- MSBF hesaplama mantığı düzeltmesi: ERP'den gelen YT_Baskı değeri
-- KÜMÜLATİF (o ana kadarki toplam) bir değerdir. O ayki gerçek baskı
-- sayısı, bu ayın kümülatif değerinden bir önceki ayın kümülatif
-- değeri çıkarılarak (fark alınarak) hesaplanır.
-- Bu dosyayı Supabase SQL Editor'de, v1-v15'ten SONRA çalıştırın.
-- ============================================================

-- guncel_baski_toplam: ERP'den o ay okunan HAM kümülatif baskı sayısı (ör. YT_Baskı sütunu)
-- yt_baski: o ay GERÇEKLEŞEN baskı sayısı (fark) — aylık ERP yüklemesinde otomatik hesaplanır,
--           geçmiş ay toplu içe aktarımında (ilk KPI dosyasından) doğrudan dosyadan alınır.
alter table kalip_baski_sayilari add column if not exists guncel_baski_toplam integer;
