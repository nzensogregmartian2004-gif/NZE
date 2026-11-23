// Validation des données envoyées à PVit. Les montants sont des entiers FCFA.

const REFERENCE_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MSISDN_RE = /^\d{8,12}$/;

export function assertAmount(amount: unknown): number {
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    throw new Error('Montant invalide : entier FCFA strictement positif attendu');
  }
  return amount;
}

export function assertReference(reference: string): string {
  if (!REFERENCE_RE.test(reference)) {
    throw new Error('Référence invalide : lettres, chiffres, - et _ uniquement, 64 caractères maximum');
  }
  return reference;
}

export function assertMsisdn(msisdn: string): string {
  if (!MSISDN_RE.test(msisdn)) {
    throw new Error('Numéro invalide : 8 à 12 chiffres attendus, sans espaces');
  }
  return msisdn;
}
