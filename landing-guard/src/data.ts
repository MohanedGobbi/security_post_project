// Register and security facts, shared word for word with landing/ (names and fields from src/shared/registerTemplates.ts)
import type { Lang } from './i18n'

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
