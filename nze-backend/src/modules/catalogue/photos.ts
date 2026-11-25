// Photos des articles et recherche par photo. Méthode sans IA : empreinte dHash de 64 bits, comparée par distance de Hamming.
import { randomUUID } from 'node:crypto';
import { and, eq, isNotNull } from 'drizzle-orm';
import sharp from 'sharp';
import type { Db } from '../../db/client.ts';
import { produits } from '../../db/schema.ts';
import { notFound } from '../../core/errors.ts';
import type { AuthUser } from '../../core/auth.ts';
import { journaliser } from '../audit/service.ts';
import { cleImage, verifierImage, type Stockage } from '../stockage/r2.ts';
import { lireTexte, motsUtiles } from './lecture-texte.ts';

// Distance maximale (sur 64 bits) pour qu'une photo soit considérée comme comparable à une autre.
export const SEUIL_SIMILARITE = 12;
export const RESULTATS_MAX = 12;

// Empreinte dHash : image réduite à 9 x 8 pixels en niveaux de gris, un bit par paire de pixels voisins.
export async function empreinteImage(contenu: Buffer): Promise<string> {
  const pixels = await sharp(contenu).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits += pixels[y * 9 + x] > pixels[y * 9 + x + 1] ? '1' : '0';
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
}

export function distanceEmpreintes(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let distance = 0;
  while (x > 0n) {
    distance += Number(x & 1n);
    x >>= 1n;
  }
  return distance;
}

export async function enregistrerPhotoProduit(db: Db, stockage: Stockage, acteur: AuthUser, produitId: string, contenu: Buffer, typeMime: string) {
  verifierImage(contenu, typeMime);
  const [produit] = await db.select({ id: produits.id, photoCle: produits.photoCle }).from(produits).where(eq(produits.id, produitId)).limit(1);
  if (!produit) throw notFound('Article introuvable');
  const empreinte = await empreinteImage(contenu);
  const cle = cleImage('produits', randomUUID(), typeMime);
  await stockage.envoyer(cle, contenu, typeMime);
  await db.update(produits).set({ photoCle: cle, empreinteImage: empreinte }).where(eq(produits.id, produitId));
  if (produit.photoCle) await stockage.supprimer(produit.photoCle).catch(() => undefined);
  await journaliser(db, { acteurId: acteur.id, action: 'PHOTO_PRODUIT_AJOUTEE', cibleType: 'produit', cibleId: produitId, details: { typeMime } });
  return { produitId, empreinte };
}

// Articles correspondant à la photo : d'abord ceux qui lui ressemblent, puis ceux dont le nom contient des mots lus sur la photo.
// Aucune photo n'est conservée.
export async function rechercherParPhoto(db: Db, stockage: Stockage | null, contenu: Buffer, typeMime: string) {
  verifierImage(contenu, typeMime);
  const empreinte = await empreinteImage(contenu);
  const texte = await lireTexte(contenu).catch(() => '');
  const motsLus = new Set(motsUtiles(texte));

  const candidats = await db
    .select({ id: produits.id, nom: produits.nom, marque: produits.marque, modele: produits.modele, prixFcfa: produits.prixFcfa, empreinte: produits.empreinteImage, photoCle: produits.photoCle })
    .from(produits)
    .limit(2000);

  const parPhoto = candidats
    .filter((c) => c.empreinte)
    .map((c) => ({ ...c, distance: distanceEmpreintes(empreinte, c.empreinte ?? '') }))
    .filter((c) => c.distance <= SEUIL_SIMILARITE)
    .sort((a, b) => a.distance - b.distance);
  const idsPhoto = new Set(parPhoto.map((c) => c.id));

  const parTexte = candidats
    .filter((c) => !idsPhoto.has(c.id))
    .map((c) => ({ ...c, communs: [...new Set(motsUtiles([c.nom, c.marque ?? '', c.modele ?? ''].join(' ')))].filter((m) => motsLus.has(m)).length }))
    .filter((c) => c.communs > 0)
    .sort((a, b) => b.communs - a.communs);

  const choisis = [
    ...parPhoto.map((c) => ({ ...c, raison: 'photo' as const, distance: c.distance as number | null })),
    ...parTexte.map((c) => ({ ...c, raison: 'texte' as const, distance: null })),
  ].slice(0, RESULTATS_MAX);

  return Promise.all(
    choisis.map(async (c) => ({
      id: c.id,
      nom: c.nom,
      prixFcfa: c.prixFcfa,
      raison: c.raison,
      distance: c.distance,
      photoUrl: c.photoCle && stockage ? await stockage.urlSignee(c.photoCle) : null,
    })),
  );
}
