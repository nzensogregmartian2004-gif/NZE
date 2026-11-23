// Stockage des photos sur Cloudflare R2 (API compatible S3). Le seau reste privé : chaque lien est signé et expire.
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ConfigR2 } from '../../config.ts';
import { badRequest } from '../../core/errors.ts';

// Ce que l'application attend d'un stockage de fichiers. Les tests utilisent une version en mémoire.
export interface Stockage {
  envoyer(cle: string, contenu: Buffer, typeMime: string): Promise<void>;
  urlSignee(cle: string, dureeSecondes?: number): Promise<string>;
  supprimer(cle: string): Promise<void>;
}

export const TYPES_IMAGE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const TAILLE_MAX_IMAGE = 3 * 1024 * 1024;
export const DUREE_LIEN_SECONDES = 3600;

// Signatures des formats d'image : le contenu réel doit correspondre au type annoncé.
const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
};

export function verifierImage(contenu: Buffer, typeMime: string): void {
  if (contenu.length === 0) throw badRequest('Image vide');
  if (contenu.length > TAILLE_MAX_IMAGE) throw badRequest('Image trop volumineuse (3 Mo maximum)');
  const signature = SIGNATURES[typeMime];
  if (!signature) throw badRequest('Type d’image non accepté (JPEG, PNG ou WebP)');
  if (!signature(contenu)) throw badRequest('Le contenu ne correspond pas au type d’image annoncé');
}

// Clé de stockage générée par le serveur, jamais par le client : dossier, identifiant et extension sont contrôlés.
export function cleImage(dossier: 'fiches-prestataires', id: string, typeMime: string): string {
  const ext = TYPES_IMAGE[typeMime];
  if (!ext) throw badRequest('Type d’image non accepté');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new Error('Identifiant de stockage invalide');
  return `${dossier}/${id}/${randomUUID()}.${ext}`;
}

export function creerStockageR2(config: ConfigR2, client?: S3Client): Stockage {
  const s3 = client ?? new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return {
    async envoyer(cle, contenu, typeMime) {
      await s3.send(new PutObjectCommand({ Bucket: config.bucket, Key: cle, Body: contenu, ContentType: typeMime }));
    },
    async urlSignee(cle, dureeSecondes = DUREE_LIEN_SECONDES) {
      return getSignedUrl(s3, new GetObjectCommand({ Bucket: config.bucket, Key: cle }), { expiresIn: dureeSecondes });
    },
    async supprimer(cle) {
      await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: cle }));
    },
  };
}
