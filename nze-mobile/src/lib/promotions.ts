// Promotions de l'accueil : une seule offre affichée par article, la plus forte réduction.
export interface Promotion {
  id: string;
  titre: string;
  pourcentage: number;
  produitId: string;
  produitNom: string;
  prixAvantFcfa: number;
  prixApresFcfa: number;
}

export function promotionParProduit(promotions: Promotion[]): Map<string, Promotion> {
  const parProduit = new Map<string, Promotion>();
  for (const p of promotions) {
    const actuelle = parProduit.get(p.produitId);
    if (!actuelle || p.pourcentage > actuelle.pourcentage) parProduit.set(p.produitId, p);
  }
  return parProduit;
}
