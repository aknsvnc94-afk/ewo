// Telefon kameralarından gelen fotoğraflar genelde 3-8MB olabiliyor.
// Yüklemeden önce tarayıcıda (canvas ile) yeniden boyutlandırıp sıkıştırıyoruz;
// böylece hem depolama hem de API istek boyutu makul kalıyor.
export function resimSikistir(file: File, maksGenislik = 1600, kalite = 0.72): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const oran = Math.min(1, maksGenislik / img.width);
        const w = Math.round(img.width * oran);
        const h = Math.round(img.height * oran);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas oluşturulamadı')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Sıkıştırma başarısız'))),
          'image/jpeg',
          kalite
        );
      };
      img.onerror = () => reject(new Error('Görsel okunamadı'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsDataURL(file);
  });
}
