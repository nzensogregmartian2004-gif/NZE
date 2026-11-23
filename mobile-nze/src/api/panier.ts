// Panier : une seule version active côté serveur. Ajouter un article recompose la liste complète.
import { appeler } from './client';

export interface LignePanier { produitId: string; quantite: number; prixUnitaireFcfa: number; montantLigneFcfa: number }
export interface Panier { id: string; reception: string; totalFcfa: number; sousTotalFcfa: number; lignes: LignePanier[] }

export async function lirePanier(): Promise<Panier | null> {
  return appeler<Panier | null>('/panier');
}

export interface Livraison { latitude: number; longitude: number }

// Le serveur recalcule les prix et les frais : le client n'envoie que des identifiants, des quantités et une position.
export async function enregistrerLignes(
  lignes: { produitId: string; quantite: number }[],
  reception: 'RETRAIT' | 'LIVRAISON' = 'RETRAIT',
  livraison?: Livraison,
): Promise<Panier | null> {
  return appeler<Panier | null>('/panier', { methode: 'PUT', corps: { lignes, reception, livraison } });
}

export async function ajouterAuPanier(produitId: string, quantite = 1): Promise<Panier | null> {
  const actuel = await lirePanier();
  const lignes = (actuel?.lignes ?? []).map((l) => ({ produitId: l.produitId, quantite: l.quantite }));
  const existante = lignes.find((l) => l.produitId === produitId);
  if (existante) existante.quantite += quantite;
  else lignes.push({ produitId, quantite });
  return enregistrerLignes(lignes);
}
