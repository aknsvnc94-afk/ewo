// ============================================================
// EWO YARDIMCI TESİS KÖPRÜ SERVİSİ
// ------------------------------------------------------------
// Bu servis, fabrika içinde 7/24 açık kalan bir bilgisayarda çalışır.
// Görevi:
//   1) yardimci_tesis_cihazlari tablosundaki aktif AnKA GLC cihazlarına
//      (RS485 seri port veya Wi-Fi/Modbus TCP üzerinden) bağlanmak,
//   2) Her cihaza bağlı aktif ekipmanların (sıcaklık, pompa, kompresör,
//      chiller) register adreslerinden okuma yapıp sonucu
//      yardimci_tesis_olcumler tablosuna yazmak,
//   3) yardimci_tesis_komutlar tablosundaki "bekliyor" durumundaki
//      komutları (aç/kapat, setpoint) cihaza Modbus yazma işlemiyle
//      uygulayıp durumu güncellemek.
//
// Bu dosya Vercel'e DEPLOY EDİLMEZ — Next.js uygulamasının parçası
// değildir. Sadece bu klasörde (gateway/), fabrikadaki bir PC'de
// `npm install` ve `npm start` ile çalıştırılır.
// ============================================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ModbusRTU = require('modbus-serial');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 10000);
const FLOAT32_WORD_ORDER = process.env.FLOAT32_WORD_ORDER === 'little_endian' ? 'little_endian' : 'big_endian';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('HATA: .env dosyasında SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı.');
  console.error('Örnek için .env.example dosyasına bakın.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ------------------------------------------------------------
// Ham register değerlerini gerçek ölçüm değerine çeviren yardımcılar
// ------------------------------------------------------------

function iki16BitToFloat32(yuksekKelime, dusukKelime) {
  const buf = Buffer.alloc(4);
  if (FLOAT32_WORD_ORDER === 'big_endian') {
    buf.writeUInt16BE(yuksekKelime, 0);
    buf.writeUInt16BE(dusukKelime, 2);
  } else {
    buf.writeUInt16BE(dusukKelime, 0);
    buf.writeUInt16BE(yuksekKelime, 2);
  }
  return buf.readFloatBE(0);
}

// register verisini (coil/discrete/holding/input okumasından dönen dizi)
// ekipmanın veri_tipi'ne göre tek bir sayısal/boolean değere çevirir.
function hamDegeriCoz(ekipman, okumaSonucu) {
  const tip = ekipman.okuma_veri_tipi || 'int16';
  if (tip === 'bool') {
    const v = Array.isArray(okumaSonucu.data) ? okumaSonucu.data[0] : okumaSonucu.data;
    return v ? 1 : 0;
  }
  if (tip === 'float32') {
    const [yuksek, dusuk] = okumaSonucu.data;
    return iki16BitToFloat32(yuksek, dusuk) * (ekipman.carpan ?? 1);
  }
  if (tip === 'uint16') {
    return okumaSonucu.data[0] * (ekipman.carpan ?? 1);
  }
  // int16 (varsayılan) — modbus-serial zaten işaretli döndürüyor (buffer.readInt16BE)
  return okumaSonucu.buffer.readInt16BE(0) * (ekipman.carpan ?? 1);
}

async function ekipmaniOku(client, ekipman) {
  const adres = ekipman.okuma_register_adresi;
  if (adres === null || adres === undefined) return null;
  const uzunluk = ekipman.okuma_veri_tipi === 'float32' ? 2 : 1;

  let sonuc;
  switch (ekipman.okuma_register_tipi) {
    case 'coil':
      sonuc = await client.readCoils(adres, uzunluk);
      break;
    case 'discrete_input':
      sonuc = await client.readDiscreteInputs(adres, uzunluk);
      break;
    case 'input_register':
      sonuc = await client.readInputRegisters(adres, uzunluk);
      break;
    case 'holding_register':
    default:
      sonuc = await client.readHoldingRegisters(adres, uzunluk);
      break;
  }
  return hamDegeriCoz(ekipman, sonuc);
}

async function komutuUygula(client, ekipman, komut) {
  if (komut.komut_tipi === 'ac_kapat') {
    const adres = ekipman.yazma_register_adresi;
    if (adres === null || adres === undefined) throw new Error('Bu ekipman için yazma register adresi tanımlı değil');
    if (ekipman.yazma_register_tipi === 'coil') {
      await client.writeCoil(adres, !!komut.istenen_deger);
    } else {
      await client.writeRegister(adres, komut.istenen_deger);
    }
    return;
  }
  if (komut.komut_tipi === 'setpoint') {
    const adres = ekipman.setpoint_register_adresi;
    if (adres === null || adres === undefined) throw new Error('Bu ekipman için setpoint register adresi tanımlı değil');
    // NOT: setpoint genelde float32/ondalıklı olabilir; cihazın gerçek formatı
    // manuel geldiğinde burası (gerekirse iki register'a yazacak şekilde) güncellenmeli.
    await client.writeRegister(adres, Math.round(komut.istenen_deger));
    return;
  }
  throw new Error(`Bilinmeyen komut tipi: ${komut.komut_tipi}`);
}

// ------------------------------------------------------------
// Bir cihaza bağlanıp tüm ekipmanlarını okuyan + bekleyen komutları
// uygulayan ana döngü adımı
// ------------------------------------------------------------

async function cihazaBaglan(cihaz) {
  const client = new ModbusRTU();
  if (cihaz.baglanti_tipi === 'rs485') {
    const port = cihaz.baglanti_ayarlari?.port; // örn. "COM3" veya "/dev/ttyUSB0"
    const baudRate = cihaz.baglanti_ayarlari?.baud_rate || 9600;
    if (!port) throw new Error(`"${cihaz.ad}" için seri port (baglanti_ayarlari.port) tanımlı değil`);
    await client.connectRTUBuffered(port, { baudRate });
  } else {
    const ip = cihaz.baglanti_ayarlari?.ip;
    const tcpPort = cihaz.baglanti_ayarlari?.port || 502;
    if (!ip) throw new Error(`"${cihaz.ad}" için IP adresi (baglanti_ayarlari.ip) tanımlı değil`);
    await client.connectTCP(ip, { port: tcpPort });
  }
  client.setID(cihaz.modbus_slave_id || 1);
  client.setTimeout(3000);
  return client;
}

async function cihaziIsle(cihaz) {
  let client;
  try {
    client = await cihazaBaglan(cihaz);
  } catch (err) {
    console.error(`[${cihaz.ad}] Bağlantı hatası: ${err.message}`);
    return;
  }

  try {
    const { data: ekipmanlar, error: ekipmanErr } = await supabase
      .from('yardimci_tesis_ekipmanlar')
      .select('*')
      .eq('cihaz_id', cihaz.id)
      .eq('aktif', true);
    if (ekipmanErr) throw ekipmanErr;

    // 1) Okuma: her ekipmanın güncel değerini al, ölçüm tablosuna yaz
    for (const ekipman of ekipmanlar || []) {
      try {
        const deger = await ekipmaniOku(client, ekipman);
        if (deger === null) continue;
        await supabase.from('yardimci_tesis_olcumler').insert({
          fabrika_id: ekipman.fabrika_id,
          ekipman_id: ekipman.id,
          deger,
        });
      } catch (err) {
        console.error(`[${cihaz.ad} / ${ekipman.ad}] Okuma hatası: ${err.message}`);
      }
    }

    // 2) Bekleyen komutları uygula
    const ekipmanIdler = (ekipmanlar || []).map((e) => e.id);
    if (ekipmanIdler.length > 0) {
      const { data: komutlar, error: komutErr } = await supabase
        .from('yardimci_tesis_komutlar')
        .select('*')
        .eq('durum', 'bekliyor')
        .in('ekipman_id', ekipmanIdler);
      if (komutErr) throw komutErr;

      for (const komut of komutlar || []) {
        const ekipman = ekipmanlar.find((e) => e.id === komut.ekipman_id);
        try {
          await komutuUygula(client, ekipman, komut);
          await supabase.from('yardimci_tesis_komutlar')
            .update({ durum: 'uygulandi', uygulanma_tarihi: new Date().toISOString() })
            .eq('id', komut.id);
          console.log(`[${cihaz.ad} / ${ekipman.ad}] Komut uygulandı: ${komut.komut_tipi} = ${komut.istenen_deger}`);
        } catch (err) {
          await supabase.from('yardimci_tesis_komutlar')
            .update({ durum: 'hata', hata_mesaji: err.message, uygulanma_tarihi: new Date().toISOString() })
            .eq('id', komut.id);
          console.error(`[${cihaz.ad} / ${ekipman.ad}] Komut hatası: ${err.message}`);
        }
      }
    }

    // 3) Başarılı taramayı işaretle (arayüzde "çevrimiçi" görünmesi için)
    await supabase.from('yardimci_tesis_cihazlari')
      .update({ son_gorulme: new Date().toISOString() })
      .eq('id', cihaz.id);
  } finally {
    client.close(() => {});
  }
}

async function birTurTara() {
  const { data: cihazlar, error } = await supabase
    .from('yardimci_tesis_cihazlari')
    .select('*')
    .eq('aktif', true);

  if (error) {
    console.error('Cihaz listesi alınamadı:', error.message);
    return;
  }

  for (const cihaz of cihazlar || []) {
    await cihaziIsle(cihaz);
  }
}

async function baslat() {
  console.log(`Yardımcı Tesis köprü servisi başladı. Tarama aralığı: ${POLL_INTERVAL_MS}ms`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await birTurTara();
    } catch (err) {
      console.error('Beklenmeyen hata:', err);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

baslat();
