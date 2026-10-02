import type { Metadata } from "next";
import { DaftarDarSyafii } from "@/components/hits-dar-syafii/DaftarDarSyafii";
import { dsSans } from "@/components/hits-dar-syafii/font";
import { DAR_SYAFII } from "@/lib/hits-dar-syafii";
import { fetchFaq } from "@/lib/hits-tanya";

export const metadata: Metadata = {
  title: `Daftar ${DAR_SYAFII.nama} — Muhajir Project Tilawah`,
  description:
    "Kelas HITS untuk orang tua dan wali murid Darsyafii: perbaikan bacaan dan pendalaman huruf-huruf Al-Qur'an, offline di Masjid Dar Syafi'i, bebas biaya. Daftar langsung dari HP.",
};

// FAQ dibaca dari database tiap kunjungan — admin menandainya kapan saja.
export const dynamic = "force-dynamic";

export default async function DaftarDarSyafiiPage() {
  const faq = await fetchFaq();
  return (
    <div className={dsSans.variable}>
      <DaftarDarSyafii faq={faq} />
    </div>
  );
}
