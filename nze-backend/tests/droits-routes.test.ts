// Contrôle des accès sur toutes les routes : inventaire complet, refus sans jeton, et matrice des rôles sur les routes sensibles.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createApp } from '../src/app.ts';
import { api, connecter, CapturingSender, demarrerBase, demarrerContexte, fakeGoogleMaps, fakeMypvit, jeuDeDonnees, promouvoir, SESSION_SECRET, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let pile: Couche[];
const ZERO = '00000000-0000-4000-8000-000000000000';

interface Couche { route?: { path: string; methods: Record<string, boolean> }; handle?: { stack?: Couche[] } }

// Toutes les routes déclarées, en parcourant la pile Express, sous-routeurs compris.
function lesRoutes(couches: Couche[]): { methode: string; chemin: string }[] {
  const sortie: { methode: string; chemin: string }[] = [];
  for (const c of couches) {
    if (c.route) {
      for (const m of Object.keys(c.route.methods)) sortie.push({ methode: m.toUpperCase(), chemin: c.route.path });
    } else if (c.handle?.stack) {
      sortie.push(...lesRoutes(c.handle.stack));
    }
  }
  return sortie;
}

// Nombre de routes déclarées dans le source : routes.ts de chaque module, plus app.ts.
function declarationsDansLeSource(): number {
  const dossier = new URL('../src/modules/', import.meta.url);
  const fichiers = readdirSync(dossier).map((m) => new URL(`${m}/routes.ts`, dossier)).filter((f) => existsSync(f));
  fichiers.push(new URL('../src/app.ts', import.meta.url));
  const motif = /\b(?:r|app)\.(?:get|post|put|patch|delete)\(/g;
  return fichiers.reduce((total, f) => total + (readFileSync(f, 'utf8').match(motif) ?? []).length, 0);
}

// Routes publiques, et seulement celles-ci : toute autre route doit exiger un jeton.
// Routes publiques, déduites du code (routes sans middleware d'accès) : inscription, connexion, renouvellement
// du mot de passe, catalogue, réglages affichés avant connexion, santé, et callback du fournisseur de paiement.
const PUBLIQUES = new Set([
  'GET /sante',
  'GET /legal',
  'GET /legal/:slug',
  'POST /auth/inscription',
  'POST /auth/connexion',
  'POST /auth/mot-de-passe/oubli',
  'POST /auth/mot-de-passe/reinitialiser',
  'GET /reglages/paiement-sur-place',
  'GET /categories',
  'GET /produits',
  'GET /produits/:id',
  // Fiches prestataires publiées (D-P6) : publiques comme le catalogue. Seules les fiches publiées sont renvoyées, sans donnée interne.
  'GET /prestataires',
  'GET /prestataires/:id',
  'POST /paiements/callback',
  // Réception de la clé MyPVit par webhook : publique par nature (MyPVit appelle la route). Protégée par la liste d'IP MyPVit ;
  // refusée (403) si la liste est vide ou si l'IP n'est pas autorisée.
  'POST /paiements/mypvit/secret',
]);

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  const app = createApp({
    config: { sessionSecret: SESSION_SECRET },
    db: base.db,
    mypvit: fakeMypvit().client,
    cartographie: fakeGoogleMaps().client,
    sender: new CapturingSender(),
    redirections: { successCode: 'SUCCESS123', failureCode: 'FAILURE123' },
  });
  pile = (app as unknown as { router: { stack: Couche[] } }).router.stack;
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('chaque route non publique refuse l’accès sans jeton (401), et les routes publiques sont exactement celles prévues', async () => {
  const toutes = lesRoutes(pile);
  const publiques = toutes.filter((r) => PUBLIQUES.has(`${r.methode} ${r.chemin}`));
  assert.equal(publiques.length, PUBLIQUES.size, 'une route publique attendue est absente, ou une nouvelle est publique sans être listée');
  const protegees = toutes.filter((r) => !PUBLIQUES.has(`${r.methode} ${r.chemin}`));
  // Complétude : chaque route déclarée dans le source doit être montée dans l'application (un routeur oublié se verrait ici).
  assert.equal(toutes.length, declarationsDansLeSource(), 'routes déclarées dans le source et routes montées dans l’application ne concordent pas');

  const echecs: string[] = [];
  for (const { methode, chemin } of protegees) {
    const url = chemin.replace(/:[a-zA-Z]+/g, ZERO);
    const r = await fetch(`${ctx.base}${url}`, {
      method: methode,
      headers: methode === 'GET' ? {} : { 'Content-Type': 'application/json' },
      body: methode === 'GET' ? undefined : '{}',
    });
    if (r.status !== 401) echecs.push(`${methode} ${chemin} répond ${r.status}`);
  }
  assert.deepEqual(echecs, [], 'routes accessibles sans jeton');
});

// Matrice : rôle attendu sur les routes sensibles. Un 403 est un refus de rôle ; 200 ou 404 signale un accès permis.
type Cas = [string, string, 'client' | 'partenaire' | 'livreur' | 'secondaire' | 'principal', number, unknown?];
const cas: Cas[] = [
  // Journal, tableaux de bord, paramètres : administration seulement, lecture du journal et réglages sensibles pour le principal
  ['GET', '/admin/journal', 'client', 403],
  ['GET', '/admin/journal', 'secondaire', 403],
  ['GET', '/admin/journal', 'principal', 200],
  ['GET', '/admin/tableau-de-bord', 'client', 403],
  ['GET', '/admin/tableau-de-bord', 'partenaire', 403],
  ['GET', '/admin/tableau-de-bord', 'livreur', 403],
  ['GET', '/admin/tableau-de-bord', 'secondaire', 200],
  ['PUT', '/admin/reglages/suivi-gps', 'secondaire', 403],
  ['PUT', '/admin/reglages/suivi-gps', 'principal', 200, { actif: false }],
  // Gestion des comptes et des droits : administrateur principal seulement
  ['POST', '/admin/administrateurs', 'secondaire', 403],
  ['POST', `/admin/utilisateurs/${ZERO}/role`, 'secondaire', 403],
  // Catalogue et paramétrage : administration, jamais le client ni le partenaire
  ['POST', '/admin/produits', 'client', 403],
  ['POST', '/admin/produits', 'partenaire', 403],
  ['POST', '/admin/commissions', 'partenaire', 403],
  ['POST', '/admin/livraison/tarif', 'client', 403],
  ['POST', '/admin/livraison/point-fixe', 'livreur', 403],
  ['PATCH', `/admin/entreprises/${ZERO}/emplacement`, 'partenaire', 403],
  // Prestataires publicitaires (D-P6) : fiches et demandes réservées à l'administration ; un client seul envoie une demande
  ['GET', '/admin/prestataires', 'client', 403],
  ['POST', '/admin/prestataires', 'partenaire', 403],
  ['GET', '/admin/demandes-prestataire', 'livreur', 403],
  ['PATCH', `/admin/demandes-prestataire/${ZERO}`, 'client', 403],
  ['POST', `/prestataires/${ZERO}/demandes`, 'secondaire', 403],
  // Récupération assistée du mot de passe : administrateur principal seulement (désactivée par défaut)
  ['POST', '/admin/recuperations-assistees', 'secondaire', 403],
  ['POST', '/admin/recuperations-assistees', 'client', 403],
  ['POST', `/admin/prestataires/${ZERO}/photo`, 'client', 403],
  // Livraisons : affectation par NZE, espace livreur, espace client
  ['POST', '/admin/livraisons', 'livreur', 403],
  ['POST', '/admin/livraisons', 'client', 403],
  ['GET', '/livreur/livraisons', 'client', 403],
  ['GET', '/livreur/livraisons', 'partenaire', 403],
  ['GET', '/livreur/livraisons', 'secondaire', 403],
  ['GET', '/livreur/tableau-de-bord', 'livreur', 200],
  ['GET', '/livreur/tableau-de-bord', 'partenaire', 403],
  ['GET', `/commandes/${ZERO}/livraison`, 'secondaire', 403],
  ['GET', `/commandes/${ZERO}/livraison`, 'client', 404],
  ['GET', '/partenaire/livraisons', 'client', 403],
  ['GET', '/partenaire/tableau-de-bord', 'partenaire', 200],
  // Collectes et bordereaux : livreur crée, administration voit, partenaire voit les siens
  ['POST', '/livreur/bordereaux', 'client', 403],
  ['GET', '/admin/bordereaux', 'partenaire', 403],
  // Finance : portefeuille et retraits pour le partenaire, décisions pour l'administration
  ['GET', '/partenaire/portefeuille', 'client', 403],
  ['GET', '/partenaire/ventes', 'client', 403],
  ['GET', '/partenaire/portefeuille', 'livreur', 403],
  ['GET', '/partenaire/portefeuille', 'partenaire', 200],
  ['GET', '/admin/retraits', 'partenaire', 403],
  ['POST', `/admin/retraits/${ZERO}/decision`, 'client', 403],
  ['POST', `/admin/retraits/${ZERO}/decision`, 'partenaire', 403],
  // Commandes : client seulement
  ['POST', '/commandes', 'secondaire', 403],
  ['GET', '/auth/moi', 'client', 200],
  // Réclamations : le client déclare, l'administration décide, les autres ne voient rien
  ['POST', '/reclamations', 'partenaire', 403],
  ['POST', '/reclamations', 'secondaire', 403],
  ['GET', '/reclamations', 'livreur', 403],
  ['GET', '/reclamations', 'client', 200],
  ['POST', `/admin/reclamations/${ZERO}/decision`, 'client', 403],
  // Notifications : chacun les siennes
  ['GET', '/notifications', 'partenaire', 200],
];

test('la matrice des rôles est respectée sur les routes sensibles', async () => {
  const admin = await connecter(ctx, '+24101000001');
  await promouvoir(base, '+24101000001', 'admin_principal');
  const secondaire = await connecter(ctx, '+24101000002');
  await promouvoir(base, '+24101000002', 'admin_secondaire');
  const jeu = await jeuDeDonnees(ctx, admin);
  const partenaire = await connecter(ctx, '+24176600061');
  // La création d'un partenaire définit son mot de passe (règle de l'administration). Réponse vérifiée.
  const creation = await api(ctx, 'POST', '/admin/partenaires', { token: admin.token, body: { telephone: '+24176600061', entrepriseId: jeu.entreprise.id, motDePasse: 'MotDePassePartenaire1' } });
  assert.ok(creation.status === 200 || creation.status === 201, `création du partenaire : ${creation.status} ${JSON.stringify(creation.body)}`);
  const partenaireSession: Session = await connecter(ctx, '+24176600061');
  void partenaire;
  const livreur = await connecter(ctx, '+24174700061');
  await api(ctx, 'POST', `/admin/utilisateurs/${livreur.id}/role`, { token: admin.token, body: { role: 'livreur' } });
  const client = await connecter(ctx, '+24174600061');
  const jetons: Record<string, string> = {
    client: client.token,
    partenaire: partenaireSession.token,
    livreur: livreur.token,
    secondaire: secondaire.token,
    principal: admin.token,
  };

  const echecs: string[] = [];
  for (const [methode, chemin, role, attendu, corps] of cas) {
    const r = await api(ctx, methode, chemin, { token: jetons[role], body: corps ?? (methode === 'GET' ? undefined : {}) });
    if (r.status !== attendu) echecs.push(`${methode} ${chemin} avec ${role} : attendu ${attendu}, reçu ${r.status}`);
  }
  assert.deepEqual(echecs, []);
});

test('la vue publique du catalogue ne révèle ni quantité, ni partenaire', async () => {
  const liste = await fetch(`${ctx.base}/produits`).then((r) => r.json());
  assert.ok(liste.length >= 1, 'au moins un produit publié');
  const interdits = ['disponible', 'reserve', 'quantite', 'entrepriseId', 'etablissementId', 'commission', 'tauxBps', 'statut'];
  for (const p of liste) {
    assert.deepEqual(Object.keys(p).filter((k) => interdits.includes(k)), [], `champ interdit dans la liste : ${p.nom}`);
    assert.equal(typeof p.enStock, 'boolean', 'la disponibilité est un booléen, jamais une quantité');
  }
  const detail = await fetch(`${ctx.base}/produits/${liste[0].id}`).then((r) => r.json());
  assert.deepEqual(Object.keys(detail).filter((k) => interdits.includes(k)), [], 'champ interdit dans le détail');
});
