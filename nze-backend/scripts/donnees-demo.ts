// Données de démonstration pour tester l'application en local : comptes, commerçant, articles, livraison, réglages.
// Refusé en production. Les mots de passe ci-dessous ne valent que pour la base locale de test.
import { and, eq, isNull } from 'drizzle-orm';
import { createDb } from '../src/db/client.ts';
import { users } from '../src/db/schema.ts';
import { hashMotDePasse } from '../src/core/security.ts';
import { creerAdministrateur } from '../src/modules/auth/service.ts';

if (process.env.APP_ENV === 'production') throw new Error('Données de démonstration refusées en production.');
const BASE = process.env.URL_SERVEUR ?? 'http://localhost:3999';
const MOT_DE_PASSE = 'demo-nze-2026';
const ADMIN = '+24101000001';
const COMMERCANT = '+24176000001';
const LIVREUR = '+24177000001';
const CLIENT = '+24174000001';

async function api(chemin: string, corps?: unknown, jeton?: string, methode = corps === undefined ? 'GET' : 'POST') {
  const r = await fetch(BASE + chemin, {
    method: methode,
    headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const texte = await r.text();
  let donnees: any = texte;
  try { donnees = JSON.parse(texte); } catch { /* réponse non JSON */ }
  return { status: r.status, donnees };
}

function attendre(reponse: { status: number; donnees: any }, etape: string, attendu = [200, 201, 204]) {
  if (!attendu.includes(reponse.status)) throw new Error(`${etape} : réponse ${reponse.status}`);
  return reponse.donnees;
}

// Connexion, ou création du compte s'il n'existe pas encore.
async function jetonDe(telephone: string, nom: string): Promise<{ token: string; id: string }> {
  const c = await api('/auth/connexion', { telephone, motDePasse: MOT_DE_PASSE });
  if (c.status === 200) return { token: c.donnees.token, id: c.donnees.utilisateur.id };
  const i = attendre(await api('/auth/inscription', { telephone, motDePasse: MOT_DE_PASSE, nomAffiche: nom }), `inscription ${nom}`, [201]);
  return { token: i.token, id: i.utilisateur.id };
}

const db = createDb(process.env.DATABASE_URL ?? '');
try {
  // L'administrateur de démonstration doit toujours pouvoir se connecter : rôle, puis mot de passe s'il n'en a pas.
  await creerAdministrateur(db.db, ADMIN, 'admin_principal');
  await db.db.update(users).set({ motDePasseHash: await hashMotDePasse(MOT_DE_PASSE) })
    .where(and(eq(users.telephone, ADMIN), isNull(users.motDePasseHash)));
  const adminConnecte = (await api('/auth/connexion', { telephone: ADMIN, motDePasse: MOT_DE_PASSE })).donnees.token as string | undefined;
  if (!adminConnecte) throw new Error('Connexion administrateur impossible (mot de passe absent ou différent). Supprimez le dossier nze-local-pg et relancez le démarrage.');

  const commercantDeja = await api('/auth/connexion', { telephone: COMMERCANT, motDePasse: MOT_DE_PASSE });
  if (commercantDeja.status === 200) {
    console.log('Données de démonstration déjà en place. Administrateur prêt.');
  } else {
    const admin = adminConnecte;

    const entreprise = attendre(await api('/admin/entreprises', { nom: 'Boutique démo' }, admin), 'entreprise').id;
    attendre(await api('/admin/commissions', { entrepriseId: entreprise, tauxBps: 1500 }, admin), 'commission');
    attendre(await api('/admin/partenaires', { telephone: COMMERCANT, entrepriseId: entreprise, motDePasse: MOT_DE_PASSE }, admin), 'commerçant', [200, 201]);
    attendre(await api('/admin/livraison/point-fixe', { libelle: 'Point NZE Libreville', latitude: 0.39, longitude: 9.454 }, admin), 'point fixe');
    attendre(await api('/admin/livraison/tarif', { fcfaParKm: 300, minimumFcfa: 500 }, admin), 'tarif');

    const articles = [
      { nom: 'Téléphone démo', prixFcfa: 85000, echelonnable: true },
      { nom: 'Chargeur démo', prixFcfa: 5000, echelonnable: false },
      { nom: 'T-shirt démo', prixFcfa: 12000, echelonnable: false },
    ];
    for (const a of articles) {
      const p = attendre(await api('/admin/produits', { entrepriseId: entreprise, nom: a.nom, prixFcfa: a.prixFcfa }, admin), `article ${a.nom}`);
      attendre(await api(`/admin/produits/${p.id}/ajustements`, { delta: 20, motif: 'Stock de démonstration' }, admin), `stock ${a.nom}`);
      if (a.echelonnable) {
        attendre(await api(`/admin/produits/${p.id}/echelonnable`, { echelonnable: true, dureeMois: 3 }, admin, 'PATCH'), `échelonnement ${a.nom}`);
      }
    }
    attendre(await api('/admin/reglages/echelonnement', { actif: true }, admin, 'PUT'), 'réglage échelonnement');

    const livreur = await jetonDe(LIVREUR, 'Livreur démo');
    attendre(await api(`/admin/utilisateurs/${livreur.id}/role`, { role: 'livreur' }, admin), 'rôle livreur');
    await jetonDe(CLIENT, 'Client démo');
    console.log('Données de démonstration créées.');
  }
  console.log('');
  console.log('Comptes de démonstration (local uniquement) :');
  console.log(`  Administration : ${ADMIN}  mot de passe : ${MOT_DE_PASSE}`);
  console.log(`  Commerçant     : ${COMMERCANT}  mot de passe : ${MOT_DE_PASSE}`);
  console.log(`  Livreur        : ${LIVREUR}  mot de passe : ${MOT_DE_PASSE}`);
  console.log(`  Client         : ${CLIENT}  mot de passe : ${MOT_DE_PASSE}`);
} catch (erreur) {
  console.error('Échec des données de démonstration :', erreur instanceof Error ? erreur.message : erreur);
  process.exitCode = 1;
} finally {
  await db.pool.end();
}
