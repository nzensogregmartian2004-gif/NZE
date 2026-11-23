// Verdict d'un versement MyPVit (GIVE_CHANGE). Fonction pure : aucun accès réseau ni base.
// Un montant qui ne correspond pas à la demande n'est jamais tenu pour versé.
import type { NzeStatus } from '../paiements/providers/mypvit/index.ts';

export function verdictVersement(statut: { nzeStatus: NzeStatus; amount: number | null }, montantAttendu: number): 'VERSEE' | 'ECHEC' | null {
  if (statut.amount !== null && statut.amount !== montantAttendu) return null;
  if (statut.nzeStatus === 'SUCCESS') return 'VERSEE';
  if (statut.nzeStatus === 'FAILED') return 'ECHEC';
  return null;
}
