-- ============================================================
-- BAKIM YÖNETİM SİSTEMİ - Şema Güncelleme v13
-- Makine/sipariş silme desteği için FK davranışı düzeltmesi
-- Bu dosyayı Supabase SQL Editor'de, v1-v12'den SONRA çalıştırın.
-- ============================================================

-- Bir sipariş silindiğinde (siparis_kalemleri zaten cascade ile siliniyordu),
-- o kalemden otomatik oluşturulmuş yedek_parcalar kayıtları da silinsin —
-- "silip tekrar yükle" akışında eski (yanlış) eşleşmeler ortada kalmasın.
alter table yedek_parcalar drop constraint if exists yedek_parcalar_siparis_kalemi_id_fkey;
alter table yedek_parcalar add constraint yedek_parcalar_siparis_kalemi_id_fkey
  foreign key (siparis_kalemi_id) references siparis_kalemleri(id) on delete cascade;
