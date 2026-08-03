import { sql } from "@/lib/db";
import { PengajarManager } from "@/components/admin/PengajarManager";

export const dynamic = "force-dynamic";

interface Teacher {
  id: string;
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";
  nomor_wa: string;
  status: string;
  bio: string | null;
  email_meet: string | null;
  created_at: string;
}

async function fetchTeachers(): Promise<Teacher[]> {
  try {
    const rows = await sql<
      (Omit<Teacher, "created_at"> & { created_at: Date })[]
    >`
      SELECT id, nama, jenis_kelamin, nomor_wa, status, bio, email_meet,
             created_at
      FROM teachers
      ORDER BY created_at DESC
    `;
    return rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }));
  } catch {
    return [];
  }
}

export default async function PengajarAdminPage() {
  const teachers = await fetchTeachers();

  return (
    <div style={{ maxWidth: 1080 }}>
      <header style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            marginBottom: 6,
          }}
        >
          Manajemen Pengajar
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(24px, 3.5vw, 32px)",
            fontWeight: 800,
            margin: 0,
            letterSpacing: "-0.025em",
          }}
        >
          Daftar Pengajar
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: "6px 0 0",
            maxWidth: 600,
          }}
        >
          Undang pengajar baru lewat tombol di kanan atas. Setelah ditambahkan,
          pengajar bisa langsung login ke <code>/portal-mpt-x7</code> dengan
          nomor WhatsApp dan password yang Anda set.
        </p>
      </header>

      <PengajarManager initialTeachers={teachers} />
    </div>
  );
}
