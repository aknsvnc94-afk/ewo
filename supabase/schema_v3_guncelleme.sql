-- ============================================================
-- EWO TAKİP SİSTEMİ - Şema Güncelleme v3
-- Bu dosyayı Supabase SQL Editor'de, schema.sql ve schema_v2 SONRASINDA çalıştırın.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Çözüm/analiz resimleri (Supabase Storage URL'leri saklanır)
-- ------------------------------------------------------------
alter table ariza_kayitlari add column if not exists cozum_resimleri text[] default '{}';

-- ------------------------------------------------------------
-- 2) Personel SİLİNEBİLSİN diye foreign key'leri "SET NULL" yapıyoruz
--    (bir personel silinirse, o personelin bağlı olduğu arıza kayıtları
--    silinmez, sadece "atanan personel" boşa düşer)
-- ------------------------------------------------------------
alter table ariza_kayitlari drop constraint if exists ariza_kayitlari_atanan_personel_id_fkey;
alter table ariza_kayitlari add constraint ariza_kayitlari_atanan_personel_id_fkey
  foreign key (atanan_personel_id) references personel(id) on delete set null;

alter table ariza_kayitlari drop constraint if exists ariza_kayitlari_aksiyon_sorumlusu_id_fkey;
alter table ariza_kayitlari add constraint ariza_kayitlari_aksiyon_sorumlusu_id_fkey
  foreign key (aksiyon_sorumlusu_id) references personel(id) on delete set null;

alter table ariza_kayitlari drop constraint if exists ariza_kayitlari_yukleyen_id_fkey;
alter table ariza_kayitlari add constraint ariza_kayitlari_yukleyen_id_fkey
  foreign key (yukleyen_id) references personel(id) on delete set null;

-- ------------------------------------------------------------
-- 3) Admin panelinden personel şifresi güncelleme RPC'si
-- ------------------------------------------------------------
create or replace function personel_sifre_guncelle(p_id uuid, p_sifre text)
returns void as $$
begin
  update personel set pin_hash = crypt(p_sifre, gen_salt('bf')) where id = p_id;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 4) Kullanıcı adı güncellerken küçük harfe çevrilsin (tutarlılık için)
--    - ayrı bir fonksiyona gerek yok, uygulama tarafında zaten lower() uygulanıyor
-- ------------------------------------------------------------
