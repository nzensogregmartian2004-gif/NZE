// Traduction des statuts PVit vers les statuts NZE.
// Règle de NZE : un paiement PENDING n'est jamais considéré comme payé.

export type NzeStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'UNCERTAIN';

// Statut lu sur une transaction (endpoint de statut ou callback confirmé).
// Un statut inconnu devient UNCERTAIN : il doit être vérifié, jamais deviné.
export function toNzeStatus(raw: unknown): NzeStatus {
  const s = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (s === 'SUCCESS') return 'SUCCESS';
  if (s === 'PENDING') return 'PENDING';
  if (s === 'FAILED' || s === 'FAILURE' || s === 'REJECTED') return 'FAILED';
  return 'UNCERTAIN';
}

// Réponse à une demande d'initiation.
// « SUCCESS » signifie que PVit a accepté la demande : le client doit encore valider sur son téléphone.
// Donc, à ce stade, le résultat est PENDING, jamais SUCCESS.
export function toInitiationStatus(raw: unknown): NzeStatus {
  const status = toNzeStatus(raw);
  return status === 'SUCCESS' ? 'PENDING' : status;
}
