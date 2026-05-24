export interface AyatData {
  number: number;
  arabic: string;
  words: string[];
  transliterasi: string;
  terjemahan: string;
}

export const AL_FATIHAH: AyatData[] = [
  {
    number: 1,
    arabic: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
    words: ["بِسْمِ", "ٱللَّهِ", "ٱلرَّحْمَٰنِ", "ٱلرَّحِيمِ"],
    transliterasi: "Bismillāhir-raḥmānir-raḥīm",
    terjemahan: "Dengan nama Allah Yang Maha Pengasih, Maha Penyayang.",
  },
  {
    number: 2,
    arabic: "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ",
    words: ["ٱلْحَمْدُ", "لِلَّهِ", "رَبِّ", "ٱلْعَٰلَمِينَ"],
    transliterasi: "Al-ḥamdu lillāhi rabbil-‘ālamīn",
    terjemahan: "Segala puji bagi Allah, Tuhan semesta alam.",
  },
  {
    number: 3,
    arabic: "ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
    words: ["ٱلرَّحْمَٰنِ", "ٱلرَّحِيمِ"],
    transliterasi: "Ar-raḥmānir-raḥīm",
    terjemahan: "Yang Maha Pengasih, Maha Penyayang.",
  },
  {
    number: 4,
    arabic: "مَٰلِكِ يَوْمِ ٱلدِّينِ",
    words: ["مَٰلِكِ", "يَوْمِ", "ٱلدِّينِ"],
    transliterasi: "Māliki yaumid-dīn",
    terjemahan: "Pemilik hari pembalasan.",
  },
  {
    number: 5,
    arabic: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
    words: ["إِيَّاكَ", "نَعْبُدُ", "وَإِيَّاكَ", "نَسْتَعِينُ"],
    transliterasi: "Iyyāka na‘budu wa iyyāka nasta‘īn",
    terjemahan:
      "Hanya kepada Engkaulah kami menyembah dan hanya kepada Engkaulah kami memohon pertolongan.",
  },
  {
    number: 6,
    arabic: "ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ",
    words: ["ٱهْدِنَا", "ٱلصِّرَٰطَ", "ٱلْمُسْتَقِيمَ"],
    transliterasi: "Ihdinaṣ-ṣirāṭal-mustaqīm",
    terjemahan: "Tunjukilah kami jalan yang lurus.",
  },
  {
    number: 7,
    arabic:
      "صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ",
    words: [
      "صِرَٰطَ",
      "ٱلَّذِينَ",
      "أَنْعَمْتَ",
      "عَلَيْهِمْ",
      "غَيْرِ",
      "ٱلْمَغْضُوبِ",
      "عَلَيْهِمْ",
      "وَلَا",
      "ٱلضَّآلِّينَ",
    ],
    transliterasi:
      "Ṣirāṭal-laẓīna an‘amta ‘alaihim ghairil-maghḍūbi ‘alaihim wa laḍ-ḍāllīn",
    terjemahan:
      "(Yaitu) jalan orang-orang yang telah Engkau beri nikmat kepadanya; bukan (jalan) mereka yang dimurkai dan bukan (pula jalan) mereka yang sesat.",
  },
];

export function getAyat(ayatNumber: number): AyatData | undefined {
  return AL_FATIHAH.find((a) => a.number === ayatNumber);
}

export function getWord(
  ayatNumber: number,
  kataIdx: number,
): string | undefined {
  return getAyat(ayatNumber)?.words[kataIdx];
}
