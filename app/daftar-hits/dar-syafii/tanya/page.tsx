import type { Metadata } from "next";
import { TanyaForm } from "@/components/hits-dar-syafii/TanyaForm";
import { TanyaShell } from "@/components/hits-dar-syafii/TanyaShell";
import t from "@/components/hits-dar-syafii/tanya.module.css";
import { DAR_SYAFII } from "@/lib/hits-dar-syafii";
import { fetchFaq } from "@/lib/hits-tanya";

export const metadata: Metadata = {
  title: `Tanya Admin ${DAR_SYAFII.nama} — Muhajir Project Tilawah`,
  description: `Kirim pertanyaan tentang ${DAR_SYAFII.nama}; jawabannya dikirim lewat tautan khusus untuk Anda.`,
};

export const dynamic = "force-dynamic";

export default async function TanyaPage() {
  const faq = await fetchFaq();
  return (
    <TanyaShell
      eyebrow={DAR_SYAFII.nama}
      title={
        <>
          Tanya <em>admin</em>
        </>
      }
      desc="Tulis pertanyaan Anda. Anda akan mendapat tautan khusus tempat jawabannya muncul, dan kami kabari lewat WhatsApp saat sudah dijawab."
    >
      <div className={t.stack}>
        <TanyaForm />
        {faq.length > 0 && (
          <section className={t.card} aria-labelledby="ds-tanya-faq">
            <h2 id="ds-tanya-faq" className={t.cardTitle}>
              Mungkin sudah terjawab di sini
            </h2>
            {faq.map((f) => (
              <details key={f.id}>
                <summary className={t.quote} style={{ fontWeight: 700, cursor: "pointer" }}>
                  {f.pertanyaan}
                </summary>
                <p className={t.cardBody} style={{ whiteSpace: "pre-line", marginTop: 6 }}>
                  {f.jawaban}
                </p>
              </details>
            ))}
          </section>
        )}
      </div>
    </TanyaShell>
  );
}
