// Photos des articles : adresse de la photo, servie par l'API (redirection vers le lien signé).
export function urlPhotoProduit(baseApi: string, produitId: string): string {
  return `${baseApi}/produits/${produitId}/photo`;
}
