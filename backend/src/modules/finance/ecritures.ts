// Répartition automatique d'un encaissement confirmé : la part de chaque commerçant, la commission et les frais de livraison.
// Invariant : la somme des écritures est égale au total payé par le client.
import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { commandes, ecritures, lignesCommande } from '../../db/schema.ts';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// Calcule la répartition sans rien écrire, pour vérifier l'invariant avant toute modification.
async function construireRepartition(tx: Tx, commandeId: string) {
  const [c] = await tx.select().from(commandes).where(eq(commandes.id, commandeId)).limit(1);
  const lignes = await tx.select().from(lignesCommande).where(eq(lignesCommande.commandeId, commandeId));
  const lignesEcritures: (typeof ecritures.$inferInsert)[] = [];
  for (const l of lignes) {
    lignesEcritures.push({ commandeId, ligneId: l.id, entrepriseId: l.entrepriseId, categorie: 'VENTE_NET', registre: 'PARTENAIRE', montantFcfa: l.montantLigneFcfa - l.commissionFcfa });
    lignesEcritures.push({ commandeId, ligneId: l.id, entrepriseId: null, categorie: 'COMMISSION', registre: 'COMMISSIONS', montantFcfa: l.commissionFcfa });
  }
  if (c.fraisLivraisonFcfa > 0) {
    lignesEcritures.push({ commandeId, entrepriseId: null, categorie: 'FRAIS_LIVRAISON', registre: 'COMMISSIONS', montantFcfa: c.fraisLivraisonFcfa });
  }
  const somme = lignesEcritures.reduce((total, e) => total + (e.montantFcfa ?? 0), 0);
  return { c, lignesEcritures, somme };
}

// Vrai si la répartition couvre exactement le total payé. Ne modifie rien.
export async function repartitionCoherente(tx: Tx, commandeId: string): Promise<boolean> {
  const { c, somme } = await construireRepartition(tx, commandeId);
  return somme === c.totalFcfa;
}

export async function repartirVente(tx: Tx, commandeId: string): Promise<void> {
  const { c, lignesEcritures, somme } = await construireRepartition(tx, commandeId);
  // Invariant : les registres PARTENAIRE et COMMISSIONS répartissent exactement le total payé.
  if (somme !== c.totalFcfa) {
    throw new Error(`Répartition incohérente pour la commande ${c.reference} : ${somme} ≠ ${c.totalFcfa}`);
  }
  // Registre CLIENT : l'encaissement reçu du client, une seule écriture par commande.
  lignesEcritures.push({ commandeId, entrepriseId: null, categorie: 'ENCAISSEMENT', registre: 'CLIENT', montantFcfa: c.totalFcfa });
  await tx.insert(ecritures).values(lignesEcritures);
}
