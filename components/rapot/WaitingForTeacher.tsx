import { Clock } from "lucide-react";

/**
 * Layar tunggu peserta antara mengirim rekaman dan pengajar selesai menilai.
 *
 * Mas Agil menekankan ini di rapat 3 Agustus 2026: "jangan didiemin dia nunggu".
 * Karena penilai sekarang manusia, bukan AI, jedanya hitungan hari — bukan 30
 * detik seperti alur lama. Halaman ini sengaja tidak menjanjikan tanggal pasti,
 * hanya bahwa hasilnya akan dikirim lewat WhatsApp.
 */
export function WaitingForTeacher({ nama }: { nama: string }) {
  return (
    <div className="card-mpt" style={{ padding: "36px 26px", textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          margin: "0 auto 18px",
          borderRadius: 16,
          background: "color-mix(in oklab, var(--accent), transparent 86%)",
          color: "var(--accent)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Clock size={26} strokeWidth={2.2} />
      </div>

      <h1
        className="font-display"
        style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}
      >
        Rekaman Anda sedang diperiksa
      </h1>

      <p
        style={{
          fontSize: 14,
          color: "var(--ink-soft)",
          lineHeight: 1.7,
          maxWidth: 460,
          margin: "0 auto",
        }}
      >
        Terima kasih, {nama}. Bacaan Anda sudah kami terima dan sedang
        didengarkan langsung oleh pengajar kami — bukan mesin. Karena diperiksa
        satu per satu, prosesnya butuh waktu beberapa hari.
      </p>

      <p
        style={{
          fontSize: 13,
          color: "var(--ink-mute)",
          lineHeight: 1.7,
          maxWidth: 460,
          margin: "16px auto 0",
        }}
      >
        Begitu selesai, hasilnya kami kirim ke nomor WhatsApp yang Anda
        daftarkan. Halaman ini juga akan menampilkannya — cukup buka kembali
        tautan yang sama.
      </p>
    </div>
  );
}
