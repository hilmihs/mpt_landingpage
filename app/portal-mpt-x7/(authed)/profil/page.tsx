import { getCurrentTeacher } from "@/lib/auth/teacher";
import { supabaseService } from "@/lib/supabase";
import { ProfileForm } from "@/components/portal/ProfileForm";

export const dynamic = "force-dynamic";

interface Profile {
  nama: string;
  bio: string | null;
  email_zoom: string | null;
  foto_url: string | null;
  nomor_wa: string;
  jenis_kelamin: string;
}

async function fetchProfile(teacherId: string): Promise<Profile | null> {
  const sb = supabaseService();
  const { data } = await sb
    .from("teachers")
    .select("nama, bio, email_zoom, foto_url, nomor_wa, jenis_kelamin")
    .eq("id", teacherId)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

export default async function ProfilPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) return null;

  const profile = await fetchProfile(teacher.teacherId);
  if (!profile) return null;

  return (
    <div style={{ maxWidth: 720 }}>
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
          Pengaturan
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
          Profil
        </h1>
      </header>

      <div
        className="card-mpt"
        style={{
          padding: "18px 22px",
          marginBottom: 18,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        <ReadOnlyRow label="Nomor WhatsApp" value={profile.nomor_wa} />
        <ReadOnlyRow
          label="Gender"
          value={profile.jenis_kelamin === "ikhwan" ? "Ikhwan" : "Akhwat"}
        />
      </div>

      <ProfileForm
        initial={{
          nama: profile.nama,
          bio: profile.bio,
          email_zoom: profile.email_zoom,
          foto_url: profile.foto_url,
        }}
      />

      <p
        style={{
          fontSize: 11,
          color: "var(--ink-mute)",
          marginTop: 12,
          lineHeight: 1.55,
        }}
      >
        Untuk ubah nomor WhatsApp atau gender, hubungi admin. Reset password
        juga lewat admin (untuk mencegah social engineering).
      </p>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
