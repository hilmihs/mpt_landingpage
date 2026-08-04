/**
 * Alamat dasar aplikasi, untuk merangkai tautan absolut di pesan WhatsApp.
 *
 * SENGAJA tidak memakai NEXT_PUBLIC_SITE_URL. Variabel berawalan NEXT_PUBLIC_
 * ditanam ke dalam bundel saat `next build`, termasuk di kode server — jadi
 * nilainya membeku pada apa pun yang ada saat image dibangun, bukan saat
 * container berjalan. Di Cloud Run image dibangun tanpa env itu, sehingga yang
 * tertanam adalah string kosong. Dan string kosong bukan nullish, jadi `??`
 * tidak menolong: tautannya lolos sebagai path relatif, yang tidak bisa diklik
 * dari WhatsApp.
 *
 * APP_BASE_URL dibaca sungguhan saat runtime, jadi cukup diubah di Cloud Run
 * tanpa membangun ulang image.
 */
export function siteUrl(): string {
  const raw =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";

  // Garis miring di ujung membuat tautan jadi "https://situs//rapot/xxx".
  return raw.replace(/\/+$/, "");
}
