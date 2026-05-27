import { UserCheck } from "lucide-react";
import Link from "next/link";
import { supabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface Submission {
  id: string;
  nama: string;
  jenis_kelamin: string;
  nomor_wa: string;
  status: string;
  created_at: string;
  rapot_slug: string | null;
}

async function fetchSubmissions(): Promise<Submission[]> {
  const sb = supabaseService();
  try {
    const { data } = await sb
      .from("submissions")
      .select("id, nama, jenis_kelamin, nomor_wa, status, created_at, rapot_slug")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as Submission[];
  } catch {
    return [];
  }
}

const STATUS_COLOR: Record<string, string> = {
  pending: "var(--warning)",
  processing: "var(--accent)",
  completed: "var(--success)",
  failed: "var(--danger)",
};

export default async function PesertaAdminPage() {
  const submissions = await fetchSubmissions();

  return (
    <div style={{ maxWidth: 1180 }}>
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
          Manajemen Peserta
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
          Daftar Submission
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: "6px 0 0",
            maxWidth: 600,
          }}
        >
          100 submission terbaru. Klik nama untuk lihat rapot peserta.
        </p>
      </header>

      {submissions.length === 0 ? (
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
            <UserCheck size={24} strokeWidth={2.2} />
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            Belum ada submission peserta.
          </p>
        </div>
      ) : (
        <div className="card-mpt" style={{ padding: 0, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ background: "var(--surface-soft)" }}>
                <Th>Nama</Th>
                <Th>Gender</Th>
                <Th>WhatsApp</Th>
                <Th>Status</Th>
                <Th>Waktu</Th>
                <Th>Rapot</Th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr
                  key={s.id}
                  style={{ borderTop: "1px solid var(--line)" }}
                >
                  <Td bold>{s.nama}</Td>
                  <Td>{s.jenis_kelamin === "ikhwan" ? "Ikhwan" : "Akhwat"}</Td>
                  <Td>{s.nomor_wa}</Td>
                  <Td>
                    <span
                      style={{
                        padding: "3px 8px",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        borderRadius: 6,
                        background: `color-mix(in oklab, ${STATUS_COLOR[s.status] ?? "var(--ink-mute)"}, transparent 85%)`,
                        color: STATUS_COLOR[s.status] ?? "var(--ink-mute)",
                      }}
                    >
                      {s.status}
                    </span>
                  </Td>
                  <Td>
                    {new Date(s.created_at).toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </Td>
                  <Td>
                    {s.rapot_slug ? (
                      <Link
                        href={`/rapot/${s.rapot_slug}`}
                        target="_blank"
                        style={{
                          color: "var(--accent)",
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        Lihat →
                      </Link>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>—</span>
                    )}
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
