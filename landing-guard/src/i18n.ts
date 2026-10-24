export type Lang = 'ar' | 'fr' | 'en'
export const LANGS: Lang[] = ['ar', 'fr', 'en']

type Dict = Record<string, string>

const ar: Dict = {
  'nav.skip': 'تخطَّ إلى المحتوى',
  'nav.brand': 'برنامج إدارة الأمن بالكلية',
  'nav.shift': 'المناوبة',
  'nav.registers': 'السجلات',
  'nav.gate': 'البوابة',
  'nav.audit': 'التدقيق',
  'nav.demo': 'التجربة',
  'nav.present': 'ابدأ العرض',
  'gl.loading': 'يجري تجهيز المشهد…',
  'hero.h1': 'كل صباح يبدأ عند البوابة، والسجلّ مفتوح.',
  'hero.sub': 'برنامج إدارة الأمن بالكلية: كل مناوبة وكل زائر وكل حادثة تُكتب في سجلات مكتب الأمن الداخلي لكلية الحقوق والعلوم السياسية، جامعة غرداية.',
  'hero.try': 'جرّب البرنامج',
  'hero.live': 'من السجل · عيّنة',
  'shift.h': 'تبدأ المناوبة بالسجلّ.',
  'shift.p': 'عند بداية كل مناوبة يملأ رئيس الفرقة الصاعد سجلّ المناوبة وسجلّ تسليم العهدة، ويذكر رئيس الفرقة النازل. لا اسم مستخدم: لكل شخص رقمه السري الخاص، وبه يُعرف.',
  'role.guard.h': 'عون الأمن',
  'role.guard.p': 'يسجّل الزوار والمراسلات والمفقودات والحوادث، ويرى آخر 24 ساعة.',
  'role.leader.h': 'رئيس فرقة الأمن',
  'role.leader.p': 'يفتح المناوبة ويستلم العهدة من الفرقة النازلة.',
  'role.admin.h': 'مسؤول الأمن',
  'role.admin.p': 'يدير الحسابات والصلاحيات، ويبني السجلات، ويطّلع على التاريخ كله.',
  'reg.h': 'دفاتر المكتب، على رفّ واحد.',
  'reg.p': 'كل دفتر ورقي في مكتب الأمن صار سجلًا رقميًا مرقّمًا. مرّر الفأرة على الرف أو اختر سجلًا.',
  'reg.print': 'كل سجل يُطبع ويُصدَّر: PDF وExcel على ورقة A4 بترويسة الكلية وشعاري الجامعة والكلية.',
  'gate.h': 'لا يمرّ زائر دون أن يُسجَّل.',
  'gate.p': 'عند البوابة يُقرأ جواز السفر أو بطاقة الهوية بالكاميرا، فيُملأ نموذج الزائر ويراجع العون كل حقل.',
  'gate.l1': 'المنطقة المقروءة آليًا ورموز QR والنص المطبوع بالعربية واللاتينية: كلها تُقرأ على الحاسوب نفسه.',
  'gate.l2': 'قائمة مراقبة، وقائمة بمن هم داخل الكلية الآن، وتسجيل الخروج.',
  'gate.l3': 'صورة البطاقة تُحفظ مشفّرة مع القيد.',
  'gate.l4': 'دليل الطلبة: يُتعرَّف على الطالب من اسمه أو رقم بطاقته.',
  'audit.h': 'لا شيء يُمحى، ولا شيء يخرج.',
  'audit.p': 'القيود مرقّمة ولا تُحذف: الخطأ يُصحَّح ويبقى الأصل ظاهرًا. يرى العون آخر 24 ساعة، ويرى المسؤول التاريخ كله، ويُسجَّل اطّلاعه.',
  'audit.title': 'سجل المفقودات · عيّنة',
  'audit.corr': 'صُحّح بواسطة رئيس فرقة الأمن · الأصل محفوظ',
  'demo.h': 'جرّبه بنفسك.',
  'demo.sub': 'هذا هو البرنامج نفسه يعمل في المتصفح ببيانات تجريبية بالعربية. لا يُرسَل شيء إلى أي مكان. الأرقام السرية للتجربة في الشريط أسفل الشاشة.',
  'demo.open': 'افتح بملء الشاشة',
  'demo.missing': 'النسخة التجريبية غير مبنية بعد. شغّل npm run site داخل مجلد landing-guard.',
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
  'nav.shift': 'Le service',
  'nav.registers': 'Registres',
  'nav.gate': 'Le portail',
  'nav.audit': 'Audit',
  'nav.demo': 'Essai',
  'nav.present': 'Lancer la présentation',
  'gl.loading': 'Préparation de la scène…',
  'hero.h1': 'Chaque matin commence au portail, registre ouvert.',
  'hero.sub': 'Chaque prise de service, chaque visiteur, chaque incident est écrit dans les registres du bureau de sécurité interne de la Faculté de droit et des sciences politiques, Université de Ghardaïa.',
  'hero.try': 'Essayer le programme',
  'hero.live': 'Extrait du registre · exemple',
  'shift.h': 'Le service commence par le registre.',
  'shift.p': 'À chaque prise de service, le chef d’équipe entrant remplit le registre de permanence et la passation du matériel, en nommant le chef sortant. Pas de nom d’utilisateur : chacun a son code PIN, qui l’identifie.',
  'role.guard.h': 'Agent de sécurité',
  'role.guard.p': 'Enregistre visiteurs, courrier, objets trouvés et incidents ; voit les dernières 24 heures.',
  'role.leader.h': 'Chef d’équipe',
  'role.leader.p': 'Ouvre le service et reçoit le matériel de l’équipe sortante.',
  'role.admin.h': 'Responsable de la sécurité',
  'role.admin.p': 'Gère comptes et droits, crée les registres et consulte tout l’historique.',
  'reg.h': 'Les cahiers du poste, sur une seule étagère.',
  'reg.p': 'Chaque cahier papier du bureau est devenu un registre numérique numéroté. Survolez l’étagère ou choisissez un registre.',
  'reg.print': 'Chaque registre s’imprime et s’exporte : PDF et Excel, en A4, avec l’en-tête de la faculté et les deux logos.',
  'gate.h': 'Aucun visiteur n’entre sans être enregistré.',
  'gate.p': 'Au portail, la caméra lit le passeport ou la carte d’identité, la fiche visiteur se remplit et l’agent vérifie chaque champ.',
  'gate.l1': 'Zone lisible par machine, codes QR, texte imprimé en arabe et en latin : tout est lu sur le PC lui-même.',
  'gate.l2': 'Une liste de surveillance, la liste des personnes présentes, et l’enregistrement des sorties.',
  'gate.l3': 'La photo de la carte est conservée chiffrée avec l’entrée.',
  'gate.l4': 'Annuaire des étudiants : l’étudiant est reconnu par son nom ou son numéro de carte.',
  'audit.h': 'Rien ne s’efface, rien ne sort.',
  'audit.p': 'Les entrées sont numérotées et jamais supprimées : une erreur est corrigée et l’original reste visible. L’agent voit les dernières 24 heures, le responsable tout l’historique, et sa consultation est journalisée.',
  'audit.title': 'Objets trouvés · exemple',
  'audit.corr': 'Corrigé par le chef d’équipe · l’original est conservé',
  'demo.h': 'Essayez-le vous-même.',
  'demo.sub': 'C’est le programme lui-même, dans le navigateur, avec des données d’exemple en arabe. Rien n’est envoyé nulle part. Les codes PIN d’essai sont dans la barre en bas de l’écran.',
  'demo.open': 'Ouvrir en plein écran',
  'demo.missing': 'La démo n’est pas encore construite. Lancez npm run site dans le dossier landing-guard.',
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
  'nav.shift': 'The shift',
  'nav.registers': 'Registers',
  'nav.gate': 'The gate',
  'nav.audit': 'Audit',
  'nav.demo': 'Try it',
  'nav.present': 'Start presentation',
  'gl.loading': 'Setting up the scene…',
  'hero.h1': 'Every morning starts at the gate, with the register open.',
  'hero.sub': 'Every shift, every visitor, every incident is written into the registers of the internal security office of the Faculty of Law and Political Science, University of Ghardaia.',
  'hero.try': 'Try the program',
  'hero.live': 'From the register · sample',
  'shift.h': 'The shift starts with the register.',
  'shift.p': 'At the start of every shift the incoming team leader fills the shift register and the custody handover, naming the outgoing leader. No usernames: everyone has their own PIN, and the PIN says who they are.',
  'role.guard.h': 'Guard',
  'role.guard.p': 'Records visitors, letters, lost items and incidents; sees the last 24 hours.',
  'role.leader.h': 'Team leader',
  'role.leader.p': 'Opens the shift and takes over the custody from the outgoing team.',
  'role.admin.h': 'Security officer',
  'role.admin.p': 'Manages accounts and permissions, builds registers, and sees the whole history.',
  'reg.h': 'The office’s books, on one shelf.',
  'reg.p': 'Every paper book in the security office became a numbered digital register. Hover over the shelf or pick a register.',
  'reg.print': 'Every register prints and exports: PDF and Excel, on A4 with the faculty header and both logos.',
  'gate.h': 'No visitor passes without being recorded.',
  'gate.p': 'At the gate the camera reads the passport or ID card, the visitor form fills itself, and the guard checks every field.',
  'gate.l1': 'Machine-readable zone, QR codes, printed Arabic and Latin text: all read on the PC itself.',
  'gate.l2': 'A watchlist, the list of who is inside right now, and the exit record.',
  'gate.l3': 'The picture of the card is stored encrypted with the entry.',
  'gate.l4': 'Student directory: a student is recognised by name or card number.',
  'audit.h': 'Nothing is erased. Nothing leaves.',
  'audit.p': 'Entries are numbered and never deleted: a mistake is corrected and the original stays visible. Guards see the last 24 hours, the officer sees the whole history, and that viewing is logged.',
  'audit.title': 'Lost and found · sample',
  'audit.corr': 'Corrected by the team leader · the original is kept',
  'demo.h': 'Try it yourself.',
  'demo.sub': 'This is the program itself, running in the browser on Arabic sample data. Nothing is sent anywhere. The sample PINs are in the bar at the bottom of the screen.',
  'demo.open': 'Open full screen',
  'demo.missing': 'The demo is not built yet. Run npm run site inside the landing-guard folder.',
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

/** Sample entries for the ticker; they mirror the registers the faculty really has. */
export const TICKER: Record<Lang, string[]> = {
  ar: [
    '07:30 · سجل المناوبة · تسلّمت الفرقة الصاعدة، الجميع حاضر',
    '07:36 · تسليم العهدة · المفاتيح والكاميرات وأجهزة الاتصال سليمة',
    '08:10 · زائر · إلى الأمانة العامة · خرج 08:45',
    '08:40 · المراسلات · ظرف موجّه إلى العمادة',
    '09:15 · المفقودات · محفظة سوداء، المدرج 2',
    '10:30 · الحوادث · عطب في باب القاعة 4، أُبلغت المصلحة'
  ],
  fr: [
    '07:30 · Permanence · équipe entrante au complet',
    '07:36 · Passation · clés, caméras et radios en état',
    '08:10 · Visiteur · vers le secrétariat général · sorti à 08:45',
    '08:40 · Courrier · pli adressé au décanat',
    '09:15 · Objets trouvés · portefeuille noir, amphi 2',
    '10:30 · Incidents · porte de la salle 4 en panne, service informé'
  ],
  en: [
    '07:30 · Shift · incoming team all present',
    '07:36 · Custody · keys, cameras and radios in order',
    '08:10 · Visitor · to the general secretariat · left 08:45',
    '08:40 · Letters · envelope addressed to the deanship',
    '09:15 · Lost and found · black wallet, lecture hall 2',
    '10:30 · Incidents · door of room 4 broken, service notified'
  ]
}

export let lang: Lang = 'ar'
export const t = (key: string): string => DICT[lang][key] ?? DICT.ar[key] ?? key

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
