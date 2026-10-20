// Ready-made registers, taken from the paper books of the Faculty of Law and Political Science (University of Ghardaia).
// An administrator opens one as it is or changes it. More templates arrive with phase C (PLAN_FACULTY.md).
import type { RegisterDefInput } from './types'

export const REGISTER_TEMPLATES: RegisterDefInput[] = [
  {
    // سجل المفقودات المسلمة لمكتب الأمن
    key: 'lost_found',
    labels: { ar: 'سجل المفقودات', en: 'Lost and found', fr: 'Objets trouvés' },
    icon: 'search',
    fillRoles: ['guard', 'leader', 'admin'],
    // "items are handed back by the team leader in person"
    closeRoles: ['leader', 'admin'],
    closeLabels: { ar: 'تسليم الغرض لصاحبه', en: 'Returned to its owner', fr: 'Rendu à son propriétaire' },
    sort: 10,
    active: true,
    fields: [
      { key: 'item', labels: { ar: 'وصف الغرض الذي عثر عليه', en: 'Description of the item', fr: 'Description de l’objet' }, type: 'longtext', options: [], required: true, sensitive: false, step: 'open', active: true },
      { key: 'place', labels: { ar: 'مكان العثور عليه', en: 'Where it was found', fr: 'Lieu où il a été trouvé' }, type: 'text', options: [], required: true, sensitive: false, step: 'open', active: true },
      { key: 'found_on', labels: { ar: 'تاريخ العثور عليه', en: 'Date found', fr: 'Date de découverte' }, type: 'date', options: [], required: true, sensitive: false, step: 'open', active: true },
      { key: 'finder', labels: { ar: 'اسم ولقب الذي وجد الغرض', en: 'Name of the finder', fr: 'Nom de la personne qui l’a trouvé' }, type: 'text', options: [], required: true, sensitive: false, step: 'open', active: true },
      { key: 'action', labels: { ar: 'الإجراءات المتخذة', en: 'Action taken', fr: 'Mesures prises' }, type: 'longtext', options: [], required: false, sensitive: false, step: 'open', active: true },
      { key: 'owner', labels: { ar: 'المستلم (صاحب الغرض)', en: 'Owner who received it', fr: 'Propriétaire qui l’a reçu' }, type: 'person', options: [], required: true, sensitive: true, step: 'close', active: true },
      { key: 'owner_address', labels: { ar: 'العنوان', en: 'Address', fr: 'Adresse' }, type: 'text', options: [], required: false, sensitive: true, step: 'close', active: true }
    ]
  },
  {
    // سجل تسليم واستلام العهدة: filled by the incoming team leader at each shift change
    key: 'custody',
    labels: { ar: 'سجل تسليم واستلام العهدة', en: 'Custody handover', fr: 'Passation du matériel' },
    icon: 'clipboard',
    fillRoles: ['leader', 'admin'],
    closeRoles: [],
    closeLabels: null,
    sort: 20,
    active: true,
    fields: [
      { key: 'outgoing', labels: { ar: 'رئيس فرقة الأمن النازل', en: 'Outgoing team leader', fr: 'Chef d’équipe sortant' }, type: 'account', options: [], required: true, sensitive: false, step: 'open', active: true },
      { key: 'keys', labels: { ar: 'وجود المفاتيح الموضوعة في عهدة مكتب الأمن', en: 'All keys of the security office present', fr: 'Toutes les clés du poste présentes' }, type: 'yesno_note', options: [], required: true, sensitive: false, step: 'open', active: true },
      { key: 'cameras', labels: { ar: 'الكاميرات تشتغل', en: 'Cameras working', fr: 'Caméras en marche' }, type: 'yesno_note', options: [], required: true, sensitive: false, step: 'open', active: true },
      { key: 'equipment', labels: { ar: 'حالة العتاد في مكتب الأمن جيدة', en: 'Security office equipment in good order', fr: 'Matériel du poste en bon état' }, type: 'yesno_note', options: [], required: true, sensitive: false, step: 'open', active: true },
      { key: 'rooms', labels: { ar: 'حالة القاعات والمدرجات والمكاتب جيدة', en: 'Rooms, lecture halls and offices in good order', fr: 'Salles, amphis et bureaux en bon état' }, type: 'yesno_note', options: [], required: true, sensitive: false, step: 'open', active: true },
      { key: 'outgoing_pin', labels: { ar: 'تأكيد رئيس الفرقة النازل (الرقم السري)', en: 'Outgoing team leader confirms (PIN)', fr: 'Confirmation du chef sortant (code PIN)' }, type: 'signature', options: [], required: true, sensitive: false, step: 'open', active: true }
    ]
  }
]
