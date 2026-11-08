// The JuanWise Terms & Conditions, English and Tagalog.
//
// Copied from juanwise-app-v2 `src/shared/content/terms-content.ts` (branch
// feat/adjustment-3-ui, the client's corrected text from Adjustment 3 item 10)
// so the console shows the same terms the app does. Keep the two in step: when
// the app's copy changes, paste it here.
//
// The checkbox and button strings belong to the app's onboarding gate; they are
// kept so a paste from the app needs no editing.
export const termsContent = {
  en: {
    consentTitle: 'Parental Consent & Privacy Policy',
    consentBody:
      "I, [Parent/Guardian Name], give consent for my child, [Child Name] (Grade 5-6), to use this digital supplementary learning tool. I understand that I am responsible for monitoring my child's activity.\n\n" +
      "Data Collection & Privacy: By using this app, essential data—including the child's name, grade level, and academic performance metrics—is collected solely to operate the platform and provide progress tracking.\n\n" +
      "Progress dashboards, detailed improvement reports, and performance data are strictly confidential and accessible only by parents and authorized teachers.",
    mechanicsTitle: 'Game Mechanics & Structure',
    mechanicsBody:
      "• Accounts: Every student and teacher needs an account to access and use JuanWise.\n\n" +
      "• Game Structure & Levels: Players choose one of six categories: History, Culture & Tradition, Geography, Festival Arts, National Symbols, and Filipino Heroes. Each category has 5 levels for quizzes and 5 levels for jigsaw puzzles, and each level has 6 activities. Each quiz and jigsaw activity has a time limit of 60 seconds. Difficulty depends on the level: Level 1 is Easy, Levels 2-3 are Normal, and Levels 4-5 are Hard.\n\n" +
      "• Quizzes: Players pick a category to start a quiz. Each level has 6 questions, one per activity, and each question has a 60-second time limit. A question may be Multiple Choice, Identification, or Enumeration. Players must answer all 6 questions correctly to unlock the next level.\n\n" +
      "• Jigsaw Puzzles: Players pick a category to start a puzzle, and must assemble it within the 60-second time limit to move on. The number of pieces depends on the activity's place in the level, and the teacher may change it: Activities 1-2: 6 pieces (2x3 grid). Activities 3-4: 9 pieces (3x3 grid). Activities 5-6: 12 pieces (3x4 grid).\n\n" +
      "• Attempts & Points: Each activity allows up to 3 attempts. A pass earns 15 points on the first attempt, 10 on the second, and 6 on the third; a wrong answer or a timeout earns none. Medals reward speed: finishing within half the time earns gold, within three quarters earns silver, and otherwise bronze.\n\n" +
      "• Content: Teachers (admins) add, delete or archive, duplicate, and publish activity packs. For quizzes, the teacher writes the questions for every activity in each level (Multiple Choice, Identification, or Enumeration) and may add a mini-lesson with an optional picture. For jigsaw puzzles, the teacher sets the puzzle picture and a mini-lesson for each category; the picture is cut into 6, 9, or 12 pieces.",
    conductTitle: 'Code of Conduct',
    playerRulesTitle: 'MOBILE APP — FOR PLAYERS (GRADE 5-6):',
    playerRules:
      "• Conduct yourself with integrity in all learning and gaming activities.\n" +
      "• Keep your account credentials strictly confidential.\n" +
      "• Use this platform for educational purposes only.\n" +
      "Notice: Violation may result in immediate account restriction or suspension.",
    adminRulesTitle: 'MOBILE APP AND WEB — FOR ADMINS (TEACHERS):',
    adminRules:
      "• Access student data exclusively for academic monitoring, evaluation, and guidance.\n" +
      "• Adhere strictly to student privacy and data protection regulations.\n" +
      "• Curate and assign grade-appropriate material within the application.\n" +
      "• Manage user accounts and educational content responsibly.\n" +
      "• Add, delete or archive, duplicate, and publish activity packs.\n" +
      "Notice: Violation may result in immediate account restriction or suspension.",
    mainAdminRulesTitle: 'WEB — FOR MAIN ADMINS (DEVELOPERS):',
    mainAdminRules:
      "• Monitor all user accounts that access the application, to keep it secure and to prevent suspicious or unauthorized use.\n" +
      "• Add, delete or archive, duplicate, publish, and edit activity packs and their content.\n" +
      "• Delete unused accounts, packs and classes.",
    checkboxLabel: 'I Accept the Terms & Conditions (Required)',
    continueBtn: 'Continue',
    cancelBtn: 'Cancel',
    cancelAlertTitle: 'Terms Not Accepted',
    cancelAlertMsg: 'You must accept the Terms & Conditions to use JuanWise.',
  },
  tl: {
    consentTitle: 'Pahintulot ng Magulang at Patakaran sa Privacy',
    consentBody:
      "Ako, [Pangalan ng Magulang/Tagapag-alaga], ay pumapayag na gamitin ng aking anak, [Pangalan ng Bata] (Grade 5-6), ang digital na kagamitan sa pag-aaral na ito. Nauunawaan kong ako ang mananagot sa pagbabantay sa aktibidad ng aking anak.\n\n" +
      "Pagkolekta ng Datos at Privacy: Sa paggamit ng app na ito, ang mahahalagang datos—kasama ang pangalan, antas ng baitang, at performance ng bata—ay kinokolekta lamang para patakbuhin ang platform at subaybayan ang progreso.\n\n" +
      "Ang mga progress dashboard, detalyadong ulat, at performance data ay mahigpit na kompidensyal at makikita lamang ng mga magulang at awtorisadong guro.",
    mechanicsTitle: 'Mekanismo at Istruktura ng Laro',
    mechanicsBody:
      "• Mga Account: Kailangan ng bawat estudyante at guro ng account para ma-access at magamit ang JuanWise.\n\n" +
      "• Istruktura ng Laro at Levels: Pipili ang manlalaro ng isa sa anim na kategorya: Kasaysayan, Kultura at Tradisyon, Heograpiya, Pista at Sining, Pambansang Sagisag, at Mga Bayaning Pilipino. Bawat kategorya ay may 5 level ng pagsusulit at 5 level ng jigsaw puzzle, at bawat level ay may 6 na aktibidad. Bawat pagsusulit at jigsaw ay may time limit na 60 segundo. Ang hirap ay nakabatay sa level: Madali ang Level 1, Normal ang Level 2-3, at Mahirap ang Level 4-5.\n\n" +
      "• Mga Pagsusulit: Pipili ang manlalaro ng kategorya para magsimula. Bawat level ay may 6 na tanong, isa bawat aktibidad, at bawat tanong ay may time limit na 60 segundo. Ang tanong ay maaaring Multiple Choice, Identification, o Enumeration. Dapat masagot nang tama ang lahat ng 6 na tanong para ma-unlock ang susunod na level.\n\n" +
      "• Jigsaw Puzzle: Pipili ang manlalaro ng kategorya para magsimula, at dapat mabuo ang puzzle sa loob ng 60 segundo para makapagpatuloy. Ang dami ng piraso ay nakabatay sa puwesto ng aktibidad sa level, at maaari itong baguhin ng guro: Aktibidad 1-2: 6 piraso (2x3). Aktibidad 3-4: 9 piraso (3x3). Aktibidad 5-6: 12 piraso (3x4).\n\n" +
      "• Mga Pagsubok at Puntos: Hanggang 3 pagsubok ang bawat aktibidad. Ang tamang sagot ay may 15 puntos sa unang pagsubok, 10 sa ikalawa, at 6 sa ikatlo; walang puntos ang maling sagot o ang naubusan ng oras. Gantimpala sa bilis ang medalya: ginto kung natapos sa loob ng kalahati ng oras, pilak kung sa loob ng tatlong-kapat, at tanso kung lampas doon.\n\n" +
      "• Nilalaman: Ang mga guro (admin) ay nagdadagdag, nagbubura o nag-a-archive, nagdu-duplicate, at nagpa-publish ng mga activity pack. Para sa pagsusulit, isinusulat ng guro ang mga tanong ng bawat aktibidad sa bawat level (Multiple Choice, Identification, o Enumeration) at maaaring magdagdag ng mini-lesson na may opsyonal na larawan. Para sa jigsaw, itinatakda ng guro ang larawan ng puzzle at isang mini-lesson para sa bawat kategorya; hinahati ang larawan sa 6, 9, o 12 piraso.",
    conductTitle: 'Alituntunin ng Pag-uugali',
    playerRulesTitle: 'MOBILE APP — PARA SA MANLALARO (GRADE 5-6):',
    playerRules:
      "• Maging tapat sa lahat ng aktibidad sa pag-aaral at paglalaro.\n" +
      "• Panatilihing kompidensyal ang iyong account credentials.\n" +
      "• Gamitin ang platform para sa layuning pang-edukasyon lamang.\n" +
      "Paalala: Ang paglabag ay maaaring magresulta sa agarang restriksyon o suspensyon ng account.",
    adminRulesTitle: 'MOBILE APP AT WEB — PARA SA ADMIN (GURO):',
    adminRules:
      "• Gamitin ang datos ng estudyante para lamang sa akademikong pagsubaybay, ebalwasyon, at gabay.\n" +
      "• Mahigpit na sundin ang mga regulasyon sa privacy at proteksyon ng datos ng estudyante.\n" +
      "• Pumili at mag-assign ng angkop na materyal sa loob ng application.\n" +
      "• Responsableng pamahalaan ang mga user account at edukasyonal na nilalaman.\n" +
      "• Magdagdag, magbura o mag-archive, mag-duplicate, at mag-publish ng mga activity pack.\n" +
      "Paalala: Ang paglabag ay maaaring magresulta sa agarang restriksyon o suspensyon ng account.",
    mainAdminRulesTitle: 'WEB — PARA SA MAIN ADMIN (DEVELOPER):',
    mainAdminRules:
      "• Subaybayan ang lahat ng user account na gumagamit ng application, para mapanatili itong ligtas at maiwasan ang kahina-hinala o hindi awtorisadong paggamit.\n" +
      "• Magdagdag, magbura o mag-archive, mag-duplicate, mag-publish, at mag-edit ng mga activity pack at ng nilalaman nito.\n" +
      "• Burahin ang mga hindi ginagamit na account, pack at klase.",
    checkboxLabel: 'Tinatanggap ko ang Mga Tuntunin at Kundisyon (Kinakailangan)',
    continueBtn: 'Magpatuloy',
    cancelBtn: 'Kanselahin',
    cancelAlertTitle: 'Hindi Tinanggap ang Terms',
    cancelAlertMsg: 'Kailangan mong tanggapin ang Terms & Conditions para magamit ang JuanWise.',
  },
};

export type TermsLanguage = keyof typeof termsContent;
