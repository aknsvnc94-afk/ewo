-- ============================================================
-- BAKIM YÖNETİM SİSTEMİ - Şema Güncelleme v20
-- Sipariş PDF'indeki STOK ADI ve AÇIKLAMA sütunlarını ayrı alanlarda saklar.
-- Önceden her ikisi de "satir_metni" içine gömülüyor, arayüzde metin bölerek
-- çıkarılıyordu; bu hem kırılgandı hem de AÇIKLAMA sütunu hiç gösterilemiyordu.
-- Bu dosyayı Supabase SQL Editor'de, v1-v19'dan SONRA çalıştırın.
-- ============================================================

alter table siparis_kalemleri add column if not exists stok_adi text;
alter table siparis_kalemleri add column if not exists aciklama text;
