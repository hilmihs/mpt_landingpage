import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { DaftarDarSyafii } from "@/components/hits-dar-syafii/DaftarDarSyafii";
import { DAR_SYAFII } from "@/lib/hits-dar-syafii";

// Huruf tampilan khusus halaman ini; tidak dimuat di halaman lain.
const sans = Plus_Jakarta_Sans({
  variable: "--font-ds-sans",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `Daftar ${DAR_SYAFII.nama} — Muhajir Project Tilawah`,
  description:
    "Kelas HITS untuk orang tua dan wali murid Darsyafii: perbaikan bacaan dan pendalaman huruf-huruf Al-Qur'an, offline di Darsyafii Islamic School, bebas biaya. Daftar dan rekam ujian masuk langsung dari HP.",
};

export default function DaftarDarSyafiiPage() {
  return (
    <div className={sans.variable}>
      <DaftarDarSyafii />
    </div>
  );
}
