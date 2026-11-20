// Calcul et figement des frais de livraison d'une commande. Partagé par le paiement comptant et l'échelonnement :
// une seule règle de calcul, la même partout (distance routière, tarif au kilomètre, minimum).
import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { commandes } from '../../db/schema.ts';
import type { Cartographie } from '../cartographie/index.ts';
import { fraisLivraison } from '../livraisons/pricing.ts';
import { origineLivraison, tarifActif } from '../parametres/service.ts';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface Livraison {
  frais: number;
  pointFixeId: string | null;
  tarifId: string | null;
  distanceM: number | null;
  origineLatitude: number | null;
  origineLongitude: number | null;
  fournisseurDistance: string | null;
  distanceCalculeeLe: Date | null;
}

// Frais de livraison calculés au moment de payer : distance routière depuis le point fixe ou l'emplacement du commerçant × tarif au kilomètre.
export async function calculerLivraison(
  deps: { db: Db; cartographie: Cartographie },
  c0: { reception: string; latitude: number | null; longitude: number | null },
  lignes: { entrepriseId: string }[],
): Promise<Livraison> {
  let livraison: Livraison =
    { frais: 0, pointFixeId: null, tarifId: null, distanceM: null, origineLatitude: null, origineLongitude: null, fournisseurDistance: null, distanceCalculeeLe: null };
  if (c0.reception === 'LIVRAISON' && c0.latitude !== null && c0.longitude !== null) {
    const origine = await origineLivraison(deps.db, lignes.map((l) => l.entrepriseId));
    const tarif = await tarifActif(deps.db);
    const trajet = await deps.cartographie.distanceRoutiere(origine, { latitude: c0.latitude, longitude: c0.longitude });
    livraison = {
      frais: fraisLivraison(trajet.distanceM, tarif), pointFixeId: origine.pointFixeId, tarifId: tarif.id,
      distanceM: trajet.distanceM, origineLatitude: origine.latitude, origineLongitude: origine.longitude,
      fournisseurDistance: deps.cartographie.fournisseur, distanceCalculeeLe: new Date(),
    };
  }
  return livraison;
}

// Fige les frais et le total de la commande (même opération que l'ancien paiement comptant).
export async function figerLivraisonCommande(tx: Tx, commandeId: string, sousTotalFcfa: number, livraison: Livraison) {
  const [maj] = await tx
    .update(commandes)
    .set({
      fraisLivraisonFcfa: livraison.frais, totalFcfa: sousTotalFcfa + livraison.frais, pointFixeId: livraison.pointFixeId, tarifId: livraison.tarifId,
      distanceM: livraison.distanceM, fournisseurDistance: livraison.fournisseurDistance, distanceCalculeeLe: livraison.distanceCalculeeLe,
      origineLatitude: livraison.origineLatitude, origineLongitude: livraison.origineLongitude,
    })
    .where(eq(commandes.id, commandeId))
    .returning();
  return maj;
}
