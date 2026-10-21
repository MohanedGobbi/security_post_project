// Ready-made registers, taken field by field from the paper books of the Faculty of Law and Political Science
// (University of Ghardaia, مكتب الأمن الداخلي للكلية) and from their list "سجلات مركز الأمن بالكلية".
// An administrator can switch each one on or off and, later, change it (register builder).
import type { Labels, RegisterDefInput, RegisterField, RegisterFieldType, Role } from './types'

type Opts = { required?: boolean; sensitive?: boolean; close?: boolean; options?: string[] }
const field = (key: string, type: RegisterFieldType, [ar, en, fr]: [string, string, string], o: Opts = {}): RegisterField => ({
  key, type, labels: { ar, en, fr }, options: o.options ?? [], required: !!o.required, sensitive: !!o.sensitive,
  step: o.close ? 'close' : 'open', active: true
})
const L = (ar: string, en: string, fr: string): Labels => ({ ar, en, fr })
const ALL: Role[] = ['guard', 'leader', 'admin']
const LEADERS: Role[] = ['leader', 'admin']

export const REGISTER_TEMPLATES: RegisterDefInput[] = [
  {
    // سجل المناوبة: the register the incoming team leader fills at the start of every shift
    key: 'shift',
    labels: L('سجل المناوبة', 'Shift register', 'Registre de permanence'),
    icon: 'users', fillRoles: LEADERS, closeRoles: [], closeLabels: null, sort: 1, active: true,
    fields: [
      field('outgoing', 'account', ['رئيس فرقة الأمن النازل', 'Outgoing team leader', 'Chef d’équipe sortant'], { required: true }),
      field('team_complete', 'yesno', ['التحاق جميع أفراد فرقة العمل الصاعدة بمقر عملهم', 'All members of the incoming team present', 'Toute l’équipe entrante présente'], { required: true }),
      field('absent_names', 'longtext', ['أسماء المتغيبين أو المتأخرين (إن وجدوا)', 'Names of those absent or late (if any)', 'Noms des absents ou retardataires (le cas échéant)'])
    ]
  },
  {
    // سجل تسليم واستلام العهدة: same moment, same two team leaders
    key: 'custody',
    labels: L('سجل تسليم واستلام العهدة', 'Custody handover', 'Passation du matériel'),
    icon: 'clipboard', fillRoles: LEADERS, closeRoles: [], closeLabels: null, sort: 2, active: true,
    fields: [
      field('outgoing', 'account', ['رئيس فرقة الأمن النازل', 'Outgoing team leader', 'Chef d’équipe sortant'], { required: true }),
      field('keys', 'yesno_note', ['وجود المفاتيح الموضوعة في عهدة مكتب الأمن', 'All keys of the security office present', 'Toutes les clés du poste présentes'], { required: true }),
      field('cameras', 'yesno_note', ['الكاميرات تشتغل', 'Cameras working', 'Caméras en marche'], { required: true }),
      field('radios', 'yesno_note', ['أجهزة الاتصال وأجهزة التفتيش سليمة', 'Radios and inspection devices in order', 'Radios et détecteurs en état'], { required: true }),
      field('equipment', 'yesno_note', ['حالة العتاد في مكتب الأمن جيدة', 'Security office equipment in good order', 'Matériel du poste en bon état'], { required: true }),
      field('rooms', 'yesno_note', ['حالة القاعات والمدرجات والمكاتب جيدة', 'Rooms, lecture halls and offices in good order', 'Salles, amphis et bureaux en bon état'], { required: true })
    ]
  },
  {
    // سجل الحوادث بالكلية ومحيطها: presented to the deanship for its visa at the end of each shift
    key: 'incidents',
    labels: L('سجل الحوادث', 'Incidents register', 'Registre des incidents'),
    icon: 'alert', fillRoles: ALL, closeRoles: ['admin'],
    closeLabels: L('تأشير عمادة الكلية', 'Deanship visa', 'Visa du décanat'), sort: 3, active: true,
    fields: [
      field('occurred', 'datetime', ['تاريخ ووقت الحادث', 'Date and time of the incident', 'Date et heure de l’incident'], { required: true }),
      field('description', 'longtext', ['وصف دقيق مختصر للحادث', 'Short, precise description', 'Description courte et précise'], { required: true }),
      field('persons', 'longtext', ['الأشخاص المعنيون أو المتسببون في الحادث عند الاقتضاء', 'People involved or responsible, if any', 'Personnes concernées ou responsables, le cas échéant']),
      field('actions', 'longtext', ['الإجراءات المتخذة', 'Action taken', 'Mesures prises'], { required: true }),
      field('reported_service', 'text', ['المصلحة المبلغة', 'Faculty service notified', 'Service de la faculté informé']),
      field('reported_at', 'datetime', ['تاريخ ووقت التبليغ لمصالح الكلية', 'Date and time it was reported', 'Date et heure du signalement']),
      field('witnesses', 'text', ['اسم العون أو الأعوان الذين عاينوا الحادث', 'Agent(s) who witnessed it', 'Agent(s) témoin(s)']),
      field('visa_note', 'longtext', ['ملاحظات العمادة', 'Deanship remarks', 'Observations du décanat'], { close: true })
    ]
  },
  {
    // سجل خاص بالزوار: the visitor module keeps its own screens (card scanning, people on site, exit)
    // سجل المفقودات المسلمة لمكتب الأمن
    key: 'lost_found',
    labels: L('سجل المفقودات', 'Lost and found', 'Objets trouvés'),
    icon: 'search', fillRoles: ALL,
    // "items are handed back by the team leader in person"
    closeRoles: LEADERS,
    closeLabels: L('تسليم الغرض لصاحبه', 'Returned to its owner', 'Rendu à son propriétaire'), sort: 4, active: true,
    fields: [
      field('item', 'longtext', ['وصف الغرض الذي عثر عليه', 'Description of the item', 'Description de l’objet'], { required: true }),
      field('place', 'text', ['مكان العثور عليه', 'Where it was found', 'Lieu où il a été trouvé'], { required: true }),
      field('found_on', 'date', ['تاريخ العثور عليه', 'Date found', 'Date de découverte'], { required: true }),
      field('finder', 'text', ['اسم ولقب الذي وجد الغرض', 'Name of the finder', 'Nom de la personne qui l’a trouvé'], { required: true }),
      field('action', 'longtext', ['الإجراءات المتخذة', 'Action taken', 'Mesures prises']),
      field('owner', 'person', ['المستلم (صاحب الغرض)', 'Owner who received it', 'Propriétaire qui l’a reçu'], { required: true, sensitive: true, close: true }),
      field('owner_id_issue', 'text', ['تاريخ صدور الهوية والجهة المصدرة', 'ID issue date and authority', 'Date et autorité de délivrance de la pièce'], { sensitive: true, close: true }),
      field('owner_address', 'text', ['العنوان', 'Address', 'Adresse'], { sensitive: true, close: true })
    ]
  },
  {
    // parcels: the faculty only receives letters addressed to one of its bodies, mostly the deanship
    key: 'letters',
    labels: L('سجل المراسلات', 'Letters register', 'Registre du courrier'),
    icon: 'mail', fillRoles: ALL, closeRoles: ALL,
    closeLabels: L('تسليم المراسلة', 'Handed over', 'Remis au destinataire'), sort: 5, active: true,
    fields: [
      field('sender', 'text', ['الجهة المرسلة', 'Sender', 'Expéditeur'], { required: true }),
      field('addressee', 'select', ['الجهة المرسل إليها', 'Addressed to', 'Destinataire'], {
        required: true,
        options: ['عمادة الكلية', 'العميد', 'نيابة العمادة المكلفة بالدراسات', 'نيابة العمادة المكلفة بما بعد التدرج والبحث العلمي', 'الأمانة العامة للكلية', 'رؤساء الأقسام', 'أخرى']
      }),
      field('count', 'number', ['عدد المراسلات', 'Number of letters', 'Nombre de plis']),
      field('courier', 'text', ['اسم حامل المراسلة', 'Brought by', 'Apporté par']),
      field('received_by', 'text', ['اسم ولقب المستلم', 'Received by', 'Reçu par'], { required: true, close: true })
    ]
  },
  {
    // سجل الفعاليات والنشاطات
    key: 'events',
    labels: L('سجل الفعاليات والنشاطات', 'Events and activities', 'Événements et activités'),
    icon: 'flag', fillRoles: ALL, closeRoles: ALL,
    closeLabels: L('انتهاء النشاط', 'Event ended', 'Fin de l’activité'), sort: 6, active: true,
    fields: [
      field('activity', 'longtext', ['النشاط المنظم', 'Activity', 'Activité'], { required: true }),
      field('event_date', 'date', ['تاريخ النشاط', 'Date', 'Date'], { required: true }),
      field('organizer', 'text', ['الجهة المنظمة', 'Organiser', 'Organisateur'], { required: true }),
      field('organizers', 'number', ['عدد المنظمين', 'Number of organisers', 'Nombre d’organisateurs']),
      field('attendance', 'number', ['عدد الحضور المتوقع', 'Expected attendance', 'Participants attendus']),
      field('from', 'time', ['توقيت النشاط: من', 'From', 'De'], { required: true }),
      field('audience', 'text', ['الفئة المستهدفة', 'Audience', 'Public visé']),
      field('measures', 'longtext', ['إجراءات التأمين الخاصة', 'Special security measures', 'Mesures de sécurité particulières']),
      field('to', 'time', ['إلى', 'To', 'À'], { close: true }),
      field('incidents', 'longtext', ['الحوادث المسجلة عند الاقتضاء', 'Incidents recorded, if any', 'Incidents relevés, le cas échéant'], { close: true })
    ]
  },
  // ---- suggested in "سجلات مركز الأمن بالكلية": switched off until the administrator turns them on ----
  {
    key: 'reports',
    labels: L('سجل البلاغات', 'Reports received', 'Signalements reçus'),
    icon: 'megaphone', fillRoles: ALL, closeRoles: [], closeLabels: null, sort: 7, active: false,
    fields: [
      field('type', 'select', ['نوع البلاغ', 'Type of report', 'Type de signalement'], {
        required: true, options: ['شكوى', 'شخص مشبوه', 'عطب', 'حادث', 'أخرى']
      }),
      field('reporter', 'text', ['الجهة المبلِّغة', 'Reported by', 'Signalé par'], { required: true }),
      field('received', 'datetime', ['وقت الاستلام', 'Time received', 'Heure de réception'], { required: true }),
      field('action', 'longtext', ['الإجراء المتخذ', 'Action taken', 'Mesure prise'])
    ]
  },
  {
    key: 'maintenance',
    labels: L('سجل الصيانة والملاحظات', 'Maintenance and remarks', 'Maintenance et observations'),
    icon: 'tool', fillRoles: ALL, closeRoles: LEADERS,
    closeLabels: L('تم الإصلاح', 'Repaired', 'Réparé'), sort: 8, active: false,
    fields: [
      field('equipment', 'select', ['التجهيز المعني', 'Equipment', 'Équipement'], {
        required: true, options: ['البوابات', 'الكاميرات', 'أجهزة التفتيش', 'الإنارة', 'أخرى']
      }),
      field('fault', 'longtext', ['وصف العطب أو الملاحظة', 'Fault or remark', 'Panne ou observation'], { required: true }),
      field('reported_on', 'date', ['تاريخ الإبلاغ', 'Date reported', 'Date du signalement'], { required: true }),
      field('reported_to', 'text', ['الجهة المبلَّغة', 'Reported to', 'Signalé à']),
      field('followup', 'longtext', ['المتابعة', 'Follow-up', 'Suivi'], { close: true })
    ]
  },
  {
    key: 'official_visits',
    labels: L('سجل الشخصيات الرسمية والزيارات البروتوكولية', 'Official visits', 'Visites officielles'),
    icon: 'star', fillRoles: ALL, closeRoles: [], closeLabels: null, sort: 9, active: false,
    fields: [
      field('name', 'text', ['اسم الشخصية', 'Name', 'Nom'], { required: true }),
      field('title', 'text', ['الصفة الرسمية', 'Official title', 'Qualité officielle'], { required: true }),
      field('visit_date', 'date', ['تاريخ الزيارة', 'Date of the visit', 'Date de la visite'], { required: true }),
      field('arrangements', 'longtext', ['ترتيبات التأمين الخاصة', 'Special security arrangements', 'Dispositions de sécurité particulières'])
    ]
  },
  {
    key: 'evacuation',
    labels: L('سجل خطط الإخلاء والطوارئ', 'Evacuation drills', 'Exercices d’évacuation'),
    icon: 'door', fillRoles: LEADERS, closeRoles: [], closeLabels: null, sort: 10, active: false,
    fields: [
      field('drill_date', 'date', ['تاريخ التدريب', 'Date of the drill', 'Date de l’exercice'], { required: true }),
      field('participants', 'longtext', ['المشاركون', 'Participants', 'Participants'], { required: true }),
      field('evaluation', 'longtext', ['ملاحظات التقييم', 'Evaluation notes', 'Bilan'])
    ]
  },
  {
    key: 'alarms',
    labels: L('سجل إنذارات الحريق والطوارئ', 'Fire and emergency alarms', 'Alarmes incendie et urgences'),
    icon: 'bell', fillRoles: ALL, closeRoles: [], closeLabels: null, sort: 11, active: false,
    fields: [
      field('alarm_time', 'datetime', ['وقت الإنذار', 'Time of the alarm', 'Heure de l’alarme'], { required: true }),
      field('cause', 'text', ['سبب الإنذار', 'Cause', 'Cause'], { required: true }),
      field('action', 'longtext', ['الإجراء المتخذ', 'Action taken', 'Mesure prise'])
    ]
  }
]

/** The templates with these keys, in the given order */
export const templatesFor = (keys: readonly string[]): RegisterDefInput[] =>
  keys.map((k) => REGISTER_TEMPLATES.find((t) => t.key === k)).filter((t): t is RegisterDefInput => !!t)
