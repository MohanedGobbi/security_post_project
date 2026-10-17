// Place-specific text of the demo data: one set per brand (src/renderer/src/brand.ts).
// store.ts builds the records (times, ids, statuses) and takes names, places and companies from here.

type Visit = { name: string; company: string; host: string; purpose: string; alt?: string; plate?: string }

export interface Flavor {
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

const TUNIS: Flavor = {
  nationality: 'TUN',
  idBase: 10000000,
  siteName: 'Université de Tunis — démo',
  postName: 'Entrée principale',
  sites: [['Université de Tunis — démo', 'Campus universitaire'], ['Usine Sfax', 'Route de Gabès'], ['Siège Tunis', 'Les Berges du Lac']],
  devices: ['Entrée principale', 'Portail usine', 'Accueil siège'],
  visits: [
    { name: 'Leila Mansour', company: 'ACME Tunisie', host: 'Labo de chimie', purpose: 'Réunion', alt: 'ليلى منصور', plate: '245 TU 1888' },
    { name: 'Youssef Hammami', company: 'Ooredoo', host: 'Service Achats', purpose: 'Réunion fournisseur' },
    { name: 'Nadia Karoui', company: 'Orange', host: 'Service IT', purpose: 'Maintenance réseau' },
    { name: 'Mehdi Bouazizi', company: 'Poste Tunisienne', host: 'Courrier', purpose: 'Livraison' },
    { name: 'Amel Sassi', company: '', host: 'Scolarité', purpose: 'Inscription' },
    { name: 'Fares Dridi', company: 'Cabinet Dridi', host: 'Direction', purpose: 'Rendez-vous' },
    { name: 'Olfa Ben Amor', company: '', host: 'Bibliothèque', purpose: 'Visite' }
  ],
  otherPeople: [['Amine Jaziri', 'Tunisie Telecom', 'Production'], ['Rania Ben Salem', 'Bureau Veritas', 'Qualité'], ['Hichem Trabelsi', 'STEG', 'Maintenance'],
    ['Ines Mabrouk', '', 'RH'], ['Walid Chaabane', 'DHL', 'Logistique'], ['Sarra Gharbi', 'Deloitte', 'Direction'], ['Nizar Ayari', '', 'Comptabilité']],
  otherVehicle: { plate: '182 TU 4471', driver: 'Lassaad', company: 'Transport Sahel', cargo: 'Matières premières' },
  otherIncidentPlace: 'Étage 3',
  notes: ['Ronde de 8h : parking et bâtiment C vérifiés, RAS.', 'Éclairage du parking sud en panne, signalé au service technique.', 'Livraison de matériel informatique attendue cet après-midi.'],
  van: { plate: '118 TU 5555', driver: 'Sami', company: 'Aramex' },
  deliveries: [{ carrier: 'Aramex', recipient: 'Service informatique', tracking: 'ARX-55102' }, { carrier: 'Rapid Poste', recipient: 'قسم المحاسبة' },
    { carrier: 'DHL', recipient: 'Direction', tracking: 'DHL-889', pickedUpBy: 'Mme Gharbi' }],
  incidentPlaces: ['Parking nord', 'Amphi B'],
  handover: 'Leila Mansour (ACME) est encore au labo de chimie depuis ce matin. 3 colis pour le service informatique en attente. Personne suspecte vue au parking nord : incident ouvert.',
  checkpoints: [['Bâtiment A', 'Porte principale'], ['Parking nord', 'Barrière'], ['Laboratoire', '2e étage, couloir B'], ['Bibliothèque', 'Issue de secours']],
  keys: ['Clé salle serveurs', 'Talkie-walkie 1', 'Badge visiteur VIP', 'Clé amphi B'],
  loans: [{ borrower: 'Technicien Orange', info: 'Nadia Karoui' }, { borrower: 'Pr. Ben Ali', info: 'Département physique' }],
  watch: { name: 'Karim Ben Youssef', idNumber: '09876543', reason: 'Vol de matériel informatique en mars' },
  expected: [{ name: 'Karima Jlassi', company: 'Ernst & Young', host: 'Direction', purpose: 'Audit' },
    { name: 'Slim Haddad', company: 'Huawei', host: 'Service IT', purpose: 'Installation', notes: 'Apporte du matériel' },
    { name: 'Dr. Samia Ferchichi', company: 'Ministère', host: 'Présidence', purpose: 'Visite officielle' }],
  owner: 'Mouna (Direction)',
  hostUser: 'Ahmed (IT)',
  cardText: ['CARTE NATIONALE D’IDENTITÉ', 'بطاقة التعريف الوطنية', 'Nom : BEN AMOR', 'Prénom : Olfa', 'الاسم : ألفة بن عمر', 'Né(e) le 14/06/1996 à Sousse']
}

// University of Ghardaia: Algerian names, companies and plates (serial, type + year, wilaya 47)
const GHARDAIA: Flavor = {
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

declare const __BRAND__: string
export const F: Flavor = __BRAND__ === 'ghardaia' ? GHARDAIA : TUNIS

/** ID number of sample visit `id` */
export const sampleId = (id: number): string => String(F.idBase + id * 7919)
