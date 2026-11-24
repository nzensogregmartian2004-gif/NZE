import { generateKeyPairSync } from 'node:crypto';
import { lireCleSupabase } from '../src/modules/realtime/jeton.ts';
import { rm } from 'node:fs/promises';
// Environnement de test : PostgreSQL embarqué, migrations réelles, application HTTP réelle, MyPVit simulé.
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { createApp } from '../src/app.ts';
import { createDb } from '../src/db/client.ts';
import { runMigrations } from '../src/db/migrate.ts';
import { loadMyPvitConfig, MyPvitClient } from '../src/modules/paiements/providers/mypvit/index.ts';
import type { OtpSender } from '../src/modules/auth/otp-sender.ts';
import { creerAdministrateur } from '../src/modules/auth/service.ts';
import { MapboxClient } from '../src/modules/cartographie/index.ts';
import { distanceMetres } from '../src/modules/livraisons/pricing.ts';
import { createServer, type AddressInfo } from 'node:net';

export const SESSION_SECRET = 'secret-de-test-plus-de-trente-deux-caracteres-ok';
export const ADMIN_PHONE = '+24101000001';

const MYPVIT_ENV: Record<string, string> = {
  MYPVIT_OPERATION_ACCOUNT_CODE: 'ACC_TEST',
  MYPVIT_PASSWORD: 'pwd-test',
  MYPVIT_AGENT: 'AGENT_TEST',
  MYPVIT_PRODUCT: 'PRODUCT_TEST',
  MYPVIT_CALLBACK_URL_CODE: 'CB_TEST',
  MYPVIT_CODE_SECRET: 'SECRET_CODE',
  MYPVIT_CODE_PAYMENT: 'PAY_CODE',
  MYPVIT_CODE_LINK: 'LINK_CODE',
  MYPVIT_CODE_STATUS: 'STATUS_CODE',
  MYPVIT_CODE_FEES: 'FEES_CODE',
  MYPVIT_CODE_COUNTRIES: 'COUNTRIES_CODE',
  MYPVIT_CODE_OPERATORS: 'OPERATORS_CODE',
  MYPVIT_CODE_QRCODE: 'QR_CODE',
  MYPVIT_CODE_BALANCE: 'BAL_CODE',
};

export class CapturingSender implements OtpSender {
  codes = new Map<string, string>();
  async send(telephone: string, code: string): Promise<void> {
    this.codes.set(telephone, code);
  }
}

// MyPVit simulé. Le statut réel d'une transaction se pilote par state.statusOverride ou state.defaultStatus.
export function fakeMypvit() {
  const state = {
    defaultStatus: 'SUCCESS' as string,
    statusOverride: new Map<string, { status: string; amount?: number | null }>(),
    amountByRef: new Map<string, number>(),
    initiationStatus: 'SUCCESS' as string,
    initiationFails: false,
  };
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchImpl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const path = url.pathname;
    if (path.includes('/renew-secret')) return json({ operation_account_code: 'ACC_TEST', secret: 'sk_fake', expires_in: 3600 });
    if (path.endsWith('/rest')) {
      const body = JSON.parse(String(init?.body));
      state.amountByRef.set(body.reference, body.amount);
      if (state.initiationFails) return json({ code: 'E1' }, 500);
      return json({ status: state.initiationStatus, status_code: '200', reference_id: `PAY_${body.reference}`, merchant_reference_id: body.reference, message: 'ok' });
    }
    if (path.endsWith('/link')) {
      const body = JSON.parse(String(init?.body));
      state.amountByRef.set(body.reference, body.amount);
      return json({ url: `https://checkout.test/${body.reference}`, merchantReferenceId: body.reference, status: 'SUCCESS', statusCode: 200 });
    }
    if (path.endsWith('/status')) {
      const id = url.searchParams.get('transactionId') ?? '';
      const ref = id.startsWith('PAY_') ? id.slice(4) : id;
      const ov = state.statusOverride.get(ref);
      const status = ov?.status ?? state.defaultStatus;
      const amount = ov && 'amount' in ov ? ov.amount : (state.amountByRef.get(ref) ?? null);
      return json({ status, amount, fees: 0, operator: 'AIRTEL_MONEY', merchant_reference_id: ref });
    }
    return json({}, 404);
  };
  const client = new MyPvitClient(loadMyPvitConfig(MYPVIT_ENV), { fetch: fetchImpl });
  return { client, state };
}

// Port réellement libre, demandé au système : évite que deux bases de test se disputent le même port
// (un tirage au hasard parmi quelques centaines de valeurs finit par collisionner sur une suite de 27 fichiers).
export async function portLibre(): Promise<number> {
  return new Promise((resoudre, rejeter) => {
    const serveur = createServer();
    serveur.unref();
    serveur.on('error', rejeter);
    serveur.listen(0, '127.0.0.1', () => {
      const { port } = serveur.address() as AddressInfo;
      serveur.close(() => resoudre(port));
    });
  });
}

export async function demarrerBase() {
  const port = await portLibre();
  const dir = join(tmpdir(), `nze-pg-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  const pgi = new EmbeddedPostgres({
    databaseDir: dir, user: 'nze', password: 'nze_test_pwd', port, persistent: false,
    createPostgresUser: true, onLog: () => {}, onError: () => {},
  });
  await pgi.initialise();
  await pgi.start();
  await pgi.createDatabase('nze_test');
  const url = `postgres://nze:nze_test_pwd@localhost:${port}/nze_test`;
  await runMigrations(url);
  const { pool, db } = createDb(url);
  return {
    url, db, pool,
    async stop() {
      // Arrêt tolérant : une base déjà arrêtée ou un arrêt lent ne doit pas faire échouer le fichier de test.
      await pool.end().catch(() => {});
      await pgi.stop().catch(() => {});
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

// Stockage en mémoire pour les tests : même interface que R2, aucun appel réseau.
export class StockageFactice {
  objets = new Map<string, { contenu: Buffer; typeMime: string }>();
  async envoyer(cle: string, contenu: Buffer, typeMime: string): Promise<void> { this.objets.set(cle, { contenu, typeMime }); }
  async urlSignee(cle: string): Promise<string> { return `https://fichiers.test/${cle}?signature=factice`; }
  async supprimer(cle: string): Promise<void> { this.objets.delete(cle); }
}

export interface Contexte {
  base: string;
  stockage: StockageFactice | null;
  sender: CapturingSender;
  mypvit: ReturnType<typeof fakeMypvit>;
  gmaps: ReturnType<typeof fakeGoogleMaps>;
  pool: pg.Pool;
  close: () => Promise<void>;
}

// Clé ES256 de test, générée à la volée (jamais la clé de production).
export function configRealtimeDeTest(url = 'https://projet-test.supabase.co') {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = { ...privateKey.export({ format: 'jwk' }), kid: 'cle-de-test' };
  return { url, cle: lireCleSupabase(JSON.stringify(jwk)) };
}

export async function demarrerContexte(base: Awaited<ReturnType<typeof demarrerBase>>, options: { recuperationAssistee?: boolean; sansStockage?: boolean; realtime?: boolean } = {}): Promise<Contexte> {
  const sender = new CapturingSender();
  const stockage = options.sansStockage ? null : new StockageFactice();
  const mypvit = fakeMypvit();
  const gmaps = fakeGoogleMaps();
  const app = createApp({
    config: { sessionSecret: SESSION_SECRET, recuperationAssistee: options.recuperationAssistee ?? false },
    db: base.db,
    mypvit: mypvit.client,
    cartographie: gmaps.client,
    sender,
    redirections: { successCode: 'SUCCESS123', failureCode: 'FAILURE123' },
    stockage,
    realtime: options.realtime ? configRealtimeDeTest() : null,
  });
  const server = app.listen(0);
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  return {
    base: `http://127.0.0.1:${port}`,
    stockage,
    gmaps,
    sender,
    mypvit,
    pool: base.pool,
    close: () => new Promise<void>((resolve) => {
      // Ferme aussi les connexions persistantes, sinon server.close n'appelle jamais son callback.
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}

export async function api(ctx: Contexte, method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(`${ctx.base}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

export interface Session { token: string; id: string; role: string; telephone: string }

export const MDP_TEST = 'motdepasse-test';

// Connexion par mot de passe. Si le compte n'existe pas encore, il est créé par inscription.
export async function connecter(ctx: Contexte, telephone: string, motDePasse = MDP_TEST): Promise<Session> {
  let r = await api(ctx, 'POST', '/auth/connexion', { body: { telephone, motDePasse } });
  if (r.status === 401) r = await api(ctx, 'POST', '/auth/inscription', { body: { telephone, motDePasse } });
  if (r.status !== 200 && r.status !== 201) throw new Error(`Connexion échouée : ${r.status} ${JSON.stringify(r.body)}`);
  return { token: r.body.token, id: r.body.utilisateur.id, role: r.body.utilisateur.role, telephone };
}

export async function sql<T = Record<string, unknown>>(ctx: Contexte, requete: string, valeurs: unknown[] = []): Promise<T[]> {
  const r = await ctx.pool.query(requete, valeurs);
  return r.rows as T[];
}

// Jeu de données de référence : une entreprise partenaire, un produit en stock, une commission, un point fixe et un tarif.
export async function jeuDeDonnees(ctx: Contexte, admin: Session) {
  const entreprise = (await api(ctx, 'POST', '/admin/entreprises', { token: admin.token, body: { nom: 'Boutique Test' } })).body;
  await api(ctx, 'POST', '/admin/commissions', { token: admin.token, body: { entrepriseId: entreprise.id, tauxBps: 1500 } });
  await api(ctx, 'POST', '/admin/livraison/point-fixe', { token: admin.token, body: { libelle: 'Point NZE', latitude: 0.39, longitude: 9.454 } });
  await api(ctx, 'POST', '/admin/livraison/tarif', { token: admin.token, body: { fcfaParKm: 300, minimumFcfa: 500 } });
  const produit = (
    await api(ctx, 'POST', '/admin/produits', {
      token: admin.token,
      body: { entrepriseId: entreprise.id, nom: 'Chargeur USB', prixFcfa: 5000, garantieJours: 7 },
    })
  ).body;
  await api(ctx, 'POST', `/admin/produits/${produit.id}/ajustements`, { token: admin.token, body: { delta: 3, motif: 'Stock initial de test' } });
  return { entreprise, produit };
}

// Donne un rôle d'administration à un compte existant (équivalent de la commande creer-admin).
export async function promouvoir(base: Awaited<ReturnType<typeof demarrerBase>>, telephone: string, role: 'admin_principal' | 'admin_secondaire' = 'admin_principal') {
  await creerAdministrateur(base.db, telephone, role);
}

export const CLE_GOOGLE_TEST = 'CLE_TEST_SECRETE';

// Simulation de l'API Google Distance Matrix, branchée sur le vrai client : le format de réponse et les erreurs sont donc testés.
// Par défaut, la distance renvoyée est la ligne droite (aucun changement pour les tests existants).
export function fakeGoogleMaps() {
  const state = {
    distanceM: null as number | null,
    dureeS: 900,
    statutGlobal: 'OK' as string,
    statutElement: 'OK' as string,
    reseauCoupe: false,
    appels: [] as string[],
    requetes: [] as { url: string }[],
  };
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchImpl = async (input: string | URL): Promise<Response> => {
    const url = new URL(String(input));
    state.appels.push(url.toString());
    state.requetes.push({ url: url.toString() });
    if (state.reseauCoupe) throw new TypeError('fetch failed');
    if (state.statutGlobal !== 'OK') return json({ message: 'Not Authorized - Invalid Token' }, 401);
    const paires = (url.pathname.split('/').pop() ?? '').split(';').map((p) => p.split(',').map(Number));
    const [lon1, lat1] = paires[0];
    const [lon2, lat2] = paires[1];
    const trouve = state.statutElement === 'OK';
    const d = trouve ? (state.distanceM ?? distanceMetres({ latitude: lat1, longitude: lon1 }, { latitude: lat2, longitude: lon2 })) : null;
    const t = trouve ? state.dureeS : null;
    return json({ code: 'Ok', durations: [[0, t], [t, 0]], distances: [[0, d], [d, 0]] });
  };
  const client = new MapboxClient({ cle: CLE_GOOGLE_TEST, fetch: fetchImpl });
  return { client, state };
}

// Produit rattaché à un magasin de son entreprise, avec du stock : une collecte exige un magasin renseigné (cahier §12).
export async function produitAvecMagasin(ctx: Contexte, admin: Session, entrepriseId: string, nom: string, prixFcfa: number): Promise<{ id: string; nom: string; entrepriseId: string }> {
  const etab = (await api(ctx, 'POST', '/admin/etablissements', { token: admin.token, body: { entrepriseId, nom: `Magasin ${nom}` } })).body;
  const p = (await api(ctx, 'POST', '/admin/produits', { token: admin.token, body: { entrepriseId, etablissementId: etab.id, nom, prixFcfa } })).body;
  await api(ctx, 'POST', `/admin/produits/${p.id}/ajustements`, { token: admin.token, body: { delta: 200, motif: 'Stock de test' } });
  return { id: p.id, nom, entrepriseId };
}

// Ligne de commande d'un client, payée et confiée à un livreur : seule une telle ligne peut être collectée (cahier §12).
export async function ligneConfiee(ctx: Contexte, admin: Session, client: Session, livreur: Session, produitId: string): Promise<string> {
  const c = await api(ctx, 'POST', '/commandes', { token: client.token, body: { lignes: [{ produitId, quantite: 1 }], reception: 'LIVRAISON', livraison: { latitude: 0.43496, longitude: 9.454 } } });
  if (c.status !== 201) throw new Error(`commande refusée : ${JSON.stringify(c.body)}`);
  const numero = '0' + client.telephone.slice(4);
  await api(ctx, 'POST', `/commandes/${c.body.id}/paiement`, { token: client.token, body: { canal: 'MOBILE_MONEY', operateur: 'AIRTEL_MONEY', numero } });
  const v = await api(ctx, 'POST', `/commandes/${c.body.id}/verifier-paiement`, { token: client.token });
  if (v.body.statut !== 'SUCCESS') throw new Error(`paiement non confirmé : ${JSON.stringify(v.body)}`);
  const a = await api(ctx, 'POST', '/admin/livraisons', { token: admin.token, body: { commandeId: c.body.id, livreurId: livreur.id, motif: 'LIVRAISON_COMMANDE' } });
  if (a.status !== 201) throw new Error(`affectation refusée : ${JSON.stringify(a.body)}`);
  const detail = await api(ctx, 'GET', `/commandes/${c.body.id}`, { token: client.token });
  return detail.body.lignes[0].id as string;
}

// Collecte complète : le livreur crée le bordereau, le commerçant confirme, l'administrateur principal valide.
export async function collecterEtValider(ctx: Contexte, admin: Session, livreur: Session, partenaire: Session, produit: { id: string; entrepriseId: string }, ligneCommandeId: string): Promise<void> {
  const b = await api(ctx, 'POST', '/livreur/bordereaux', { token: livreur.token, body: { entrepriseId: produit.entrepriseId, lignes: [{ produitId: produit.id, ligneCommandeId, quantite: 1, etat: 'Neuf, emballage d’origine', testEffectue: true, resultatTest: 'Fonctionne', controle: 'CONFORME' }] } });
  if (b.status !== 201) throw new Error(`bordereau refusé : ${JSON.stringify(b.body)}`);
  const r = await api(ctx, 'POST', `/partenaire/bordereaux/${b.body.id}/reponse`, { token: partenaire.token, body: { confirmer: true } });
  if (r.status !== 200) throw new Error(`confirmation refusée : ${JSON.stringify(r.body)}`);
  const v = await api(ctx, 'POST', `/admin/bordereaux/${b.body.id}/decision`, { token: admin.token, body: { valider: true } });
  if (v.body.statut !== 'VALIDE') throw new Error(`validation refusée : ${JSON.stringify(v.body)}`);
}

