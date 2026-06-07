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
    arabic: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
    words: ["بِسْمِ", "ٱللَّهِ", "ٱلرَّحْمَـٰنِ", "ٱلرَّحِيمِ"],
    transliterasi: "Bismillāhir-raḥmānir-raḥīm",
    terjemahan: "Dengan nama Allah Yang Maha Pengasih, Maha Penyayang.",
  },
  {
    number: 2,
    arabic: "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ",
    words: ["ٱلْحَمْدُ", "لِلَّهِ", "رَبِّ", "ٱلْعَـٰلَمِينَ"],
    transliterasi: "Al-ḥamdu lillāhi rabbil-‘ālamīn",
    terjemahan: "Segala puji bagi Allah, Tuhan semesta alam.",
  },
  {
    number: 3,
    arabic: "ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
    words: ["ٱلرَّحْمَـٰنِ", "ٱلرَّحِيمِ"],
    transliterasi: "Ar-raḥmānir-raḥīm",
    terjemahan: "Yang Maha Pengasih, Maha Penyayang.",
  },
  {
    number: 4,
    arabic: "مَـٰلِكِ يَوْمِ ٱلدِّينِ",
    words: ["مَـٰلِكِ", "يَوْمِ", "ٱلدِّينِ"],
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

export const ASY_SYURA_1_6: AyatData[] = [
  {
    number: 1,
    arabic: "حمٓ",
    words: ["حمٓ"],
    transliterasi: "Ḥā Mīm",
    terjemahan: "Ha Mim.",
  },
  {
    number: 2,
    arabic: "عٓسٓقٓ",
    words: ["عٓسٓقٓ"],
    transliterasi: "'Ain Sīn Qāf",
    terjemahan: "'Ain Sin Qaf.",
  },
  {
    number: 3,
    arabic: "كَذَٰلِكَ يُوحِىٓ إِلَيْكَ وَإِلَى ٱلَّذِينَ مِن قَبْلِكَ ٱللَّهُ ٱلْعَزِيزُ ٱلْحَكِيمُ",
    words: ["كَذَٰلِكَ", "يُوحِىٓ", "إِلَيْكَ", "وَإِلَى", "ٱلَّذِينَ", "مِن", "قَبْلِكَ", "ٱللَّهُ", "ٱلْعَزِيزُ", "ٱلْحَكِيمُ"],
    transliterasi: "Każālika yūḥī ilaika wa ilal-lażīna min qablika-llāhul-'azīzul-ḥakīm",
    terjemahan: "Demikianlah Allah Yang Maha Perkasa, Maha Bijaksana mewahyukan kepadamu dan kepada orang-orang sebelummu.",
  },
  {
    number: 4,
    arabic: "لَهُۥ مَا فِى ٱلسَّمَـٰوَٰتِ وَمَا فِى ٱلْأَرْضِ ۖ وَهُوَ ٱلْعَلِىُّ ٱلْعَظِيمُ",
    words: ["لَهُۥ", "مَا", "فِى", "ٱلسَّمَـٰوَٰتِ", "وَمَا", "فِى", "ٱلْأَرْضِ", "وَهُوَ", "ٱلْعَلِىُّ", "ٱلْعَظِيمُ"],
    transliterasi: "Lahū mā fis-samāwāti wa mā fil-arḍ, wa huwal-'aliyyul-'aẓīm",
    terjemahan: "Milik-Nya apa yang ada di langit dan apa yang ada di bumi. Dan Dialah Yang Maha Tinggi, Maha Besar.",
  },
  {
    number: 5,
    arabic: "تَكَادُ ٱلسَّمَـٰوَٰتُ يَتَفَطَّرْنَ مِن فَوْقِهِنَّ ۚ وَٱلْمَلَـٰٓئِكَةُ يُسَبِّحُونَ بِحَمْدِ رَبِّهِمْ وَيَسْتَغْفِرُونَ لِمَن فِى ٱلْأَرْضِ ۗ أَلَآ إِنَّ ٱللَّهَ هُوَ ٱلْغَفُورُ ٱلرَّحِيمُ",
    words: ["تَكَادُ", "ٱلسَّمَـٰوَٰتُ", "يَتَفَطَّرْنَ", "مِن", "فَوْقِهِنَّ", "وَٱلْمَلَـٰٓئِكَةُ", "يُسَبِّحُونَ", "بِحَمْدِ", "رَبِّهِمْ", "وَيَسْتَغْفِرُونَ", "لِمَن", "فِى", "ٱلْأَرْضِ", "أَلَآ", "إِنَّ", "ٱللَّهَ", "هُوَ", "ٱلْغَفُورُ", "ٱلرَّحِيمُ"],
    transliterasi: "Takādus-samāwātu yatafattarna min fauqihinn, wal-malā'ikatu yusabbiḥūna bi-ḥamdi rabbihim wa yastaghfirūna liman fil-arḍ. Alā innallāha huwal-ghafūrur-raḥīm",
    terjemahan: "Hampir saja langit itu pecah dari sebelah atasnya. Dan para malaikat bertasbih memuji Tuhannya dan memohonkan ampunan bagi orang-orang yang ada di bumi. Ingatlah, sesungguhnya Allah Maha Pengampun, Maha Penyayang.",
  },
  {
    number: 6,
    arabic: "وَٱلَّذِينَ ٱتَّخَذُوا۟ مِن دُونِهِۦٓ أَوْلِيَآءَ ٱللَّهُ حَفِيظٌ عَلَيْهِمْ وَمَآ أَنتَ عَلَيْهِم بِوَكِيلٍ",
    words: ["وَٱلَّذِينَ", "ٱتَّخَذُوا۟", "مِن", "دُونِهِۦٓ", "أَوْلِيَآءَ", "ٱللَّهُ", "حَفِيظٌ", "عَلَيْهِمْ", "وَمَآ", "أَنتَ", "عَلَيْهِم", "بِوَكِيلٍ"],
    transliterasi: "Wal-lażīnat-takhażū min dūnihī auliyā'-allāhu ḥafīẓun 'alaihim wa mā anta 'alaihim biwakīl",
    terjemahan: "Dan orang-orang yang mengambil pelindung-pelindung selain Allah, Allah mengawasi mereka; dan engkau bukanlah orang yang diserahi mengurus mereka.",
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
