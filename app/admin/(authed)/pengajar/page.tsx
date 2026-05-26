import { Users, Plus } from "lucide-react";
import { supabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface Teacher {
  id: string;
  nama: string;
  jenis_kelamin: string;
  nomor_wa: string;
  status: string;
  created_at: string;
}

async function fetchTeachers(): Promise<Teacher[]> {
  const sb = supabaseService();
  try {
    const { data } = await sb
      .from("teachers")
      .select("id, nama, jenis_kelamin, nomor_wa, status, created_at")
      .order("created_at", { ascending: false });
    return (data ?? []) as Teacher[];
  } catch {
    return [];
  }
}

const STATUS_COLOR: Record<string, string> = {
  active: "var(--success)",
  pending: "var(--warning)",
  inactive: "var(--ink-mute)",
  suspended: "var(--danger)",
};

export default async function PengajarAdminPage() {
  const teachers = await fetchTeachers();

  return (
    <div style={{ maxWidth: 1080 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
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
        </div>
        <button
          type="button"
          disabled
          className="btn-mpt btn-mpt-accent"
          style={{ minHeight: 40, fontSize: 13, opacity: 0.5, cursor: "not-allowed" }}
          title="Belum tersedia di Phase 2A"
        >
          <Plus size={14} strokeWidth={2.4} />
          Undang Pengajar
        </button>
      </header>

      {teachers.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="card-mpt" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-soft)" }}>
                <Th>Nama</Th>
                <Th>Gender</Th>
                <Th>WhatsApp</Th>
                <Th>Status</Th>
                <Th>Daftar</Th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <Td bold>{t.nama}</Td>
                  <Td>{t.jenis_kelamin === "ikhwan" ? "Ikhwan" : "Akhwat"}</Td>
                  <Td>{t.nomor_wa}</Td>
                  <Td>
                    <span
                      style={{
                        padding: "3px 8px",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        borderRadius: 6,
                        background: `color-mix(in oklab, ${STATUS_COLOR[t.status] ?? "var(--ink-mute)"}, transparent 85%)`,
                        color: STATUS_COLOR[t.status] ?? "var(--ink-mute)",
                      }}
                    >
                      {t.status}
                    </span>
                  </Td>
                  <Td>
                    {new Date(t.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="card-mpt"
      style={{ padding: "48px 28px", textAlign: "center" }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          margin: "0 auto 16px",
          borderRadius: 14,
          background: "color-mix(in oklab, var(--accent), transparent 85%)",
          color: "var(--accent)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Users size={24} strokeWidth={2.2} />
      </div>
      <h2
        className="font-display"
        style={{ fontSize: 20, fontWeight: 700, margin: "0 0 10px" }}
      >
        Belum ada pengajar terdaftar
      </h2>
      <p
        style={{
          fontSize: 13,
          color: "var(--ink-soft)",
          lineHeight: 1.6,
          maxWidth: 460,
          margin: "0 auto",
        }}
      >
        Tabel <code>teachers</code> kosong atau migration belum dijalankan.
        Tombol &quot;Undang Pengajar&quot; akan tersedia setelah Phase 2B (CRUD pengajar
        + integrasi Supabase Auth phone signup).
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "10px 16px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-mute)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  bold = false,
}: {
  children: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <td
      style={{
        padding: "12px 16px",
        fontSize: 13,
        color: "var(--ink)",
        fontWeight: bold ? 600 : 400,
      }}
    >
      {children}
    </td>
  );
}
