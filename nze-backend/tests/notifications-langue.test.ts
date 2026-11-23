// Notifications serveur traduites : langue du compte du destinataire, repli français, paramètres sans traduction des chiffres.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { notifier } from '../src/modules/notifications/service.ts';
import { connecter, demarrerBase, demarrerContexte, api, sql, type Contexte, type Session } from './helpers.ts';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let ctx: Contexte;
let anglais: Session;
let arabe: Session;
let francais: Session;
let chinois: Session;

async function dernieres(session: Session): Promise<Array<{ titre: string; message: string; type: string }>> {
  const r = await api(ctx, 'GET', '/notifications', { token: session.token });
  return r.body as Array<{ titre: string; message: string; type: string }>;
}

before(async () => {
  base = await demarrerBase();
  ctx = await demarrerContexte(base);
  anglais = await connecter(ctx, '+24174600101');
  arabe = await connecter(ctx, '+24174600102');
  francais = await connecter(ctx, '+24174600103');
  chinois = await connecter(ctx, '+24174600104');
  await sql(ctx, "UPDATE users SET langue = 'en' WHERE id = $1", [anglais.id]);
  await sql(ctx, "UPDATE users SET langue = 'ar' WHERE id = $1", [arabe.id]);
  await sql(ctx, "UPDATE users SET langue = 'zh-Hans' WHERE id = $1", [chinois.id]);
});
after(async () => {
  await ctx.close();
  await base.stop();
});

test('un compte en anglais reçoit le titre et le message en anglais', async () => {
  await notifier(base.db, { destinataireId: anglais.id, type: 'RETRAIT_VERSE', titre: 'Retrait versé', message: 'Votre retrait a été versé sur votre compte Mobile Money.' });
  const [n] = (await dernieres(anglais)).filter((x) => x.type === 'RETRAIT_VERSE');
  assert.equal(n.titre, 'Withdrawal paid');
  assert.equal(n.message, 'Your withdrawal was paid to your Mobile Money account.');
});

test('un compte en arabe reçoit le texte en arabe', async () => {
  await notifier(base.db, { destinataireId: arabe.id, type: 'RETRAIT_VERSE', titre: 'Retrait versé', message: 'Votre retrait a été versé sur votre compte Mobile Money.' });
  const [n] = (await dernieres(arabe)).filter((x) => x.type === 'RETRAIT_VERSE');
  assert.equal(n.titre, 'تم دفع السحب');
});

test('un compte français garde le texte français d’origine', async () => {
  await notifier(base.db, { destinataireId: francais.id, type: 'RETRAIT_VERSE', titre: 'Retrait versé', message: 'Votre retrait a été versé sur votre compte Mobile Money.' });
  const [n] = (await dernieres(francais)).filter((x) => x.type === 'RETRAIT_VERSE');
  assert.equal(n.titre, 'Retrait versé');
  assert.equal(n.message, 'Votre retrait a été versé sur votre compte Mobile Money.');
});

test('les paramètres sont placés dans chaque langue, chiffres compris', async () => {
  await notifier(base.db, {
    destinataireId: chinois.id, type: 'RECLAMATION_RECUE', titre: 'Réclamation enregistrée',
    message: 'NZE examine votre réclamation et vous répond dans un délai de 72 heures.', parametres: { delai: 72 },
  });
  const [n] = (await dernieres(chinois)).filter((x) => x.type === 'RECLAMATION_RECUE');
  assert.ok(n.message.includes('72'), n.message);
  assert.ok(n.message.includes('小时'), n.message);
});

test('un type sans traduction garde son texte d’origine dans toutes les langues', async () => {
  await notifier(base.db, { destinataireId: anglais.id, type: 'ECHELONNEMENT_ACTIF', titre: 'Paiement échelonné démarré', message: 'Avance réglée. Reste 1000 FCFA.' });
  const [n] = (await dernieres(anglais)).filter((x) => x.type === 'ECHELONNEMENT_ACTIF');
  assert.equal(n.titre, 'Paiement échelonné démarré');
  assert.equal(n.message, 'Avance réglée. Reste 1000 FCFA.');
});

test('une variante par destinataire : le partenaire et le collecteur ne reçoivent pas le même texte', async () => {
  await notifier(base.db, { destinataireId: anglais.id, type: 'COLLECTE_VALIDEE', cle: 'COLLECTE_VALIDEE.partenaire', titre: 'x', message: 'x' });
  await notifier(base.db, { destinataireId: anglais.id, type: 'COLLECTE_VALIDEE', cle: 'COLLECTE_VALIDEE.collecteur', titre: 'y', message: 'y' });
  const recus = (await dernieres(anglais)).filter((x) => x.type === 'COLLECTE_VALIDEE');
  assert.deepEqual(recus.map((x) => x.titre).sort(), ['Collection validated', 'Collection validated by NZE']);
});
