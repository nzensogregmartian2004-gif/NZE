// Notifications push : un appareil appartient à un seul compte, seul le propriétaire le retire, rien n'est envoyé sans
// configuration Firebase, les jetons périmés sont retirés, et une notification non envoyée reste à réessayer.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { notifier } from '../src/modules/notifications/service.ts';
import { envoyerNotificationsEnAttente, type EnvoyeurPush, type MessagePush } from '../src/modules/push/service.ts';
import { api, connecter, demarrerBase, demarrerContexte, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let ana: Session;
let bruno: Session;

const JETON_ANA = 'jeton-appareil-ana-0000000001';
const JETON_ANA_PERIME = 'jeton-appareil-ana-perime-0002';
const JETON_BRUNO = 'jeton-appareil-bruno-0000000003';

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  ana = await connecter(ctx, '+24174800001');
  bruno = await connecter(ctx, '+24174800002');
});
after(async () => {
  await ctx.close();
  await base.stop();
});

const jetonsDe = async (userId: string) =>
  (await base.pool.query('select jeton from appareils_push where user_id = $1 order by jeton', [userId])).rows.map((r) => r.jeton as string);
const notificationDe = async (userId: string, titre: string) =>
  (await base.pool.query('select id, poussee_le from notifications where destinataire_id = $1 and titre = $2 order by created_at desc limit 1', [userId, titre])).rows[0];

// Envoyeur de test : enregistre les envois, peut signaler des jetons périmés ou simuler une panne réseau.
function envoyeurFactice(opts: { invalides?: string[]; echec?: boolean } = {}) {
  const appels: { jetons: string[]; message: MessagePush }[] = [];
  const envoyeur: EnvoyeurPush = {
    async envoyer(jetons, message) {
      appels.push({ jetons, message });
      if (opts.echec) throw new Error('réseau indisponible');
      return { invalides: jetons.filter((j) => opts.invalides?.includes(j) ?? false) };
    },
  };
  return { envoyeur, appels };
}

test('enregistrement : un appareil par jeton, sans doublon ; un jeton rattaché au compte qui le déclare', async () => {
  assert.equal((await api(ctx, 'POST', '/appareils', { token: ana.token, body: { jeton: JETON_ANA, plateforme: 'android' } })).status, 204);
  await api(ctx, 'POST', '/appareils', { token: ana.token, body: { jeton: JETON_ANA, plateforme: 'android' } });
  assert.deepEqual(await jetonsDe(ana.id), [JETON_ANA], 'pas de doublon');
  await api(ctx, 'POST', '/appareils', { token: bruno.token, body: { jeton: JETON_ANA, plateforme: 'android' } });
  assert.deepEqual(await jetonsDe(ana.id), [], 'le jeton a changé de compte');
  assert.deepEqual(await jetonsDe(bruno.id), [JETON_ANA]);
  await api(ctx, 'POST', '/appareils', { token: ana.token, body: { jeton: JETON_ANA, plateforme: 'android' } });
  await api(ctx, 'POST', '/appareils', { token: ana.token, body: { jeton: JETON_ANA_PERIME, plateforme: 'android' } });
  assert.deepEqual(await jetonsDe(ana.id), [JETON_ANA, JETON_ANA_PERIME]);
});

test('enregistrement refusé pour une plateforme inconnue ou un jeton trop court', async () => {
  assert.equal((await api(ctx, 'POST', '/appareils', { token: ana.token, body: { jeton: JETON_ANA, plateforme: 'web' } })).status, 400);
  assert.equal((await api(ctx, 'POST', '/appareils', { token: ana.token, body: { jeton: 'court', plateforme: 'android' } })).status, 400);
});

test('suppression : chacun ne retire que ses propres appareils', async () => {
  await api(ctx, 'DELETE', '/appareils', { token: bruno.token, body: { jeton: JETON_ANA } });
  assert.deepEqual(await jetonsDe(ana.id), [JETON_ANA, JETON_ANA_PERIME], 'bruno ne peut pas retirer l’appareil d’ana');
  await api(ctx, 'DELETE', '/appareils', { token: ana.token, body: { jeton: JETON_ANA_PERIME } });
  assert.deepEqual(await jetonsDe(ana.id), [JETON_ANA]);
});

test('sans configuration Firebase, aucune notification n’est envoyée ni marquée', async () => {
  await notifier(base.db, { destinataireId: ana.id, type: 'TEST_PUSH', titre: 'Sans configuration', message: 'Message test' });
  const bilan = await envoyerNotificationsEnAttente(base.db, null);
  assert.equal(bilan.configure, false);
  assert.equal((await notificationDe(ana.id, 'Sans configuration')).poussee_le, null);
});

test('envoi : seuls les appareils du destinataire reçoivent la notification ; les jetons périmés sont retirés ; la notification est marquée', async () => {
  await api(ctx, 'POST', '/appareils', { token: bruno.token, body: { jeton: JETON_BRUNO, plateforme: 'android' } });
  await api(ctx, 'POST', '/appareils', { token: ana.token, body: { jeton: JETON_ANA_PERIME, plateforme: 'android' } });
  // Vide d'abord les envois restés en attente : sinon un jeton périmé serait retiré avant ce test.
  await envoyerNotificationsEnAttente(base.db, envoyeurFactice().envoyeur);
  await notifier(base.db, { destinataireId: ana.id, type: 'TEST_PUSH', titre: 'Envoi test', message: 'Votre collecte est validée' });
  const { envoyeur, appels } = envoyeurFactice({ invalides: [JETON_ANA_PERIME] });
  const bilan = await envoyerNotificationsEnAttente(base.db, envoyeur);
  assert.equal(bilan.configure, true);
  const envoiAna = appels.find((a) => a.message.titre === 'Envoi test');
  assert.ok(envoiAna, 'la notification d’ana est envoyée');
  assert.deepEqual([...envoiAna.jetons].sort(), [JETON_ANA, JETON_ANA_PERIME].sort());
  assert.ok(!appels.some((a) => a.message.titre === 'Envoi test' && a.jetons.includes(JETON_BRUNO)), 'jamais vers l’appareil d’un autre compte');
  assert.deepEqual(await jetonsDe(ana.id), [JETON_ANA], 'jeton périmé retiré');
  assert.ok((await notificationDe(ana.id, 'Envoi test')).poussee_le, 'notification marquée');
  assert.ok(bilan.supprimes >= 1);
});

test('échec d’envoi : la notification reste à réessayer, puis part au passage suivant', async () => {
  await notifier(base.db, { destinataireId: ana.id, type: 'TEST_PUSH', titre: 'Echec test', message: 'Message' });
  await envoyerNotificationsEnAttente(base.db, envoyeurFactice({ echec: true }).envoyeur);
  assert.equal((await notificationDe(ana.id, 'Echec test')).poussee_le, null, 'non marquée après une panne');
  const reprise = envoyeurFactice();
  await envoyerNotificationsEnAttente(base.db, reprise.envoyeur);
  assert.ok((await notificationDe(ana.id, 'Echec test')).poussee_le, 'marquée après la reprise');
  assert.ok(reprise.appels.some((a) => a.message.titre === 'Echec test'), 'renvoyée au passage suivant');
});
