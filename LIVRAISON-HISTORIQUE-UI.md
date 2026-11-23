# Historique d'un dossier de réclamation — interface administrateur

## Ce qui change
- Sur le détail d'une réclamation, l'administrateur voit la section « Historique du dossier » : création, notes internes, décision, clôture, alerte de retard, mise à jour. Chaque entrée indique l'action, la date, l'auteur (ou « Système ») et la note ou le motif lorsqu'il existe.
- Composant : `nze-mobile/src/components/HistoriqueDossier.tsx`. Libellés : `nze-mobile/src/lib/historique-reclamation.ts`.
- Le client ne voit pas cette section (affichage réservé à l'administration).
- Traductions : 11 clés dans les quatre langues.

## Résultats mesurés
- Mobile : typage 0 erreur ; tests 18 sur 18 (3 nouveaux, sur les libellés et les détails).
- Backend : inchangé depuis la livraison précédente (273 tests sur 273).
