// Schéma PostgreSQL (Drizzle). Règles d'intégrité côté base : quantités et montants positifs.
import { sql } from 'drizzle-orm';
import { boolean, check, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const now = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const entreprises = pgTable('entreprises', {
  id: uuid('id').primaryKey().defaultRandom(),
  nom: text('nom').notNull(),
  // Cycle de vie du partenariat (cahier §8.4) : prospect, negociation, actif, suspendu, cloture. Voir modules/entreprises/cycle.ts.
  statutPartenariat: text('statut_partenariat').notNull().default('prospect'),
  // Identité et responsable (cahier V3.0 §8.2).
  nomOfficiel: text('nom_officiel'),
  responsableNom: text('responsable_nom'),
  responsableRole: text('responsable_role'),
  responsableTelephone: text('responsable_telephone'),
  telephone: text('telephone'),
  email: text('email'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  createdAt: now(),
});

export const etablissements = pgTable('etablissements', {
  id: uuid('id').primaryKey().defaultRandom(),
  entrepriseId: uuid('entreprise_id').notNull().references(() => entreprises.id),
  nom: text('nom').notNull(),
  adresse: text('adresse'),
  createdAt: now(),
});

export const users = pgTable(
  'users',
  {
    conditionsVersion: text('conditions_version'),
    conditionsAccepteesLe: timestamp('conditions_acceptees_le', { withTimezone: true }),
    id: uuid('id').primaryKey().defaultRandom(),
    telephone: text('telephone').notNull().unique(),
    motDePasseHash: text('mot_de_passe_hash'),
    role: text('role').notNull().default('client'),
    entrepriseId: uuid('entreprise_id').references(() => entreprises.id),
    nomAffiche: text('nom_affiche'),
    langue: text('langue').notNull().default('fr'),
    // Réglage de messagerie (cahier V3.0 §17.1) : alerte à chaque message reçu de NZE.
    notifMessagesActives: boolean('notif_messages_actives').notNull().default(true),
    createdAt: now(),
  },
  (t) => [check('users_role_chk', sql`${t.role} in ('client','admin_principal','admin_secondaire','partenaire','livreur')`)],
);

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    telephone: text('telephone').notNull(),
    codeHash: text('code_hash').notNull(),
    tentatives: integer('tentatives').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ip: text('ip'),
    createdAt: now(),
  },
  (t) => [index('otp_telephone_idx').on(t.telephone), index('otp_ip_idx').on(t.ip, t.createdAt)],
);

export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: now(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  nom: text('nom').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: now(),
});

export const produits = pgTable(
  'produits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entrepriseId: uuid('entreprise_id').notNull().references(() => entreprises.id),
    etablissementId: uuid('etablissement_id').references(() => etablissements.id),
    categorieId: uuid('categorie_id').references(() => categories.id),
    nom: text('nom').notNull(),
    description: text('description'),
    prixFcfa: integer('prix_fcfa').notNull(),
    statut: text('statut').notNull().default('PUBLIE'),
    garantieJours: integer('garantie_jours'),
    echelonnable: boolean('echelonnable').notNull().default(false),
    dureeMois: integer('duree_mois'),
    avancePourcent: integer('avance_pourcent'),
    caracteristiques: jsonb('caracteristiques').$type<{ nom: string; valeur: string }[]>().notNull().default([]),
    photos: jsonb('photos').$type<string[]>().notNull().default([]),
    commentaires: text('commentaires'),
    createdAt: now(),
  },
  (t) => [
    check('produits_prix_chk', sql`${t.prixFcfa} > 0`),
    check('produits_statut_chk', sql`${t.statut} in ('BROUILLON','PUBLIE','SUSPENDU')`),
  ],
);

export const stockNiveaux = pgTable(
  'stock_niveaux',
  {
    produitId: uuid('produit_id').primaryKey().references(() => produits.id),
    disponible: integer('disponible').notNull().default(0),
    reserve: integer('reserve').notNull().default(0),
    // États du stock (cahier V3.0 §10.2) : DISPONIBLE, COLLECTE, INDISPONIBLE, A_CONFIRMER.
    etat: text('etat').notNull().default('DISPONIBLE'),
    misAJour: timestamp('mis_a_jour', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('stock_disponible_chk', sql`${t.disponible} >= 0`),
    check('stock_reserve_chk', sql`${t.reserve} >= 0`),
    check('stock_reserve_sous_disponible_chk', sql`${t.reserve} <= ${t.disponible}`),
  ],
);

export const mouvementsStock = pgTable('mouvements_stock', {
  id: uuid('id').primaryKey().defaultRandom(),
  produitId: uuid('produit_id').notNull().references(() => produits.id),
  type: text('type').notNull(),
  deltaDisponible: integer('delta_disponible').notNull().default(0),
  deltaReserve: integer('delta_reserve').notNull().default(0),
  disponibleApres: integer('disponible_apres').notNull(),
  reserveApres: integer('reserve_apres').notNull(),
  commandeId: uuid('commande_id'),
  acteurId: uuid('acteur_id').references(() => users.id),
  motif: text('motif'),
  bordereauId: uuid('bordereau_id').references(() => bordereaux.id),
  createdAt: now(),
});

export const signalementsStock = pgTable(
  'signalements_stock',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    produitId: uuid('produit_id').notNull().references(() => produits.id),
    entrepriseId: uuid('entreprise_id').notNull().references(() => entreprises.id),
    acteurId: uuid('acteur_id').notNull().references(() => users.id),
    genre: text('genre').notNull(),
    quantite: integer('quantite').notNull().default(0),
    statut: text('statut').notNull().default('EN_ATTENTE'),
    decidePar: uuid('decide_par').references(() => users.id),
    decideLe: timestamp('decide_le', { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [check('signalement_genre_chk', sql`${t.genre} in ('VENTE','RUPTURE','RETOUR','VARIATION')`)],
);

export const commissionsRegles = pgTable(
  'commissions_regles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entrepriseId: uuid('entreprise_id').notNull().references(() => entreprises.id),
    tauxBps: integer('taux_bps').notNull(),
    effetDebut: timestamp('effet_debut', { withTimezone: true }).notNull(),
    // Accord commercial versionné (cahier V3.0 §8.4) : fin de validité, durée, conditions, document.
    dateFin: timestamp('date_fin', { withTimezone: true }),
    dureeMois: integer('duree_mois'),
    conditions: text('conditions'),
    documentUrl: text('document_url'),
    createdAt: now(),
  },
  (t) => [check('commission_taux_chk', sql`${t.tauxBps} >= 0 and ${t.tauxBps} <= 10000`)],
);

export const pointsFixes = pgTable('points_fixes', {
  id: uuid('id').primaryKey().defaultRandom(),
  libelle: text('libelle').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  effetDebut: timestamp('effet_debut', { withTimezone: true }).notNull(),
  createdAt: now(),
});

export const tarifsLivraison = pgTable(
  'tarifs_livraison',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fcfaParKm: integer('fcfa_par_km').notNull(),
    minimumFcfa: integer('minimum_fcfa').notNull().default(0),
    effetDebut: timestamp('effet_debut', { withTimezone: true }).notNull(),
    createdAt: now(),
  },
  (t) => [check('tarif_km_chk', sql`${t.fcfaParKm} >= 0`)],
);

export const commandes = pgTable(
  'commandes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull().unique(),
    userId: uuid('user_id').notNull().references(() => users.id),
    statut: text('statut').notNull().default('PANIER'),
    reception: text('reception').notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    pointFixeId: uuid('point_fixe_id').references(() => pointsFixes.id),
    tarifId: uuid('tarif_id').references(() => tarifsLivraison.id),
    distanceM: integer('distance_m'),
    fournisseurDistance: text('fournisseur_distance'),
    distanceCalculeeLe: timestamp('distance_calculee_le', { withTimezone: true }),
    fraisLivraisonFcfa: integer('frais_livraison_fcfa').notNull().default(0),
    sousTotalFcfa: integer('sous_total_fcfa').notNull(),
    totalFcfa: integer('total_fcfa').notNull(),
    payeLe: timestamp('paye_le', { withTimezone: true }),
    choixSurPlace: boolean('choix_sur_place').notNull().default(false),
    // Réservation du stock (migration 0020) : AUCUN, RESERVE, VENDU, LIBERE.
    stockStatut: text('stock_statut').notNull().default('AUCUN'),
    // Étape de préparation saisie par l'administration : EN_PREPARATION puis PRETE (absente = confirmée).
    etapePreparation: text('etape_preparation'),
    origineLatitude: doublePrecision('origine_latitude'),
    origineLongitude: doublePrecision('origine_longitude'),
    createdAt: now(),
  },
  (t) => [
    check('commande_statut_chk', sql`${t.statut} in ('PANIER','EN_ATTENTE_PAIEMENT','PAYEE','ECHEC','ANNULEE')`),
    check('commande_reception_chk', sql`${t.reception} in ('LIVRAISON','RETRAIT')`),
    check('commande_total_chk', sql`${t.totalFcfa} >= 0`),
    check('commande_stock_statut_chk', sql`${t.stockStatut} in ('AUCUN','RESERVE','VENDU','LIBERE')`),
    check('commande_etape_preparation_chk', sql`${t.etapePreparation} is null or ${t.etapePreparation} in ('EN_PREPARATION','PRETE')`),
  ],
);

export const lignesCommande = pgTable(
  'lignes_commande',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commandeId: uuid('commande_id').notNull().references(() => commandes.id),
    produitId: uuid('produit_id').notNull().references(() => produits.id),
    entrepriseId: uuid('entreprise_id').notNull().references(() => entreprises.id),
    quantite: integer('quantite').notNull(),
    prixUnitaireFcfa: integer('prix_unitaire_fcfa').notNull(),
    montantLigneFcfa: integer('montant_ligne_fcfa').notNull(),
    tauxCommissionBps: integer('taux_commission_bps').notNull(),
    commissionFcfa: integer('commission_fcfa').notNull(),
    garantieJours: integer('garantie_jours'),
  },
  (t) => [check('ligne_quantite_chk', sql`${t.quantite} > 0`)],
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commandeId: uuid('commande_id').notNull().references(() => commandes.id),
    fournisseur: text('fournisseur').notNull().default('MYPVIT'),
    canal: text('canal').notNull(),
    operateur: text('operateur'),
    referenceMarchand: text('reference_marchand').notNull().unique(),
    referenceFournisseur: text('reference_fournisseur'),
    versementId: uuid('versement_id').references(() => versementsEcheloneces.id),
    montantFcfa: integer('montant_fcfa').notNull(),
    statut: text('statut').notNull().default('PENDING'),
    urlPaiement: text('url_paiement'),
    dernierControle: timestamp('dernier_controle', { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [
    check('transaction_statut_chk', sql`${t.statut} in ('PENDING','SUCCESS','FAILED','UNCERTAIN')`),
    check('transaction_canal_chk', sql`${t.canal} in ('MOBILE_MONEY','CARTE')`),
  ],
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    produitId: uuid('produit_id').references(() => produits.id),
    // Suppression par le client : masquée pour lui ; si la conversation est liée à une réclamation, elle reste archivée pour les administrateurs.
    masqueePourClientLe: timestamp('masquee_pour_client_le', { withTimezone: true }),
    archiveeLe: timestamp('archivee_le', { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [uniqueIndex('conversations_user_produit_idx').on(t.userId, t.produitId).where(sql`${t.masqueePourClientLe} is null`)],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id),
    expediteurId: uuid('expediteur_id').notNull().references(() => users.id),
    genre: text('genre').notNull(),
    corps: text('corps'),
    fichierCle: text('fichier_cle'),
    dureeSec: integer('duree_sec'),
    createdAt: now(),
  },
  (t) => [check('message_genre_chk', sql`${t.genre} in ('TEXTE','PHOTO','VIDEO','VOCAL')`)],
);

// Répartition de chaque encaissement : part du commerçant, commission NZE, frais de livraison NZE.
// Le solde du commerçant est un montant dû par NZE : les versements seront un module séparé.
export const ecritures = pgTable(
  'ecritures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commandeId: uuid('commande_id').notNull().references(() => commandes.id),
    ligneId: uuid('ligne_id').references(() => lignesCommande.id),
    entrepriseId: uuid('entreprise_id').references(() => entreprises.id),
    categorie: text('categorie').notNull(),
    // Trois registres séparés (cahier V3.0 §15.1) : CLIENT, COMMISSIONS, PARTENAIRE.
    registre: text('registre').notNull().default('PARTENAIRE'),
    montantFcfa: integer('montant_fcfa').notNull(),
    createdAt: now(),
  },
  (t) => [
    check('ecriture_categorie_chk', sql`${t.categorie} in ('VENTE_NET','COMMISSION','FRAIS_LIVRAISON','ENCAISSEMENT')`),
    check('ecriture_registre_chk', sql`${t.registre} in ('CLIENT','COMMISSIONS','PARTENAIRE')`),
    check('ecriture_montant_chk', sql`${t.montantFcfa} >= 0`),
    index('ecritures_entreprise_idx').on(t.entrepriseId),
  ],
);

// Demandes de retrait du commerçant. Le solde est diminué à l'acceptation ; les demandes en attente sont bloquées.
export const demandesRetrait = pgTable(
  'demandes_retrait',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entrepriseId: uuid('entreprise_id').notNull().references(() => entreprises.id),
    demandeurId: uuid('demandeur_id').notNull().references(() => users.id),
    montantFcfa: integer('montant_fcfa').notNull(),
    operateur: text('operateur').notNull(),
    numero: text('numero'),
    nomBeneficiaire: text('nom_beneficiaire').notNull(),
    statut: text('statut').notNull().default('EN_ATTENTE'),
    referenceMarchand: text('reference_marchand').unique(),
    referenceFournisseur: text('reference_fournisseur'),
    decidePar: uuid('decide_par').references(() => users.id),
    decideLe: timestamp('decide_le', { withTimezone: true }),
    dernierControle: timestamp('dernier_controle', { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [
    check('retrait_montant_chk', sql`${t.montantFcfa} > 0`),
    check('retrait_operateur_chk', sql`${t.operateur} in ('AIRTEL_MONEY','MOOV_MONEY','CARTE')`),
    check('retrait_numero_chk', sql`${t.operateur} = 'CARTE' or ${t.numero} is not null`),
    check('retrait_statut_chk', sql`${t.statut} in ('EN_ATTENTE','REJETEE','VERSEMENT_EN_COURS','VERSEE','ECHEC')`),
  ],
);

// Journal d'audit (révision 8) : connexions, changements de droits, actions financières et de stock.
// Aucun secret, mot de passe, code ou jeton n'est jamais écrit ici (voir modules/audit/service.ts).
export const journalAudit = pgTable(
  'journal_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    acteurId: uuid('acteur_id').references(() => users.id),
    action: text('action').notNull(),
    cibleType: text('cible_type').notNull(),
    cibleId: text('cible_id'),
    details: jsonb('details'),
    createdAt: now(),
  },
  (t) => [index('journal_audit_created_idx').on(t.createdAt), index('journal_audit_action_idx').on(t.action)],
);

// Bordereau numérique de collecte (révision 8, cahier §12). Chaque collecte en produit un.
// La référence affichée (BDR-AAAA-NNNNNN) est dérivée de numero, généré par la base : elle est unique.
export const bordereaux = pgTable(
  'bordereaux',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    numero: integer('numero').generatedAlwaysAsIdentity().notNull(),
    entrepriseId: uuid('entreprise_id').notNull().references(() => entreprises.id),
    etablissementId: uuid('etablissement_id').references(() => etablissements.id),
    collecteurId: uuid('collecteur_id').notNull().references(() => users.id),
    statut: text('statut').notNull(),
    commentaire: text('commentaire'),
    partenaireConfirmePar: uuid('partenaire_confirme_par').references(() => users.id),
    partenaireConfirmeLe: timestamp('partenaire_confirme_le', { withTimezone: true }),
    contestePar: uuid('conteste_par').references(() => users.id),
    contesteLe: timestamp('conteste_le', { withTimezone: true }),
    motifContestation: text('motif_contestation'),
    validePar: uuid('valide_par').references(() => users.id),
    valideLe: timestamp('valide_le', { withTimezone: true }),
    motifRefus: text('motif_refus'),
    createdAt: now(),
  },
  (t) => [
    check('bordereaux_statut_chk', sql`${t.statut} in ('ATTENTE_PARTENAIRE','ATTENTE_VALIDATION_NZE','CONTESTE','VALIDE','REFUSE','ANNULE')`),
    index('bordereaux_entreprise_idx').on(t.entrepriseId),
    index('bordereaux_collecteur_idx').on(t.collecteurId),
  ],
);

// Ligne d'article d'un bordereau. bloqueLivraison : une anomalie de qualité bloque l'article jusqu'à une décision de NZE.
export const lignesBordereau = pgTable(
  'lignes_bordereau',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bordereauId: uuid('bordereau_id').notNull().references(() => bordereaux.id),
    produitId: uuid('produit_id').notNull().references(() => produits.id),
    ligneCommandeId: uuid('ligne_commande_id').references(() => lignesCommande.id),
    nomArticle: text('nom_article').notNull(),
    quantite: integer('quantite').notNull(),
    etat: text('etat').notNull(),
    accessoires: text('accessoires'),
    testEffectue: boolean('test_effectue').notNull().default(false),
    resultatTest: text('resultat_test'),
    controle: text('controle').notNull(),
    commentaire: text('commentaire'),
    bloqueLivraison: boolean('bloque_livraison').notNull().default(false),
    motifLevee: text('motif_levee'),
    createdAt: now(),
  },
  (t) => [
    check('lignes_bordereau_quantite_chk', sql`${t.quantite} > 0`),
    check('lignes_bordereau_controle_chk', sql`${t.controle} in ('CONFORME','ANOMALIE')`),
    index('lignes_bordereau_bordereau_idx').on(t.bordereauId),
    index('lignes_bordereau_produit_idx').on(t.produitId),
  ],
);

// Livraison à domicile (révision 9, cahier §13). NZE confie une commande payée à un livreur.
// Preuve de remise : signature papier confirmée par le livreur.
export const echeanciersArticles = pgTable(
  'echeanciers_articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id').notNull().references(() => plansEcheloneces.id),
    ligneId: uuid('ligne_id').notNull().references(() => lignesCommande.id),
    produitId: uuid('produit_id').notNull().references(() => produits.id),
    prixFcfa: integer('prix_fcfa').notNull(),
    avancePourcent: integer('avance_pourcent').notNull(),
    avanceFcfa: integer('avance_fcfa').notNull(),
    resteFcfa: integer('reste_fcfa').notNull(),
    dureeMois: integer('duree_mois').notNull(),
    mensualiteFcfa: integer('mensualite_fcfa').notNull(),
    dernierMoisFcfa: integer('dernier_mois_fcfa').notNull(),
    createdAt: now(),
  },
  (t) => [
    check('echeancier_duree_chk', sql`${t.dureeMois} between 1 and 12`),
    check('echeancier_avance_chk', sql`${t.avancePourcent} between 10 and 90`),
    check('echeancier_somme_chk', sql`${t.avanceFcfa} + ${t.resteFcfa} = ${t.prixFcfa}`),
    check('echeancier_mois_chk', sql`(${t.dureeMois} - 1) * ${t.mensualiteFcfa} + ${t.dernierMoisFcfa} = ${t.resteFcfa}`),
  ],
);

export const livraisons = pgTable(
  'livraisons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    numero: integer('numero').generatedAlwaysAsIdentity().notNull(),
    commandeId: uuid('commande_id').notNull().references(() => commandes.id),
    livreurId: uuid('livreur_id').notNull().references(() => users.id),
    assigneePar: uuid('assignee_par').notNull().references(() => users.id),
    motif: text('motif').notNull(),
    statut: text('statut').notNull(),
    signaturePapierRecue: boolean('signature_papier_recue').notNull().default(false),
    motifEchec: text('motif_echec'),
    commentaire: text('commentaire'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    livreurLatitude: doublePrecision('livreur_latitude'),
    livreurLongitude: doublePrecision('livreur_longitude'),
    livreurPositionLe: timestamp('livreur_position_le', { withTimezone: true }),
    arriveLe: timestamp('arrive_le', { withTimezone: true }),
    demarreeLe: timestamp('demarree_le', { withTimezone: true }),
    clotureeLe: timestamp('cloturee_le', { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [
    check('livraisons_motif_chk', sql`${t.motif} in ('LIVRAISON_COMMANDE','NOUVELLE_TENTATIVE','SECONDE_LIVRAISON')`),
    check('livraisons_statut_chk', sql`${t.statut} in ('ASSIGNEE','EN_ROUTE','ARRIVE','LIVREE','PARTIELLE','ECHEC')`),
    check('livraisons_motif_echec_chk', sql`${t.motifEchec} is null or ${t.motifEchec} in ('CLIENT_ABSENT','REFUS_CLIENT','ADRESSE_INTROUVABLE','AUTRE')`),
    index('livraisons_commande_idx').on(t.commandeId),
    index('livraisons_livreur_idx').on(t.livreurId),
  ],
);

// Articles d'une livraison : quantité demandée au moment de la création, quantité effectivement livrée à la clôture.
export const lignesLivraison = pgTable(
  'lignes_livraison',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    livraisonId: uuid('livraison_id').notNull().references(() => livraisons.id),
    ligneCommandeId: uuid('ligne_commande_id').notNull().references(() => lignesCommande.id),
    produitId: uuid('produit_id').notNull().references(() => produits.id),
    nomArticle: text('nom_article').notNull(),
    quantiteDemandee: integer('quantite_demandee').notNull(),
    quantiteLivree: integer('quantite_livree').notNull().default(0),
    statutLigne: text('statut_ligne').notNull().default('EN_ATTENTE'),
    createdAt: now(),
  },
  (t) => [
    check('lignes_livraison_demandee_chk', sql`${t.quantiteDemandee} > 0`),
    check('lignes_livraison_livree_chk', sql`${t.quantiteLivree} >= 0 and ${t.quantiteLivree} <= ${t.quantiteDemandee}`),
    check('lignes_livraison_statut_chk', sql`${t.statutLigne} in ('EN_ATTENTE','LIVREE','PARTIELLE','NON_LIVREE')`),
    index('lignes_livraison_livraison_idx').on(t.livraisonId),
    index('lignes_livraison_ligne_commande_idx').on(t.ligneCommandeId),
  ],
);

// Réglages de l'application (révision 10). Clé et valeur texte ; chaque changement est daté et attribué.
export const reglages = pgTable('reglages', {
  cle: text('cle').primaryKey(),
  valeur: text('valeur').notNull(),
  acteurId: uuid('acteur_id').references(() => users.id),
  misAJourLe: timestamp('mis_a_jour_le', { withTimezone: true }).notNull().defaultNow(),
});

// Notifications dans l'application (révision 12, cahier §13.4). Enregistrées ici, lues par leur destinataire.
// Aucun code de remise ni secret n'est écrit dans un message.
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    destinataireId: uuid('destinataire_id').notNull().references(() => users.id),
    type: text('type').notNull(),
    titre: text('titre').notNull(),
    message: text('message').notNull(),
    cibleType: text('cible_type'),
    cibleId: text('cible_id'),
    lueLe: timestamp('lue_le', { withTimezone: true }),
    pousseeLe: timestamp('poussee_le', { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [index('notifications_destinataire_idx').on(t.destinataireId, t.createdAt)],
);

// Appareils pouvant recevoir une notification push : un jeton par appareil.
export const appareilsPush = pgTable(
  'appareils_push',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    jeton: text('jeton').notNull().unique(),
    plateforme: text('plateforme').notNull(),
    createdAt: now(),
    misAJourLe: timestamp('mis_a_jour_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('appareil_plateforme_chk', sql`${t.plateforme} in ('android','ios')`),
    index('appareils_push_user_idx').on(t.userId),
  ],
);

// Réclamation d'un client sur un article livré (révision 13, cahier §16.2). Le délai de décision est fixé à la création.
// Le remboursement n'est pas exécuté ici : il attend le prestataire (décision 13 du suivi).
export const reclamations = pgTable(
  'reclamations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    numero: integer('numero').generatedAlwaysAsIdentity().notNull(),
    clientId: uuid('client_id').notNull().references(() => users.id),
    commandeId: uuid('commande_id').notNull().references(() => commandes.id),
    ligneCommandeId: uuid('ligne_commande_id').notNull().references(() => lignesCommande.id),
    produitId: uuid('produit_id').notNull().references(() => produits.id),
    nomArticle: text('nom_article').notNull(),
    motif: text('motif').notNull(),
    description: text('description').notNull(),
    statut: text('statut').notNull().default('OUVERTE'),
    echeanceDecisionLe: timestamp('echeance_decision_le', { withTimezone: true }).notNull(),
    solution: text('solution'),
    motifDecision: text('motif_decision'),
    decidePar: uuid('decide_par').references(() => users.id),
    decideLe: timestamp('decide_le', { withTimezone: true }),
    clotureLe: timestamp('cloture_le', { withTimezone: true }),
    // Support (révision 19, cahier §17.2) : responsable, priorité. Interne : jamais montré au client.
    responsableId: uuid('responsable_id').references(() => users.id),
    priorite: text('priorite').notNull().default('NORMALE'),
    // Date de la première alerte de retard : garantit une seule alerte par dossier.
    alerteRetardLe: timestamp('alerte_retard_le', { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [
    check('reclamations_priorite_chk', sql`${t.priorite} in ('BASSE','NORMALE','HAUTE','URGENTE')`),
    check('reclamations_motif_chk', sql`${t.motif} in ('ARTICLE_DEFECTUEUX','NON_CONFORME','DOMMAGE_LIVRAISON','ARTICLE_MANQUANT','AUTRE')`),
    check('reclamations_statut_chk', sql`${t.statut} in ('OUVERTE','ACCEPTEE','REFUSEE','CLOTUREE')`),
    check('reclamations_solution_chk', sql`${t.solution} is null or ${t.solution} in ('REPARATION','REMPLACEMENT','RETOUR','REMBOURSEMENT','AUTRE')`),
    index('reclamations_ligne_idx').on(t.ligneCommandeId),
    index('reclamations_client_idx').on(t.clientId),
  ],
);


// Notes internes d'un dossier de réclamation (révision 19, cahier §17.2). Visibles par l'administration seulement.
export const reclamationsNotes = pgTable(
  'reclamations_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reclamationId: uuid('reclamation_id').notNull().references(() => reclamations.id),
    auteurId: uuid('auteur_id').notNull().references(() => users.id),
    texte: text('texte').notNull(),
    createdAt: now(),
  },
  (t) => [index('reclamations_notes_reclamation_idx').on(t.reclamationId, t.createdAt)],
);

// Litige entre NZE et un partenaire (révision 19, cahier §16.2) : suivi séparément du dossier client.
// Jamais visible par le client. Peut être rattaché à une réclamation, qui doit concerner ce partenaire.
export const litigesPartenaire = pgTable(
  'litiges_partenaire',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    numero: integer('numero').generatedAlwaysAsIdentity().notNull(),
    entrepriseId: uuid('entreprise_id').notNull().references(() => entreprises.id),
    reclamationId: uuid('reclamation_id').references(() => reclamations.id),
    motif: text('motif').notNull(),
    description: text('description').notNull(),
    statut: text('statut').notNull().default('OUVERT'),
    priorite: text('priorite').notNull().default('NORMALE'),
    responsableId: uuid('responsable_id').references(() => users.id),
    ouvertPar: uuid('ouvert_par').notNull().references(() => users.id),
    issue: text('issue'),
    clotureLe: timestamp('cloture_le', { withTimezone: true }),
    cloturePar: uuid('cloture_par').references(() => users.id),
    createdAt: now(),
  },
  (t) => [
    check('litiges_partenaire_statut_chk', sql`${t.statut} in ('OUVERT','CLOS')`),
    check('litiges_partenaire_priorite_chk', sql`${t.priorite} in ('BASSE','NORMALE','HAUTE','URGENTE')`),
    index('litiges_partenaire_entreprise_idx').on(t.entrepriseId),
    index('litiges_partenaire_reclamation_idx').on(t.reclamationId),
  ],
);

// Adresses de livraison du client : quartier, repère, position exacte, photo du lieu (clé de fichier).
export const adresses = pgTable(
  'adresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    libelle: text('libelle').notNull(),
    quartier: text('quartier').notNull(),
    repere: text('repere'),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    photoCle: text('photo_cle'),
    createdAt: now(),
  },
  (t) => [index('adresses_user_idx').on(t.userId)],
);

// Liste d'envies : un article une seule fois par client.
export const listesEnvies = pgTable(
  'listes_envies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    produitId: uuid('produit_id').notNull().references(() => produits.id),
    createdAt: now(),
  },
  (t) => [uniqueIndex('listes_envies_user_produit_idx').on(t.userId, t.produitId)],
);

// Tentatives de connexion échouées, par numéro (révision 16). Couvre aussi les numéros sans compte :
// le verrouillage ne révèle donc jamais si un numéro est enregistré.
export const tentativesConnexion = pgTable('tentatives_connexion', {
  telephone: text('telephone').primaryKey(),
  echecs: integer('echecs').notNull().default(0),
  verrouilleJusqua: timestamp('verrouille_jusqua', { withTimezone: true }),
  misAJourLe: timestamp('mis_a_jour_le', { withTimezone: true }).notNull().defaultNow(),
});

// Paiement échelonné (révision 18, amendements V3.2). Un plan lie une commande à ses encaissements.
// Règle : un plan porte sur les articles d'un seul commerçant (entrepriseId), et 5 articles au plus.
export const plansEcheloneces = pgTable(
  'plans_echelonnes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commandeId: uuid('commande_id').notNull().unique().references(() => commandes.id),
    clientId: uuid('client_id').notNull().references(() => users.id),
    entrepriseId: uuid('entreprise_id').notNull().references(() => entreprises.id),
    statut: text('statut').notNull(),
    totalFcfa: integer('total_fcfa').notNull(),
    avanceFcfa: integer('avance_fcfa').notNull(),
    resteFcfa: integer('reste_fcfa').notNull(),
    mensualiteFcfa: integer('mensualite_fcfa').notNull(),
    nombreArticles: integer('nombre_articles').notNull(),
    commercantTotalFcfa: integer('commercant_total_fcfa').notNull(),
    commissionTotalFcfa: integer('commission_total_fcfa').notNull(),
    livraisonTotalFcfa: integer('livraison_total_fcfa').notNull(),
    dateDebut: timestamp('date_debut', { withTimezone: true }),
    motifAnnulation: text('motif_annulation'),
    creeLe: now(),
  },
  (t) => [
    check('plans_statut_chk', sql`${t.statut} in ('PROPOSE','ACTIF','SOLDE','ANNULE')`),
    check('plans_montants_chk', sql`${t.totalFcfa} > 0 and ${t.resteFcfa} > 0 and ${t.mensualiteFcfa} > 0`),
    index('plans_client_idx').on(t.clientId),
    index('plans_entreprise_idx').on(t.entrepriseId),
  ],
);

export const versementsEcheloneces = pgTable(
  'versements_echelonnes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id').notNull().references(() => plansEcheloneces.id),
    echeancierId: uuid('echeancier_id').references(() => echeanciersArticles.id),
    type: text('type').notNull(),
    montantFcfa: integer('montant_fcfa').notNull(),
    statut: text('statut').notNull(),
    commercantFcfa: integer('commercant_fcfa'),
    commissionFcfa: integer('commission_fcfa'),
    livraisonFcfa: integer('livraison_fcfa'),
    encaisseLe: timestamp('encaisse_le', { withTimezone: true }),
    creeLe: now(),
  },
  (t) => [
    check('versements_type_chk', sql`${t.type} in ('AVANCE','VERSEMENT')`),
    check('versements_statut_chk', sql`${t.statut} in ('EN_ATTENTE','ENCAISSE','ECHEC')`),
    check('versements_montant_chk', sql`${t.montantFcfa} > 0`),
    index('versements_plan_idx').on(t.planId),
  ],
);

// Fiches des prestataires publicitaires (D-P6) : administrées par NZE, sans compte ni tableau de bord prestataire,
// sans réservation de service. Le numéro du prestataire n'est jamais exposé au client.
export const fichesPrestataires = pgTable(
  'fiches_prestataires',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nomPublic: text('nom_public').notNull(),
    activite: text('activite').notNull(),
    description: text('description').notNull().default(''),
    zone: text('zone'),
    // Clé de la photo dans le seau R2 (privé) : jamais exposée telle quelle au client, seulement sous forme de lien signé.
    photoCle: text('photo_cle'),
    statut: text('statut').notNull().default('BROUILLON'),
    ordre: integer('ordre').notNull().default(0),
    createdAt: now(),
  },
  (t) => [check('fiches_prestataires_statut_chk', sql`${t.statut} in ('BROUILLON','PUBLIEE','SUSPENDUE')`)],
);

// Demandes envoyées à NZE depuis une fiche (D-P6). Elles n'engagent aucune réservation : NZE rappelle le client.
export const demandesPrestataire = pgTable(
  'demandes_prestataire',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ficheId: uuid('fiche_id').notNull().references(() => fichesPrestataires.id),
    clientId: uuid('client_id').notNull().references(() => users.id),
    motif: text('motif').notNull(),
    message: text('message').notNull(),
    statut: text('statut').notNull().default('NOUVELLE'),
    noteNze: text('note_nze'),
    traiteeLe: timestamp('traitee_le', { withTimezone: true }),
    traiteePar: uuid('traitee_par').references(() => users.id),
    createdAt: now(),
  },
  (t) => [
    check('demandes_prestataire_statut_chk', sql`${t.statut} in ('NOUVELLE','TRAITEE','CLOTUREE')`),
    check('demandes_prestataire_motif_chk', sql`${t.motif} in ('INFORMATION','DEVIS','AUTRE')`),
  ],
);

// Échéances mensuelles de chaque article : une ligne par mois, avec le montant dû, le montant payé et la date limite.
export const echeancesMois = pgTable(
  'echeances_mois',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    echeancierId: uuid('echeancier_id').notNull().references(() => echeanciersArticles.id),
    numero: integer('numero').notNull(),
    montantDuFcfa: integer('montant_du_fcfa').notNull(),
    montantPayeFcfa: integer('montant_paye_fcfa').notNull().default(0),
    dateLimite: timestamp('date_limite', { withTimezone: true }).notNull(),
    createdAt: now(),
  },
  (t) => [check('echeance_mois_chk', sql`${t.numero} >= 1 and ${t.montantDuFcfa} >= 0 and ${t.montantPayeFcfa} >= 0`)],
);

// Pénalités de retard : une par mois supplémentaire nécessaire pour solder, tant qu'un solde reste dû.
export const penalitesEcheancier = pgTable(
  'penalites_echeancier',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    echeancierId: uuid('echeancier_id').notNull().references(() => echeanciersArticles.id),
    moisRetard: integer('mois_retard').notNull(),
    montantFcfa: integer('montant_fcfa').notNull(),
    montantPayeFcfa: integer('montant_paye_fcfa').notNull().default(0),
    appliqueeLe: timestamp('appliquee_le', { withTimezone: true }).notNull(),
    createdAt: now(),
  },
  (t) => [check('penalite_chk', sql`${t.moisRetard} >= 1 and ${t.montantFcfa} >= 0 and ${t.montantPayeFcfa} >= 0`)],
);

// Trace de chaque affectation d'un versement à un mois ou à une pénalité.
export const affectationsVersement = pgTable(
  'affectations_versement',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    versementId: uuid('versement_id').notNull().references(() => versementsEcheloneces.id),
    echeanceId: uuid('echeance_id').references(() => echeancesMois.id),
    penaliteId: uuid('penalite_id').references(() => penalitesEcheancier.id),
    montantFcfa: integer('montant_fcfa').notNull(),
    createdAt: now(),
  },
  (t) => [check('affectation_cible_chk', sql`(${t.echeanceId} is null) <> (${t.penaliteId} is null)`)],
);
