export const DEMO_SLUG = "demo-bilal-09";

export type HitsTier =
  | "dasar"
  | "lanjutan_awal"
  | "lanjutan_menengah"
  | "lanjutan_expert";

export interface HitsTierInfo {
  id: HitsTier;
  name: string;
  nameShort: string;
  number: number;
  duration: string;
  description: string;
  modul: string;
  hafalan: string;
  materi: string[];
  totalSessions: number;
  examSessionIndex: number;
}

export const HITS_TIERS: HitsTierInfo[] = [
  {
    id: "dasar",
    name: "HITS Dasar",
    nameShort: "Dasar",
    number: 1,
    duration: "~6 bulan",
    description: "Pemberantasan buta huruf Al-Quran (3 pilar)",
    modul: "Annuroniyyah + Tahsin Al-Baqarah",
    hafalan: "—",
    materi: [
      "Huruf Hijaiyah & Makhraj Dasar",
      "Harakat: Fathah, Kasrah, Dhammah",
      "Tanwin & Sukun",
      "Mad Thobi'i (2 harakat)",
      "Tahsin Al-Baqarah ayat 1–20",
      "Praktik Membaca Mandiri",
    ],
    totalSessions: 24,
    examSessionIndex: 23,
  },
  {
    id: "lanjutan_awal",
    name: "HITS Lanjutan Awal",
    nameShort: "Lanjutan Awal",
    number: 2,
    duration: "~6 bulan",
    description: "Tahsin lanjutan: makhraj & sifat huruf",
    modul: "Tahsin lanjutan + makhraj",
    hafalan: "—",
    materi: [
      "Makhraj Detail (5 Kelompok)",
      "Sifat Huruf (17 Sifat)",
      "Hukum Nun Mati & Tanwin",
      "Hukum Mim Mati",
      "Idgham, Ikhfa, Iqlab, Idzhar",
      "Praktik Bacaan Surah Pendek",
    ],
    totalSessions: 24,
    examSessionIndex: 23,
  },
  {
    id: "lanjutan_menengah",
    name: "HITS Lanjutan Menengah",
    nameShort: "Lanjutan Menengah",
    number: 3,
    duration: "~1 tahun",
    description: "Hafalan Juz 30-29 + Tuhfatul Athfal",
    modul: "Tahsin Juz 30-29 + Tuhfatul Athfal",
    hafalan: "2 juz",
    materi: [
      "Hafalan Juz 30 (An-Naba — An-Nas)",
      "Hafalan Juz 29 (Al-Mulk — Al-Mursalat)",
      "Tuhfatul Athfal (Nazham Tajwid)",
      "Waqf & Ibtida",
      "Gharib & Musykilat",
      "Muraja'ah Hafalan Berkala",
    ],
    totalSessions: 48,
    examSessionIndex: 47,
  },
  {
    id: "lanjutan_expert",
    name: "HITS Lanjutan Expert",
    nameShort: "Expert",
    number: 4,
    duration: "~2 tahun",
    description: "Persiapan masuk program lanjutan (Maahir, B. Arab, dll)",
    modul: "Tahsin Juz 28-26 + Tuhfatul Athfal",
    hafalan: "5 juz",
    materi: [
      "Tahsin Juz 28 (Al-Mujadalah — At-Tahrim)",
      "Tahsin Juz 27 (Adz-Dzariyat — Al-Hadid)",
      "Tahsin Juz 26 (Al-Ahqaf — Al-Hujurat)",
      "Hafalan 5 Juz (26–30)",
      "Qira'at Pengantar",
      "Persiapan Ujian MAAHIR",
    ],
    totalSessions: 96,
    examSessionIndex: 95,
  },
];

export function getNextTier(current: HitsTier): HitsTier | null {
  const idx = HITS_TIERS.findIndex((t) => t.id === current);
  return idx < HITS_TIERS.length - 1 ? HITS_TIERS[idx + 1]!.id : null;
}

export function getTierInfo(tier: HitsTier): HitsTierInfo {
  return HITS_TIERS.find((t) => t.id === tier) ?? HITS_TIERS[0]!;
}

export interface DemoSession {
  number: number;
  title: string;
  date: string;
  time: string;
  status: "completed" | "upcoming" | "locked";
  isExam: boolean;
  meetUrl?: string;
  teacherNotes?: string;
}

export function generateDemoSessions(
  tier: HitsTier,
  completedCount: number,
): DemoSession[] {
  const info = getTierInfo(tier);
  const count = Math.min(info.totalSessions, 8);
  const sessions: DemoSession[] = [];
  const baseDate = new Date(2026, 5, 8);

  for (let i = 0; i < count; i++) {
    const sessionDate = new Date(baseDate);
    sessionDate.setDate(baseDate.getDate() + i * 3);
    const dayName = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
      sessionDate.getDay()
    ];

    const isExam = i === count - 1;
    const materIdx = Math.min(i, info.materi.length - 1);

    let status: DemoSession["status"] = "locked";
    if (i < completedCount) status = "completed";
    else if (i === completedCount) status = "upcoming";

    sessions.push({
      number: i + 1,
      title: isExam
        ? "Ujian Kenaikan Tingkat"
        : (info.materi[materIdx] ?? "Materi"),
      date: `${dayName}, ${sessionDate.getDate()} ${
        ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][
          sessionDate.getMonth()
        ]
      } ${sessionDate.getFullYear()}`,
      time: "19.30 – 21.00 WIB",
      status,
      isExam,
      meetUrl: status === "upcoming" ? "https://meet.google.com/abc-defg-hij" : undefined,
      teacherNotes:
        status === "completed"
          ? isExam
            ? "Alhamdulillah, lulus ujian kenaikan tingkat. Bacaan sudah baik dan siap naik ke tingkat selanjutnya."
            : "Bacaan semakin baik, terus istiqamah berlatih."
          : undefined,
    });
  }
  return sessions;
}

export interface HitsProgram {
  id: string;
  name: string;
  tier: HitsTier;
  scheduleType: "weekday" | "weekend";
  days: string;
  time: string;
  teacher: string;
  gender: "ikhwan" | "akhwat";
  capacity: number;
  enrolled: number;
}

const TEACHERS_IKHWAN = ["Ustadz Ahmad Hidayat", "Ustadz Yusuf Mahmud"] as const;
const TEACHERS_AKHWAT = ["Ustadzah Aisyah Rahmawati", "Ustadzah Fatimah Az-Zahra"] as const;

export const DUMMY_PROGRAMS: HitsProgram[] = HITS_TIERS.flatMap((tier) => [
  {
    id: `${tier.id}-wd-i`,
    name: `${tier.name} — Weekday Malam`,
    tier: tier.id,
    scheduleType: "weekday" as const,
    days: "Senin & Rabu",
    time: "19.30 – 21.00 WIB",
    teacher: TEACHERS_IKHWAN[0],
    gender: "ikhwan" as const,
    capacity: 12,
    enrolled: 5,
  },
  {
    id: `${tier.id}-wd-a`,
    name: `${tier.name} — Weekday Malam`,
    tier: tier.id,
    scheduleType: "weekday" as const,
    days: "Selasa & Kamis",
    time: "19.30 – 21.00 WIB",
    teacher: TEACHERS_AKHWAT[0],
    gender: "akhwat" as const,
    capacity: 12,
    enrolled: 8,
  },
  {
    id: `${tier.id}-we-i`,
    name: `${tier.name} — Weekend`,
    tier: tier.id,
    scheduleType: "weekend" as const,
    days: "Sabtu & Ahad",
    time: "09.00 – 10.30 WIB",
    teacher: TEACHERS_IKHWAN[1],
    gender: "ikhwan" as const,
    capacity: 12,
    enrolled: 3,
  },
  {
    id: `${tier.id}-we-a`,
    name: `${tier.name} — Weekend Sore`,
    tier: tier.id,
    scheduleType: "weekend" as const,
    days: "Sabtu & Ahad",
    time: "15.00 – 16.30 WIB",
    teacher: TEACHERS_AKHWAT[1],
    gender: "akhwat" as const,
    capacity: 12,
    enrolled: 10,
  },
]);

export interface PlacementQuestion {
  id: number;
  category: string;
  question: string;
  arabicText?: string;
  options: string[];
  correctIndex: number;
  tierWeight: HitsTier;
}

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    id: 1,
    category: "Huruf Hijaiyah",
    question: "Berapa jumlah huruf Hijaiyah?",
    options: ["26 huruf", "28 huruf", "30 huruf", "32 huruf"],
    correctIndex: 1,
    tierWeight: "dasar",
  },
  {
    id: 2,
    category: "Harakat",
    question: "Apa nama harakat pada huruf berikut?",
    arabicText: "بِ",
    options: ["Fathah", "Kasrah", "Dhammah", "Sukun"],
    correctIndex: 1,
    tierWeight: "dasar",
  },
  {
    id: 3,
    category: "Tajwid Dasar",
    question: "Apa hukum bacaan Nun Mati bertemu Ba?",
    arabicText: "مِنْ بَعْدِ",
    options: ["Idgham", "Ikhfa", "Iqlab", "Idzhar"],
    correctIndex: 2,
    tierWeight: "lanjutan_awal",
  },
  {
    id: 4,
    category: "Makhraj",
    question: "Huruf ق (Qaf) keluar dari makhraj yang mana?",
    options: [
      "Ujung lidah (Tharaf al-Lisan)",
      "Pangkal lidah (Aqsha al-Lisan)",
      "Tengah lidah (Wasath al-Lisan)",
      "Dua bibir (Asy-Syafatain)",
    ],
    correctIndex: 1,
    tierWeight: "lanjutan_awal",
  },
  {
    id: 5,
    category: "Hafalan",
    question: "Surah apa yang menjadi surah terakhir di Juz 30?",
    options: ["Al-Falaq", "An-Nas", "Al-Ikhlas", "Al-Lahab"],
    correctIndex: 1,
    tierWeight: "lanjutan_menengah",
  },
  {
    id: 6,
    category: "Tajwid Lanjutan",
    question: "Apa yang dimaksud dengan Mad 'Aridh Lis-Sukun?",
    options: [
      "Mad karena hamzah setelahnya",
      "Mad karena sukun yang mendatang (waqf)",
      "Mad karena tasydid setelahnya",
      "Mad karena alif setelah fathah",
    ],
    correctIndex: 1,
    tierWeight: "lanjutan_expert",
  },
];

export function computePlacementTier(correctCount: number): HitsTier {
  if (correctCount <= 1) return "dasar";
  if (correctCount <= 3) return "lanjutan_awal";
  if (correctCount <= 4) return "lanjutan_menengah";
  return "lanjutan_expert";
}

export const DEMO_NAV_LINKS = [
  { group: "Landing", links: [{ label: "Beranda", href: "/" }] },
  {
    group: "Jalur 1: Assessment → HITS",
    links: [
      { label: "Assessment (consent)", href: "/assessment/consent" },
      { label: "Rapot AI", href: `/rapot/${DEMO_SLUG}` },
      { label: "Peserta Dashboard", href: `/peserta/${DEMO_SLUG}` },
      { label: "Assessment Result", href: `/peserta/${DEMO_SLUG}/assessment-result` },
      { label: "Tahsin Progress", href: `/peserta/${DEMO_SLUG}/tahsin` },
      { label: "Tahsin Report", href: `/peserta/${DEMO_SLUG}/tahsin/report` },
      { label: "HITS Enrollment", href: `/peserta/${DEMO_SLUG}/hits` },
    ],
  },
  {
    group: "HITS Berjenjang",
    links: [
      { label: "Kelas Dasar (0 sesi)", href: `/peserta/${DEMO_SLUG}/hits/kelas?tier=dasar&sim=0` },
      { label: "Kelas Dasar (5 sesi)", href: `/peserta/${DEMO_SLUG}/hits/kelas?tier=dasar&sim=5` },
      { label: "Kelas Dasar (selesai)", href: `/peserta/${DEMO_SLUG}/hits/kelas?tier=dasar&sim=8` },
      { label: "Naik Tingkat (Dasar→Awal)", href: `/peserta/${DEMO_SLUG}/hits/kelas/naik-tingkat?from=dasar&to=lanjutan_awal` },
      { label: "Kelas Lanjutan Awal", href: `/peserta/${DEMO_SLUG}/hits/kelas?tier=lanjutan_awal&sim=3` },
      { label: "Kelas Menengah", href: `/peserta/${DEMO_SLUG}/hits/kelas?tier=lanjutan_menengah&sim=2` },
      { label: "Kelas Expert", href: `/peserta/${DEMO_SLUG}/hits/kelas?tier=lanjutan_expert&sim=0` },
    ],
  },
  {
    group: "Jalur 2: Daftar Langsung",
    links: [
      { label: "Form Pendaftaran", href: "/daftar-hits" },
      { label: "Tes Penempatan", href: "/daftar-hits/penempatan?nama=Demo&gender=ikhwan&wa=08123456789" },
      { label: "Hasil Penempatan", href: "/daftar-hits/hasil?tier=lanjutan_awal&nama=Demo" },
    ],
  },
  {
    group: "Jalur 3: Pengajuan Organisasi",
    links: [
      { label: "Form Pengajuan", href: "/pengajuan" },
      { label: "Konfirmasi", href: "/pengajuan/konfirmasi?org=PT+Contoh&pic=Ahmad&wa=08123456789" },
    ],
  },
];
