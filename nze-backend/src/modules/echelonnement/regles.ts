// Règles du paiement échelonné, telles que décidées par le fondateur.
// - Avance de 40 % par défaut (réglable par l'administrateur principal) du total de la commande, arrondie au supérieur.
// - Le reste se règle en mensualités fixées à la souscription, sur 3 mois maximum par défaut (réglable).
// - Versements libres à tout moment : ils réduisent le reste, et le calendrier se recalcule.
// - Aucune pénalité de retard, aucun blocage de commande. Des notifications signalent les échéances.
// - 5 articles maximum par paiement échelonné.
// Inactif par défaut (cahier §25.1). L'administration peut l'activer (réglage echelonnement_actif) seulement après validations juridiques, contractuelles et de trésorerie.
import { badRequest } from '../../core/errors.ts';

// Valeurs initiales, utilisées tant que l'administrateur principal n'a pas défini d'autres réglages.
export const AVANCE_POURCENT_DEFAUT = 40;
export const DUREE_MAX_MOIS_DEFAUT = 3;
export const MAX_ARTICLES_ECHELONNES = 5;
// Pénalité par mois supplémentaire nécessaire pour solder l'achat (réglable par l'administration).
export const PENALITE_PAR_MOIS_DEFAUT_FCFA = 10000;
export const BORNES_PENALITE_FCFA = { min: 0, max: 100000 } as const;
// Bornes acceptées pour les réglages : elles évitent un plan sans avance ou sur une durée absurde.
export const BORNES = { avancePourcent: { min: 10, max: 90 }, dureeMaxMois: { min: 1, max: 12 } } as const;

export interface ParametresEchelonnement { avancePourcent: number; dureeMaxMois: number }
export const PARAMETRES_DEFAUT: ParametresEchelonnement = { avancePourcent: AVANCE_POURCENT_DEFAUT, dureeMaxMois: DUREE_MAX_MOIS_DEFAUT };

// Refuse toute valeur non entière ou hors bornes.
export function verifierParametres(p: ParametresEchelonnement): ParametresEchelonnement {
  const entier = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v);
  if (!entier(p.avancePourcent) || p.avancePourcent < BORNES.avancePourcent.min || p.avancePourcent > BORNES.avancePourcent.max) {
    throw badRequest(`L'avance doit être un pourcentage entier entre ${BORNES.avancePourcent.min} et ${BORNES.avancePourcent.max}`);
  }
  if (!entier(p.dureeMaxMois) || p.dureeMaxMois < BORNES.dureeMaxMois.min || p.dureeMaxMois > BORNES.dureeMaxMois.max) {
    throw badRequest(`La durée doit être un nombre entier de mois entre ${BORNES.dureeMaxMois.min} et ${BORNES.dureeMaxMois.max}`);
  }
  return { avancePourcent: p.avancePourcent, dureeMaxMois: p.dureeMaxMois };
}

export interface PlanPropose {
  totalFcfa: number;
  avanceFcfa: number;
  resteFcfa: number;
  mensualiteMinFcfa: number;
  mensualiteFcfa: number;
  dureeMois: number;
}

// Vérifie un entier dans des bornes ; renvoie la valeur ou lève une erreur claire.
export function verifierBorne(valeur: number, b: { min: number; max: number }, nom: string): number {
  if (!Number.isSafeInteger(valeur) || valeur < b.min || valeur > b.max) {
    throw badRequest(`${nom} doit être un nombre entier entre ${b.min} et ${b.max}`);
  }
  return valeur;
}

// Échéancier d'un article : avance (pourcentage propre à l'article), reste, mensualité de base
// (reste ÷ durée, arrondi au franc supérieur) et dernier mois, qui absorbe l'arrondi.
export interface EcheancierArticle {
  prixFcfa: number;
  avancePourcent: number;
  avanceFcfa: number;
  resteFcfa: number;
  dureeMois: number;
  mensualiteFcfa: number;
  dernierMoisFcfa: number;
}

export function echeancierArticle(prixFcfa: number, avancePourcent: number, dureeMois: number): EcheancierArticle {
  if (!Number.isSafeInteger(prixFcfa) || prixFcfa <= 0) throw badRequest('Prix d’article invalide pour un paiement échelonné');
  const pourcent = verifierBorne(avancePourcent, BORNES.avancePourcent, 'L’avance');
  const duree = verifierBorne(dureeMois, BORNES.dureeMaxMois, 'La durée');
  const avanceFcfa = avanceDue(prixFcfa, pourcent);
  const resteFcfa = prixFcfa - avanceFcfa;
  const mensualiteFcfa = Math.ceil(resteFcfa / duree);
  const dernierMoisFcfa = resteFcfa - mensualiteFcfa * (duree - 1);
  if (dernierMoisFcfa < 1) throw badRequest('Montant trop faible pour cette durée d’échelonnement');
  return { prixFcfa, avancePourcent: pourcent, avanceFcfa, resteFcfa, dureeMois: duree, mensualiteFcfa, dernierMoisFcfa };
}

export function avanceDue(totalFcfa: number, avancePourcent: number = AVANCE_POURCENT_DEFAUT): number {
  return Math.ceil((totalFcfa * avancePourcent) / 100);
}

export function mensualiteMinimum(resteFcfa: number, dureeMaxMois: number = DUREE_MAX_MOIS_DEFAUT): number {
  return Math.ceil(resteFcfa / dureeMaxMois);
}

// Proposition de plan, avant paiement de l'avance. La mensualité est choisie d'un commun accord.
export function proposerPlan(totalFcfa: number, nombreArticles: number, mensualiteFcfa: number, parametres: ParametresEchelonnement = PARAMETRES_DEFAUT): PlanPropose {
  if (!Number.isSafeInteger(totalFcfa) || totalFcfa <= 0) throw badRequest('Montant de commande invalide');
  if (nombreArticles < 1 || nombreArticles > MAX_ARTICLES_ECHELONNES) {
    throw badRequest(`Le paiement échelonné concerne au maximum ${MAX_ARTICLES_ECHELONNES} articles`);
  }
  const avanceFcfa = avanceDue(totalFcfa, parametres.avancePourcent);
  const resteFcfa = totalFcfa - avanceFcfa;
  if (resteFcfa <= 0) throw badRequest('Rien à échelonner sur cette commande');
  const mensualiteMinFcfa = mensualiteMinimum(resteFcfa, parametres.dureeMaxMois);
  if (!Number.isSafeInteger(mensualiteFcfa) || mensualiteFcfa < mensualiteMinFcfa) {
    throw badRequest(`La mensualité doit être d'au moins ${mensualiteMinFcfa} FCFA pour régler le reste en ${parametres.dureeMaxMois} mois au maximum`);
  }
  if (mensualiteFcfa > resteFcfa) throw badRequest('La mensualité ne peut pas dépasser le reste à payer');
  return { totalFcfa, avanceFcfa, resteFcfa, mensualiteMinFcfa, mensualiteFcfa, dureeMois: Math.ceil(resteFcfa / mensualiteFcfa) };
}

// Un versement doit être un montant entier positif, sans dépasser le reste à payer.
export function verifierVersement(restantFcfa: number, montantFcfa: number): void {
  if (!Number.isSafeInteger(montantFcfa) || montantFcfa <= 0) throw badRequest('Montant de versement invalide');
  if (montantFcfa > restantFcfa) throw badRequest(`Le versement dépasse le reste à payer (${restantFcfa} FCFA)`);
}

export interface Versement { montantFcfa: number; date: Date }

export interface Echeance { date: Date; montantFcfa: number }

export interface Situation {
  resteInitialFcfa: number;
  payeFcfa: number;
  restantFcfa: number;
  dueCetteEcheanceFcfa: number;
  enRetard: boolean;
  moisRestants: number;
  echeances: Echeance[];
}

// Ajoute des mois à une date, en gardant le jour (ou le dernier jour du mois si nécessaire).
export function ajouterMois(date: Date, mois: number): Date {
  const annee = date.getUTCFullYear();
  const m = date.getUTCMonth() + mois;
  const cible = new Date(Date.UTC(annee, m, 1));
  const dernierJour = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth(), Math.min(date.getUTCDate(), dernierJour)));
}

// Nombre de mois pleins écoulés depuis le début du plan (0 pendant le premier mois).
export function moisEcoules(debut: Date, maintenant: Date): number {
  let mois = (maintenant.getUTCFullYear() - debut.getUTCFullYear()) * 12 + (maintenant.getUTCMonth() - debut.getUTCMonth());
  if (maintenant.getUTCDate() < debut.getUTCDate()) mois -= 1;
  return Math.max(0, mois);
}

// Situation du client à une date donnée : ce qu'il doit ce mois-ci, ce qui reste, et le calendrier restant.
export function situation(p: {
  resteInitialFcfa: number;
  mensualiteFcfa: number;
  dateDebut: Date;
  versements: Versement[];
  maintenant: Date;
}): Situation {
  const { resteInitialFcfa: reste, mensualiteFcfa: M, dateDebut, maintenant } = p;
  const paye = p.versements.reduce((t, v) => t + v.montantFcfa, 0);
  const payeRetenu = Math.min(paye, reste);
  const restant = reste - payeRetenu;
  const k = moisEcoules(dateDebut, maintenant);
  const cumulAPresent = (j: number) => Math.min(reste, (j + 1) * M);

  const dueCetteEcheance = Math.max(0, cumulAPresent(k) - payeRetenu);
  const enRetard = k > 0 && payeRetenu < cumulAPresent(k - 1);

  const echeances: Echeance[] = [];
  if (restant > 0) {
    const premiere = Math.min(restant, dueCetteEcheance);
    if (premiere > 0) echeances.push({ date: ajouterMois(dateDebut, k), montantFcfa: premiere });
    let r = restant - premiere;
    let i = 1;
    while (r > 0) {
      const montant = Math.min(M, r);
      echeances.push({ date: ajouterMois(dateDebut, k + i), montantFcfa: montant });
      r -= montant;
      i += 1;
    }
  }

  return {
    resteInitialFcfa: reste,
    payeFcfa: payeRetenu,
    restantFcfa: restant,
    dueCetteEcheanceFcfa: Math.min(restant, dueCetteEcheance),
    enRetard,
    moisRestants: echeances.length,
    echeances,
  };
}

// Répartition d'un encaissement entre le commerçant, la commission NZE et les frais de livraison.
// La répartition se fait sur le cumul : la somme des parts d'un encaissement égale exactement son montant.
export interface Parts { commercantFcfa: number; commissionFcfa: number; livraisonFcfa: number }

export function ventiler(p: { montantFcfa: number; cumulAvantFcfa: number; totalFcfa: number; parts: Parts }): Parts {
  const { montantFcfa, cumulAvantFcfa, totalFcfa, parts } = p;
  if (parts.commercantFcfa + parts.commissionFcfa + parts.livraisonFcfa !== totalFcfa) {
    throw badRequest('Les parts ne correspondent pas au total de la commande');
  }
  // Commerçant et commission : part cumulée arrondie à l'inférieur. Les frais de livraison reçoivent le reste,
  // ce qui garantit que la somme des parts égale toujours le montant encaissé et que les totaux finaux sont exacts.
  const cumul = (composante: number) =>
    Math.floor(((cumulAvantFcfa + montantFcfa) * composante) / totalFcfa) - Math.floor((cumulAvantFcfa * composante) / totalFcfa);
  const commercantFcfa = cumul(parts.commercantFcfa);
  const commissionFcfa = cumul(parts.commissionFcfa);
  return { commercantFcfa, commissionFcfa, livraisonFcfa: montantFcfa - commercantFcfa - commissionFcfa };
}
