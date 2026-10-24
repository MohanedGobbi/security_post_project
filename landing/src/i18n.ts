export type Lang = 'ar' | 'fr' | 'en'
export const LANGS: Lang[] = ['ar', 'fr', 'en']

type Dict = Record<string, string>

const ar: Dict = {
  'nav.skip': 'تخطَّ إلى المحتوى',
  'nav.brand': 'برنامج إدارة الأمن بالكلية',
  'nav.story': 'من الورق',
  'nav.doors': 'السجلات',
  'nav.scan': 'البطاقة',
  'nav.demo': 'التجربة',
  'nav.walls': 'الأمان',
  'nav.present': 'ابدأ العرض',
  'hero.h1': 'كل دخول، كل حادثة: مسجَّلة ولا تُمحى.',
  'hero.sub': 'برنامج إدارة الأمن بالكلية يحلّ محلّ دفاتر مكتب الأمن الداخلي في كلية الحقوق والعلوم السياسية، جامعة غرداية.',
  'hero.try': 'جرّبه الآن',
  'card.alt': 'بطاقة تعريف نموذجية ثلاثية الأبعاد',
  'card.specimen': 'بطاقة نموذجية، بيانات وهمية',
  'form.title': 'نموذج الزائر',
  'form.surname': 'اللقب',
  'form.given': 'الاسم',
  'form.birth': 'تاريخ الميلاد',
  'form.docno': 'رقم الوثيقة',
  'form.wait': 'في انتظار البطاقة…',
  'form.read': 'جارٍ قراءة المنطقة المقروءة آليًا…',
  'form.done': 'أرقام المراقبة سليمة · قُرئت دون إنترنت',
  'form.again': 'أعد القراءة',
  'story.h1': 'على الورق، خطأ واحد يُشطب فتضيع المعلومة.',
  'story.h2': 'على الشاشة، يبقى الخطأ ظاهرًا ومعه من صحّحه ومتى.',
  'story.c1': 'مرقّمة',
  'story.c2': 'لا تُمحى',
  'story.c3': 'كل تصحيح موثّق في سجل التدقيق',
  'reg.title': 'سجل المراسلات والمفقودات',
  'reg.sample': 'عيّنة',
  'reg.corr': 'صُحّح بواسطة رئيس فرقة الأمن · الأصل محفوظ',
  'doors.h': 'كل دفتر ورقي صار بابًا.',
  'doors.sub': 'ستة سجلات مأخوذة من دفاتر الكلية نفسها، جاهزة منذ أول تشغيل. وللمسؤول أن يبني سجلًا جديدًا بنفسه.',
  'doors.print': 'كل سجل يُطبع ويُصدَّر: PDF وExcel على ورقة A4 بترويسة الكلية وشعاري الجامعة والكلية.',
  'scan.h': 'من البطاقة إلى السجل دون كتابة.',
  'scan.s1h': 'ضع البطاقة أمام الكاميرا',
  'scan.s1p': 'تُقرأ تلقائيًا ما دامت داخل الإطار: لا زر ولا انتظار.',
  'scan.s2h': 'تُتحقَّق أرقام المراقبة',
  'scan.s2p': 'تُقرأ المنطقة المقروءة آليًا بعدة نسخ محسَّنة من الصورة حتى تصحّ أرقام التحقق.',
  'scan.s3h': 'يُملأ النموذج ويُحفظ الأصل',
  'scan.s3p': 'تُحفظ صورة البطاقة مشفّرة مع القيد، وتُحذف معه عند التنظيف الدوري.',
  'scan.extra': 'جوازات السفر وبطاقات الهوية ورموز QR. وللبطاقات التي لا منطقة مقروءة آليًا فيها، يُقرأ النص المطبوع بالعربية واللاتينية بقارئ محلي على الحاسوب.',
  'demo.h': 'جرّبه بنفسك.',
  'demo.sub': 'هذا هو البرنامج نفسه يعمل في المتصفح ببيانات تجريبية بالعربية. لا يُرسَل شيء إلى أي مكان. الأرقام السرية للتجربة في الشريط أسفل الشاشة.',
  'demo.open': 'افتح بملء الشاشة',
  'demo.missing': 'النسخة التجريبية غير مبنية بعد. شغّل npm run site داخل مجلد landing.',
  'walls.h': 'يعيش داخل أسوار الكلية.',
  'walls.sub': 'كما تحتمي قصور وادي مزاب بأسوارها، تبقى البيانات داخل الحاسوب الذي يعمل عليه البرنامج في مكتب الأمن.',
  'walls.net': 'الإنترنت',
  'walls.pc': 'حاسوب مكتب الأمن',
  'close.h': 'برنامج إدارة الأمن بالكلية',
  'close.org': 'صُنع لكلية الحقوق والعلوم السياسية، جامعة غرداية.',
  'close.nexth': 'المرحلة المقبلة',
  'close.n1': 'تقارير وإحصاءات بحسب اليوم والأسبوع والشهر والسنة.',
  'close.n2': 'اختبار قراءة البطاقات على بطاقات حقيقية.',
  'close.n3': 'تجربة ميدانية في مكتب الأمن بالكلية.',
  'close.made': 'صُنع بواسطة',
  'pres.prev': 'السابق',
  'pres.next': 'التالي',
  'pres.exit': 'خروج'
}

const fr: Dict = {
  'nav.skip': 'Aller au contenu',
  'nav.brand': 'Gestion de la sécurité de la faculté',
  'nav.story': 'Du papier',
  'nav.doors': 'Registres',
  'nav.scan': 'La carte',
  'nav.demo': 'Essai',
  'nav.walls': 'Sécurité',
  'nav.present': 'Lancer la présentation',
  'hero.h1': 'Chaque entrée, chaque incident : consigné, jamais effacé.',
  'hero.sub': 'Le programme remplace les registres papier du bureau de sécurité interne de la Faculté de droit et des sciences politiques, Université de Ghardaïa.',
  'hero.try': 'Essayer maintenant',
  'card.alt': 'Carte d’identité factice en 3D',
  'card.specimen': 'Carte factice, données fictives',
  'form.title': 'Fiche visiteur',
  'form.surname': 'Nom',
  'form.given': 'Prénom',
  'form.birth': 'Date de naissance',
  'form.docno': 'N° du document',
  'form.wait': 'En attente de la carte…',
  'form.read': 'Lecture de la zone lisible par machine…',
  'form.done': 'Chiffres de contrôle valides · lu hors ligne',
  'form.again': 'Relire',
  'story.h1': 'Sur papier, une erreur est rayée et l’information disparaît.',
  'story.h2': 'À l’écran, l’erreur reste visible, avec qui l’a corrigée et quand.',
  'story.c1': 'Numérotées',
  'story.c2': 'Jamais effacées',
  'story.c3': 'Chaque correction tracée dans le journal d’audit',
  'reg.title': 'Registre du courrier et des objets',
  'reg.sample': 'Exemple',
  'reg.corr': 'Corrigé par le chef d’équipe · l’original est conservé',
  'doors.h': 'Chaque cahier papier est devenu une porte.',
  'doors.sub': 'Six registres tirés des cahiers de la faculté, prêts dès le premier démarrage. L’administrateur peut en créer d’autres lui-même.',
  'doors.print': 'Chaque registre s’imprime et s’exporte : PDF et Excel, en A4, avec l’en-tête de la faculté et les logos de l’université et de la faculté.',
  'scan.h': 'De la carte au registre, sans rien taper.',
  'scan.s1h': 'Présentez la carte devant la caméra',
  'scan.s1p': 'Elle est lue automatiquement tant qu’elle est dans le cadre : ni bouton, ni attente.',
  'scan.s2h': 'Les chiffres de contrôle sont vérifiés',
  'scan.s2p': 'La zone lisible par machine est lue sur plusieurs versions améliorées de l’image, jusqu’à ce que les chiffres de contrôle concordent.',
  'scan.s3h': 'La fiche se remplit, l’original est gardé',
  'scan.s3p': 'La photo de la carte est conservée chiffrée avec l’entrée, et supprimée avec elle lors du nettoyage périodique.',
  'scan.extra': 'Passeports, cartes d’identité, codes QR. Pour les cartes sans zone lisible par machine, le texte imprimé en arabe et en latin est lu par un lecteur local sur le PC.',
  'demo.h': 'Essayez-le vous-même.',
  'demo.sub': 'C’est le programme lui-même, dans le navigateur, avec des données d’exemple en arabe. Rien n’est envoyé nulle part. Les codes PIN d’essai sont dans la barre en bas de l’écran.',
  'demo.open': 'Ouvrir en plein écran',
  'demo.missing': 'La démo n’est pas encore construite. Lancez npm run site dans le dossier landing.',
  'walls.h': 'Il vit entre les murs de la faculté.',
  'walls.sub': 'Comme les ksour de la vallée du M’zab derrière leurs remparts, les données restent sur le PC du bureau de sécurité où tourne le programme.',
  'walls.net': 'Internet',
  'walls.pc': 'PC du bureau de sécurité',
  'close.h': 'Gestion de la sécurité de la faculté',
  'close.org': 'Conçu pour la Faculté de droit et des sciences politiques, Université de Ghardaïa.',
  'close.nexth': 'Prochaine étape',
  'close.n1': 'Rapports et statistiques par jour, semaine, mois et année.',
  'close.n2': 'Test de la lecture sur de vraies cartes d’identité.',
  'close.n3': 'Essai sur le terrain au bureau de sécurité de la faculté.',
  'close.made': 'Réalisé par',
  'pres.prev': 'Précédent',
  'pres.next': 'Suivant',
  'pres.exit': 'Quitter'
}

const en: Dict = {
  'nav.skip': 'Skip to content',
  'nav.brand': 'Faculty Security Management',
  'nav.story': 'From paper',
  'nav.doors': 'Registers',
  'nav.scan': 'The card',
  'nav.demo': 'Try it',
  'nav.walls': 'Security',
  'nav.present': 'Start presentation',
  'hero.h1': 'Every entry, every incident: recorded, never erased.',
  'hero.sub': 'The program replaces the paper registers of the internal security office of the Faculty of Law and Political Science, University of Ghardaia.',
  'hero.try': 'Try it now',
  'card.alt': 'A 3D specimen identity card',
  'card.specimen': 'Specimen card, fictional data',
  'form.title': 'Visitor form',
  'form.surname': 'Surname',
  'form.given': 'Given name',
  'form.birth': 'Date of birth',
  'form.docno': 'Document number',
  'form.wait': 'Waiting for a card…',
  'form.read': 'Reading the machine-readable zone…',
  'form.done': 'Check digits valid · read offline',
  'form.again': 'Scan again',
  'story.h1': 'On paper, one mistake is scratched out and the information is gone.',
  'story.h2': 'On screen, the mistake stays visible, with who fixed it and when.',
  'story.c1': 'Numbered',
  'story.c2': 'Never erased',
  'story.c3': 'Every correction logged in the audit trail',
  'reg.title': 'Letters and lost-items register',
  'reg.sample': 'Sample',
  'reg.corr': 'Corrected by the team leader · the original is kept',
  'doors.h': 'Every paper book became a door.',
  'doors.sub': 'Six registers taken from the faculty’s own books, ready from the first start. The administrator can build a new one without help.',
  'doors.print': 'Every register prints and exports: PDF and Excel, on A4 with the faculty header and both logos.',
  'scan.h': 'From the card to the register, without typing.',
  'scan.s1h': 'Hold the card in front of the camera',
  'scan.s1p': 'It is read automatically while it stays in the frame: no button, no waiting.',
  'scan.s2h': 'The check digits are verified',
  'scan.s2p': 'The machine-readable zone is read from several enhanced versions of the image until the check digits agree.',
  'scan.s3h': 'The form fills, the original is kept',
  'scan.s3p': 'The picture of the card is stored encrypted with the entry, and deleted with it by the periodic clean-up.',
  'scan.extra': 'Passports, ID cards, QR codes. For cards with no machine-readable zone, the printed text in Arabic and Latin is read by a local reader on the PC.',
  'demo.h': 'Try it yourself.',
  'demo.sub': 'This is the program itself, running in the browser on Arabic sample data. Nothing is sent anywhere. The sample PINs are in the bar at the bottom of the screen.',
  'demo.open': 'Open full screen',
  'demo.missing': 'The demo is not built yet. Run npm run site inside the landing folder.',
  'walls.h': 'It lives inside the faculty’s walls.',
  'walls.sub': 'Like the ksour of the M’zab valley behind their ramparts, the data stays on the security office’s own PC.',
  'walls.net': 'The internet',
  'walls.pc': 'Security office PC',
  'close.h': 'Faculty Security Management',
  'close.org': 'Made for the Faculty of Law and Political Science, University of Ghardaia.',
  'close.nexth': 'What comes next',
  'close.n1': 'Reports and statistics by day, week, month and year.',
  'close.n2': 'Testing the card reading on real identity cards.',
  'close.n3': 'A field trial at the faculty’s security office.',
  'close.made': 'Made by',
  'pres.prev': 'Previous',
  'pres.next': 'Next',
  'pres.exit': 'Exit'
}

const DICT: Record<Lang, Dict> = { ar, fr, en }

export let lang: Lang = 'ar'
export const t = (key: string): string => DICT[lang][key] ?? DICT.ar[key] ?? key

export interface Door { key: string; name: Record<Lang, string>; blurb: Record<Lang, string>; fields: Record<Lang, string[]> }

// names and field labels are the ones in src/shared/registerTemplates.ts of the program
export const DOORS: Door[] = [
  {
    key: 'shift',
    name: { ar: 'سجل المناوبة', fr: 'Registre de permanence', en: 'Shift register' },
    blurb: {
      ar: 'يملؤه رئيس الفرقة الصاعد عند بداية كل مناوبة، ويذكر فيه الرئيس النازل: تنتهي ورقة التسليم.',
      fr: 'Rempli par le chef d’équipe entrant à chaque prise de service, qui nomme le sortant : la feuille de passation disparaît.',
      en: 'Filled by the incoming team leader at the start of every shift, naming the outgoing one: the handover sheet is gone.'
    },
    fields: {
      ar: ['رئيس فرقة الأمن النازل', 'التحاق جميع أفراد الفرقة الصاعدة بمقر عملهم', 'أسماء المتغيبين أو المتأخرين'],
      fr: ['Chef d’équipe sortant', 'Toute l’équipe entrante présente', 'Noms des absents ou retardataires'],
      en: ['Outgoing team leader', 'All members of the incoming team present', 'Names of those absent or late']
    }
  },
  {
    key: 'custody',
    name: { ar: 'سجل تسليم واستلام العهدة', fr: 'Passation du matériel', en: 'Custody handover' },
    blurb: {
      ar: 'المفاتيح والكاميرات وأجهزة الاتصال والعتاد والقاعات: نعم أو لا، مع ملاحظة عند الحاجة.',
      fr: 'Clés, caméras, radios, matériel, salles : oui ou non, avec une remarque si besoin.',
      en: 'Keys, cameras, radios, equipment, rooms: yes or no, with a note when needed.'
    },
    fields: {
      ar: ['وجود المفاتيح في عهدة مكتب الأمن', 'الكاميرات تشتغل', 'أجهزة الاتصال وأجهزة التفتيش سليمة'],
      fr: ['Toutes les clés du poste présentes', 'Caméras en marche', 'Radios et détecteurs en état'],
      en: ['All keys of the security office present', 'Cameras working', 'Radios and inspection devices in order']
    }
  },
  {
    key: 'incidents',
    name: { ar: 'سجل الحوادث', fr: 'Registre des incidents', en: 'Incidents register' },
    blurb: {
      ar: 'من وصف الحادث إلى الإجراءات المتخذة، وتنتهي بتأشيرة العمادة وملاحظاتها.',
      fr: 'De la description de l’incident aux mesures prises, et se termine par le visa du décanat.',
      en: 'From the description of the incident to the action taken, ending with the deanship’s visa.'
    },
    fields: {
      ar: ['وصف دقيق مختصر للحادث', 'الإجراءات المتخذة', 'ملاحظات العمادة'],
      fr: ['Description courte et précise', 'Mesures prises', 'Observations du décanat'],
      en: ['Short, precise description', 'Action taken', 'Deanship remarks']
    }
  },
  {
    key: 'lost_found',
    name: { ar: 'سجل المفقودات', fr: 'Objets trouvés', en: 'Lost and found' },
    blurb: {
      ar: 'الغرض ومكان العثور عليه، ثم تسليمه لصاحبه مع بياناته، وهي مشفّرة.',
      fr: 'L’objet et le lieu où il a été trouvé, puis sa remise au propriétaire avec ses données, chiffrées.',
      en: 'The item and where it was found, then its return to the owner with their details, encrypted.'
    },
    fields: {
      ar: ['وصف الغرض الذي عثر عليه', 'مكان العثور عليه', 'المستلم (صاحب الغرض)'],
      fr: ['Description de l’objet', 'Lieu où il a été trouvé', 'Propriétaire qui l’a reçu'],
      en: ['Description of the item', 'Where it was found', 'Owner who received it']
    }
  },
  {
    key: 'letters',
    name: { ar: 'سجل المراسلات', fr: 'Registre du courrier', en: 'Letters register' },
    blurb: {
      ar: 'الجهة المرسلة والجهة المرسل إليها، وغالبًا العمادة، ثم حامل المراسلة ومن استلمها.',
      fr: 'L’expéditeur et le destinataire, le plus souvent le décanat, puis celui qui l’a apporté et celui qui l’a reçu.',
      en: 'Who sent it and who it is addressed to, most often the deanship, then who brought it and who received it.'
    },
    fields: {
      ar: ['الجهة المرسلة', 'الجهة المرسل إليها', 'اسم ولقب المستلم'],
      fr: ['Expéditeur', 'Destinataire', 'Reçu par'],
      en: ['Sender', 'Addressed to', 'Received by']
    }
  },
  {
    key: 'events',
    name: { ar: 'سجل الفعاليات والنشاطات', fr: 'Événements et activités', en: 'Events and activities' },
    blurb: {
      ar: 'النشاط والجهة المنظمة والتوقيت، مع إجراءات التأمين الخاصة وما سُجّل من حوادث.',
      fr: 'L’activité, l’organisateur et l’horaire, avec les mesures de sécurité particulières et les incidents relevés.',
      en: 'The activity, the organiser and the timing, with the special security measures and any incidents recorded.'
    },
    fields: {
      ar: ['النشاط المنظم', 'الجهة المنظمة', 'إجراءات التأمين الخاصة'],
      fr: ['Activité', 'Organisateur', 'Mesures de sécurité particulières'],
      en: ['Activity', 'Organiser', 'Special security measures']
    }
  },
  {
    key: 'add',
    name: { ar: 'سجل جديد', fr: 'Nouveau registre', en: 'A new register' },
    blurb: {
      ar: 'بمنشئ السجلات يضيف المسؤول الحقول واللون والترتيب، فيظهر السجل فورًا للأعوان.',
      fr: 'Avec le créateur de registres, l’administrateur ajoute champs, couleur et ordre, et le registre apparaît aussitôt chez les agents.',
      en: 'With the register builder the administrator adds fields, colour and order, and the register shows up straight away for the guards.'
    },
    fields: {
      ar: ['الحقول وأنواعها', 'لون السجل ونص المساعدة', 'من يملأ ومن يغلق'],
      fr: ['Champs et types', 'Couleur et texte d’aide', 'Qui remplit et qui clôture'],
      en: ['Fields and their types', 'Colour and help text', 'Who fills and who closes']
    }
  }
]

export interface Fact { title: Record<Lang, string>; text: Record<Lang, string> }

// every line below is stated in README.md ("Privacy and security", "System tab")
export const FACTS: Fact[] = [
  {
    title: { ar: 'بلا إنترنت', fr: 'Sans internet', en: 'No internet' },
    text: {
      ar: 'يعمل كاملًا دون شبكة، وقراءة البطاقات تجري على الحاسوب نفسه.',
      fr: 'Fonctionne entièrement sans réseau ; la lecture des cartes se fait sur le PC.',
      en: 'Works fully without a network; card reading happens on the PC itself.'
    }
  },
  {
    title: { ar: 'بيانات مشفّرة', fr: 'Données chiffrées', en: 'Encrypted data' },
    text: {
      ar: 'رقم الهوية وتاريخ الميلاد والهاتف والصور تُخزَّن مشفّرة بـ AES-256-GCM.',
      fr: 'Numéro de pièce, date de naissance, téléphone et photos sont chiffrés en AES-256-GCM.',
      en: 'ID numbers, birth dates, phone numbers and photos are stored encrypted with AES-256-GCM.'
    }
  },
  {
    title: { ar: 'مفتاح لا يُنسخ', fr: 'Une clé qui ne se copie pas', en: 'A key that cannot be copied' },
    text: {
      ar: 'المفتاح مرتبط بحساب ويندوز: ملف قاعدة البيانات المنسوخ لا يُقرأ على جهاز آخر.',
      fr: 'La clé est liée au compte Windows : une copie du fichier de base de données est illisible ailleurs.',
      en: 'The key is tied to the Windows account: a copied database file is unreadable on another PC.'
    }
  },
  {
    title: { ar: 'كل شيء موثَّق', fr: 'Tout est tracé', en: 'Everything is logged' },
    text: {
      ar: 'كل دخول وعرض وتصحيح وتصدير يُكتب في سجل التدقيق.',
      fr: 'Chaque connexion, saisie, consultation, correction et export est écrit dans le journal d’audit.',
      en: 'Every login, entry, view, correction and export is written to the audit trail.'
    }
  },
  {
    title: { ar: 'نسخ احتياطية', fr: 'Sauvegardes', en: 'Backups' },
    text: {
      ar: 'ملف نسخ احتياطي بكلمة سر، ونسخ أمان يومية قبل أي عملية مسح.',
      fr: 'Un fichier de sauvegarde protégé par mot de passe, et des copies de sécurité chaque jour et avant tout effacement.',
      en: 'A password-protected backup file, and safety copies every day and before anything that erases.'
    }
  }
]

type Listener = (l: Lang) => void
const listeners: Listener[] = []
export const onLang = (fn: Listener): void => { listeners.push(fn) }

export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n!) })
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria!)) })
}

export function setLang(next: Lang, persist = true): void {
  lang = next
  const html = document.documentElement
  html.lang = next
  html.dir = next === 'ar' ? 'rtl' : 'ltr'
  document.title = t('nav.brand')
  applyI18n()
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === next)))
  if (persist) { try { localStorage.setItem('lang', next) } catch { /* private mode */ } }
  listeners.forEach((fn) => fn(next))
}

export function initialLang(): Lang {
  const q = new URLSearchParams(location.search).get('lang')
  if (q === 'ar' || q === 'fr' || q === 'en') return q
  try {
    const s = localStorage.getItem('lang')
    if (s === 'ar' || s === 'fr' || s === 'en') return s
  } catch { /* private mode */ }
  return 'ar'
}
