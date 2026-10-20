// Place-specific text of the demo data: one set per brand (src/renderer/src/brand.ts).
// store.ts builds the records (times, ids, statuses) and takes names, places and companies from here.
import type { AccountValue, EntryValues, Lang, Role } from '@shared/types'

type Visit = { name: string; company: string; host: string; purpose: string; alt?: string; plate?: string }

/** a reception-app account of the demo; the first one is the administrator, the second signs the handover */
export interface DemoUser { name: string; role: Role; pin: string; language: Lang }

/** builds dates relative to now and account values for sample register entries */
export interface SampleHelpers { day(offsetDays: number): string; at(hoursAgo: number): string; user(index: number): AccountValue }

/** a sample entry of a register (by its key); users by their index in Flavor.users */
export interface SampleEntry {
  register: string
  hoursAgo: number
  by: number
  closedHoursAgo?: number
  closedBy?: number
  values(h: SampleHelpers): EntryValues
}

export interface Flavor {
  users: DemoUser[]
  /** registers of the demo (templates); default: lost and found, custody */
  registerKeys?: string[]
  /** sample register entries; default: two lost items */
  samples?: SampleEntry[]
  /** sample entry of the lost-and-found register */
  lostSample: { item: string; place: string; finder: string }
  nationality: string
  /** ID numbers of the sample visitors: idBase + id * 7919 */
  idBase: number
  siteName: string
  postName: string
  /** [name, address]; the first one is the site of the reception demo */
  sites: [string, string][]
  /** post names of sites 1, 2 and 3 */
  devices: [string, string, string]
  /** 7 visits: 1-3 still inside (1 overstays, with a car), 4-7 left */
  visits: Visit[]
  /** visitors of sites 2 and 3: [name, company, host] */
  otherPeople: [string, string, string][]
  otherVehicle: { plate: string; driver: string; company: string; cargo: string }
  otherIncidentPlace: string
  notes: [string, string, string]
  van: { plate: string; driver: string; company: string }
  deliveries: [{ carrier: string; recipient: string; tracking: string }, { carrier: string; recipient: string }, { carrier: string; recipient: string; tracking: string; pickedUpBy: string }]
  incidentPlaces: [string, string]
  handover: string
  checkpoints: [string, string][]
  keys: [string, string, string, string]
  loans: [{ borrower: string; info: string }, { borrower: string; info: string }]
  watch: { name: string; idNumber: string; reason: string }
  expected: [{ name: string; company: string; host: string; purpose: string }, { name: string; company: string; host: string; purpose: string; notes: string }, { name: string; company: string; host: string; purpose: string }]
  owner: string
  hostUser: string
  /** what "Read card text" returns (front side of the returning visitor's card) */
  cardText: string[]
}

// University of Ghardaia: Algerian names, companies and plates (serial, type + year, wilaya 47)
const GHARDAIA: Flavor = {
  lostSample: { item: 'Portefeuille noir avec une carte d’étudiant', place: 'Amphi 3', finder: 'Rachid Bahaz' },
  users: [
    { name: 'Admin', role: 'admin', pin: '1234', language: 'fr' },
    { name: 'Sonia', role: 'guard', pin: '5678', language: 'ar' }
  ],
  nationality: 'DZA',
  idBase: 100000000,
  siteName: 'Université de Ghardaïa',
  postName: 'Entrée principale',
  sites: [['Université de Ghardaïa', 'Campus principal, Ghardaïa'], ['Résidence universitaire', 'Ghardaïa'], ['Annexe pédagogique', 'Ghardaïa']],
  devices: ['Entrée principale', 'Poste résidence', 'Accueil annexe'],
  visits: [
    { name: 'Yacine Bouameur', company: 'Sonelgaz', host: 'Laboratoire de chimie', purpose: 'Réunion', alt: 'ياسين بوعامر', plate: '04512 116 47' },
    { name: 'Amina Hadj Said', company: 'Mobilis', host: 'Service des achats', purpose: 'Réunion fournisseur' },
    { name: 'Rachid Bahaz', company: 'Algérie Télécom', host: 'Centre de calcul', purpose: 'Maintenance réseau' },
    { name: 'Mourad Kaci', company: 'Algérie Poste', host: 'Courrier', purpose: 'Livraison' },
    { name: 'Fatima Zohra Ouled Ali', company: '', host: 'Service de scolarité', purpose: 'Inscription' },
    { name: 'Brahim Babaousmail', company: 'Bureau d’études Babaousmail', host: 'Rectorat', purpose: 'Rendez-vous' },
    { name: 'Khadidja Benyoucef', company: '', host: 'Bibliothèque centrale', purpose: 'Visite' }
  ],
  otherPeople: [['Sofiane Belkacem', 'Djezzy', 'Administration'], ['Nawel Cherif', '', 'Hébergement'], ['Hamza Bensaci', 'Sonelgaz', 'Maintenance'],
    ['Meriem Aouf', '', 'Restauration'], ['Walid Bekkaye', 'Yalidine', 'Courrier'], ['Selma Hamidi', '', 'Scolarité'], ['Ilyes Zerrouki', '', 'Comptabilité']],
  otherVehicle: { plate: '10245 316 47', driver: 'Abdelkader', company: 'ONOU', cargo: 'Denrées alimentaires' },
  otherIncidentPlace: 'Pavillon B',
  notes: ['Ronde de 8h : parking et bloc pédagogique C vérifiés, RAS.', 'Éclairage du parking sud en panne, signalé au service technique.', 'Livraison de matériel informatique attendue cet après-midi.'],
  van: { plate: '07823 117 47', driver: 'Nabil', company: 'Yalidine' },
  deliveries: [{ carrier: 'Yalidine', recipient: 'Centre de calcul', tracking: 'YAL-55102' }, { carrier: 'EMS Algérie Poste', recipient: 'مصلحة المحاسبة' },
    { carrier: 'DHL', recipient: 'Rectorat', tracking: 'DHL-889', pickedUpBy: 'Mme Hamidi' }],
  incidentPlaces: ['Parking nord', 'Amphi 3'],
  handover: 'Yacine Bouameur (Sonelgaz) est encore au laboratoire de chimie depuis ce matin. 3 colis pour le centre de calcul en attente. Personne suspecte vue au parking nord : incident ouvert.',
  checkpoints: [['Bloc pédagogique A', 'Porte principale'], ['Parking nord', 'Barrière'], ['Laboratoires', '2e étage, couloir B'], ['Bibliothèque centrale', 'Issue de secours']],
  keys: ['Clé salle serveurs', 'Talkie-walkie 1', 'Badge visiteur VIP', 'Clé amphi 3'],
  loans: [{ borrower: 'Technicien Algérie Télécom', info: 'Rachid Bahaz' }, { borrower: 'Pr. Hadj Moussa', info: 'Département de physique' }],
  watch: { name: 'Karim Belaid', idNumber: '109876543', reason: 'Vol de matériel informatique en mars' },
  expected: [{ name: 'Karima Djellouli', company: 'Bureau d’audit', host: 'Rectorat', purpose: 'Audit' },
    { name: 'Slimane Haddad', company: 'Huawei Algérie', host: 'Centre de calcul', purpose: 'Installation', notes: 'Apporte du matériel' },
    { name: 'Dr. Samia Ferhat', company: 'Ministère de l’Enseignement supérieur', host: 'Rectorat', purpose: 'Visite officielle' }],
  owner: 'Mouna (Rectorat)',
  hostUser: 'Ahmed (Centre de calcul)',
  cardText: ['الجمهورية الجزائرية الديمقراطية الشعبية', 'CARTE NATIONALE D’IDENTITÉ', 'Nom : BENYOUCEF', 'Prénom : Khadidja', 'اللقب : بن يوسف', 'الاسم : خديجة', 'Né(e) le 14/06/1996 à Ghardaïa']
}

// Faculty of Law and Political Science: Arabic accounts and data, PIN-only login, their own registers
const GHARDAIA_LAW: Flavor = {
  ...GHARDAIA,
  users: [
    { name: 'مسؤول الأمن', role: 'admin', pin: '1234', language: 'ar' },
    { name: 'يوسف (رئيس الفرقة)', role: 'leader', pin: '2580', language: 'ar' },
    { name: 'محمد (عون أمن)', role: 'guard', pin: '5678', language: 'ar' },
    { name: 'عمر (رئيس الفرقة)', role: 'leader', pin: '1357', language: 'ar' }
  ],
  lostSample: { item: 'محفظة سوداء بها بطاقة طالب', place: 'المدرج 3', finder: 'أمينة حاج سعيد' },
  siteName: 'كلية الحقوق والعلوم السياسية',
  postName: 'مكتب الأمن الرئيسي',
  sites: [['كلية الحقوق والعلوم السياسية', 'جامعة غرداية'], ...GHARDAIA.sites.slice(1)],
  devices: ['مكتب الأمن الرئيسي', GHARDAIA.devices[1], GHARDAIA.devices[2]],
  visits: [
    { name: 'ياسين بوعامر', company: 'سونلغاز', host: 'مخبر القانون الخاص', purpose: 'اجتماع', alt: 'Yacine Bouameur', plate: '04512 116 47' },
    { name: 'أمينة حاج سعيد', company: 'موبيليس', host: 'مصلحة المالية والمحاسبة', purpose: 'اجتماع مع ممون' },
    { name: 'رشيد بحاز', company: 'اتصالات الجزائر', host: 'مركز الحساب', purpose: 'صيانة الشبكة' },
    { name: 'مراد قاسي', company: 'بريد الجزائر', host: 'الأمانة العامة للكلية', purpose: 'إيداع البريد' },
    { name: 'فاطمة الزهراء أولاد علي', company: '', host: 'مصلحة التدريس', purpose: 'تسجيل' },
    { name: 'إبراهيم باباوسماعيل', company: 'مكتب محاماة', host: 'عمادة الكلية', purpose: 'موعد' },
    { name: 'خديجة بن يوسف', company: '', host: 'المكتبة', purpose: 'زيارة' }
  ],
  handover: 'ياسين بوعامر (سونلغاز) ما يزال في مخبر القانون الخاص منذ الصباح. مراسلتان موجهتان للعمادة في الانتظار. شخص مشبوه قرب موقف السيارات الشمالي: مسجل في سجل الحوادث وينتظر تأشير العمادة.',
  watch: { name: 'كريم بلعيد', idNumber: GHARDAIA.watch.idNumber, reason: 'سرقة عتاد معلوماتي في شهر مارس' },
  registerKeys: ['shift', 'custody', 'incidents', 'lost_found', 'letters', 'events', 'reports', 'maintenance', 'official_visits', 'evacuation', 'alarms'],
  samples: [
    // yesterday's handover: Omar took over from Youssef
    { register: 'shift', hoursAgo: 13, by: 3, values: (h) => ({
      outgoing: h.user(1), registers_ok: { answer: 'yes', note: '' }, incidents_visa: 'yes',
      team_present: { answer: 'no', note: 'العون محمد التحق متأخرا بنصف ساعة' }, outgoing_pin: h.user(1)
    }) },
    { register: 'custody', hoursAgo: 13, by: 3, values: (h) => ({
      outgoing: h.user(1), keys: { answer: 'yes', note: '' }, cameras: { answer: 'no', note: 'الكاميرا رقم 3 (المدخل الخلفي) لا تعمل' },
      radios: { answer: 'yes', note: '' }, equipment: { answer: 'yes', note: '' }, rooms: { answer: 'yes', note: '' }, outgoing_pin: h.user(1)
    }) },
    { register: 'incidents', hoursAgo: 30, by: 2, closedHoursAgo: 27, closedBy: 0, values: (h) => ({
      occurred: h.at(30.5), description: 'عطل في قفل باب المدرج 2: الباب لا يغلق.', actions: 'غلق المدرج بالسلسلة وإبلاغ رئيس الفرقة',
      reported_service: 'مصلحة الوسائل العامة', reported_at: h.at(30), witnesses: 'محمد (عون أمن)', visa_note: 'اطلعنا. يُبلَّغ مكتب الصيانة.'
    }) },
    { register: 'incidents', hoursAgo: 3, by: 2, values: (h) => ({
      occurred: h.at(3.3), description: 'شخص غريب يتجول بين السيارات في الموقف الشمالي، غادر عند اقتراب العون.',
      persons: 'رجل يرتدي سترة سوداء', actions: 'تكثيف الدوريات حول الموقف وإبلاغ رئيس الفرقة',
      reported_service: 'الأمانة العامة للكلية', reported_at: h.at(3), witnesses: 'محمد (عون أمن)'
    }) },
    { register: 'lost_found', hoursAgo: 26, by: 2, closedHoursAgo: 4, closedBy: 1, values: (h) => ({
      item: 'محفظة سوداء بها بطاقة طالب', place: 'المدرج 3', found_on: h.day(-1), finder: 'أمينة حاج سعيد',
      action: 'وُضعت في خزانة مكتب الأمن', owner: { name: 'خديجة بن يوسف', idType: 'بطاقة التعريف البيومترية', idNumber: '100055433' }
    }) },
    { register: 'lost_found', hoursAgo: 2, by: 2, values: (h) => ({
      item: 'مفاتيح سيارة مع حامل أزرق', place: 'قاعة المطالعة', found_on: h.day(0), finder: 'رشيد بحاز', action: 'وُضعت في خزانة مكتب الأمن'
    }) },
    { register: 'letters', hoursAgo: 28, by: 2, closedHoursAgo: 25, closedBy: 3, values: () => ({
      sender: 'رئاسة الجامعة', addressee: 'العميد', count: '1', courier: 'سائق رئاسة الجامعة', received_by: 'أمانة العميد'
    }) },
    { register: 'letters', hoursAgo: 1.5, by: 2, values: () => ({
      sender: 'مديرية الخدمات الجامعية', addressee: 'عمادة الكلية', count: '2', courier: 'ساعي البريد'
    }) },
    { register: 'events', hoursAgo: 20, by: 3, values: (h) => ({
      activity: 'يوم دراسي حول القانون الإداري', event_date: h.day(0), organizer: 'قسم الحقوق', organizers: '12', attendance: '150',
      from: '09:00', audience: 'طلبة الماستر والأساتذة', measures: 'مراقبة مدخل المدرج الكبير وتنظيم موقف السيارات'
    }) }
  ]
}

export const F: Flavor = GHARDAIA_LAW

/** ID number of sample visit `id` */
export const sampleId = (id: number): string => String(F.idBase + id * 7919)
