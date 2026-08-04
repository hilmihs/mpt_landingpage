import { redirect } from "next/navigation";
import type { Metadata } from "next";

/**
 * Dialihkan ke /rapot/[slug].
 *
 * Halaman ini dulu menampilkan dua penilaian berdampingan: skor pengajar 1–10
 * dan skor AI 1–5, lengkap dengan istilah "lahn jaliy". Dua-duanya melanggar
 * aturan terkunci di CLAUDE.md — peserta tidak boleh melihat skor AI, dan tidak
 * boleh diperkenalkan pada istilah lahn.
 *
 * Sisi pengajarnya pun sebenarnya sudah mati: datanya diambil dari panel
 * Filament luar lewat TEACHER_ASSESSMENT_BASE_URL, variabel yang tidak diisi di
 * mana pun, sehingga peserta selalu mendapat "Penilaian Pengajar belum
 * tersedia" padahal penilaiannya ada — cuma tersimpan di teacher_evaluations
 * milik kita sendiri.
 *
 * Jadi yang tersisa cuma satu halaman yang benar, dan /rapot/[slug] sudah
 * menjadi halaman itu. Slug di rute ini memang rapot_slug yang sama (lihat
 * app/peserta/[slug]/page.tsx), jadi pengalihannya lurus tanpa penerjemahan.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hasil Assessment — Muhajir Project Tilawah",
  robots: { index: false, follow: false },
};

export default async function AssessmentResultPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/rapot/${slug}`);
}
