// Comptes MyPVit par opérateur et clés par compte. Aucun appel réseau réel : fetch est simulé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMyPvitConfig } from '../providers/mypvit/config.ts';
import { MyPvitClient } from '../providers/mypvit/client.ts';
import { verdictVersement } from '../../finance/verdict-versement.ts';

const ENV: Record<string, string> = {
  MYPVIT_OPERATION_ACCOUNT_CODE_AIRTEL: 'ACC_AIRTEL',
  MYPVIT_OPERATION_ACCOUNT_CODE_MOOV: 'ACC_MOOV',
  MYPVIT_PASSWORD: 'pwd-test-123',
  MYPVIT_AGENT: 'AGENT_TEST',
  MYPVIT_PRODUCT: 'PRODUCT_TEST',
  MYPVIT_CALLBACK_URL_CODE: 'CB_TEST',
  MYPVIT_RECEPTION_URL_CODE: 'RECV_TEST',
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

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Simule PVit. Un compte listé dans `asynchrones` ne renvoie pas sa clé dans la réponse : elle arrive par webhook.
// Une requête dont la clé ne correspond pas au compte du corps reçoit AUTHENTIFICATION refusée, comme chez MyPVit.
function fakePvit(opts: { asynchrones?: string[]; echecRenouvellement?: string[] } = {}) {
  const appels: { cle: string | null; compte: string | null }[] = [];
  let client!: MyPvitClient;
  const fetchImpl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const brut = init?.body ? String(init.body) : '';
    if (url.includes('/renew-secret')) {
      const corps = Object.fromEntries(new URLSearchParams(brut)) as Record<string, string>;
      const compte = corps.operationAccountCode;
      if (opts.echecRenouvellement?.includes(compte)) return json({ message: 'refusé' }, 500);
      if (opts.asynchrones?.includes(compte)) {
        setImmediate(() => client.deliverSecret(`SEC_${compte}`, 3600, compte));
        return json({}, 202);
      }
      return json({ secret: `SEC_${compte}`, expires_in: 3600 });
    }
    const corps = brut ? (JSON.parse(brut) as Record<string, unknown>) : {};
    const cle = headers['X-Secret'] ?? null;
    const compte = typeof corps.merchant_operation_account_code === 'string' ? corps.merchant_operation_account_code : null;
    appels.push({ cle, compte });
    if (cle !== null && compte !== null && cle !== `SEC_${compte}`) {
      return json({ error: 'AUTHENTICATION_FAILED' }, 401);
    }
    if (url.includes('/PAY_CODE/rest')) {
      return json({ status: 'SUCCESS', status_code: '200', reference_id: 'PAY1', merchant_reference_id: 'REF1', message: 'ok' });
    }
    if (url.includes('/STATUS_CODE/status')) return json({ status: 'SUCCESS', amount: 150 });
    return json({}, 404);
  };
  client = new MyPvitClient(loadMyPvitConfig(ENV), { fetch: fetchImpl, now: () => 0 });
  return { appels, client };
}

test('chaque opérateur paie et verse avec son propre compte et sa propre clé', async () => {
  const { appels, client } = fakePvit();
  await client.initiatePayment({ reference: 'REF1', amount: 150, operatorCode: 'AIRTEL_MONEY', customerMsisdn: '074111111' });
  await client.initiatePayment({ reference: 'REF2', amount: 150, operatorCode: 'MOOV_MONEY', customerMsisdn: '077111111' });
  assert.equal(appels[0].compte, 'ACC_AIRTEL');
  assert.equal(appels[0].cle, 'SEC_ACC_AIRTEL');
  assert.equal(appels[1].compte, 'ACC_MOOV');
  assert.equal(appels[1].cle, 'SEC_ACC_MOOV');
});

test('la clé d’un compte n’est jamais envoyée avec le compte d’un autre', async () => {
  const { appels, client } = fakePvit();
  await client.initiatePayment({ reference: 'REF1', amount: 150, operatorCode: 'AIRTEL_MONEY', customerMsisdn: '074111111' });
  await client.initiatePartnerWithdrawal({ reference: 'RET1', amount: 50, operatorCode: 'MOOV_MONEY', customerMsisdn: '077111111' });
  assert.equal(appels.length, 2);
  assert.ok(appels.every((a) => a.cle === `SEC_${a.compte}`), 'aucune clé croisée entre comptes');
});

test('une clé reçue par webhook est routée au compte indiqué et utilisée ensuite', async () => {
  const { appels, client } = fakePvit({ asynchrones: ['ACC_MOOV'] });
  await client.initiatePartnerWithdrawal({ reference: 'RET1', amount: 50, operatorCode: 'MOOV_MONEY', customerMsisdn: '077111111' });
  assert.equal(appels.at(-1)?.cle, 'SEC_ACC_MOOV');
});

test('une clé reçue sans demande et sans compte connu est refusée', () => {
  const { client } = fakePvit();
  assert.equal(client.deliverSecret('SEC_X', 3600, 'ACC_INCONNU'), false);
  assert.equal(client.deliverSecret('SEC_X', 3600, null), false);
});

test('un compte non configuré pour un opérateur est refusé avant tout appel réseau', () => {
  const { client } = fakePvit();
  assert.throws(() => client.accountFor('CARD'), /Aucun compte MyPVit configuré pour CARD/);
});

test('le contrôle au démarrage signale le compte en échec sans bloquer les autres, sans afficher de clé', async () => {
  const { client } = fakePvit({ echecRenouvellement: ['ACC_MOOV'] });
  const journal: string[] = [];
  const alertes: string[] = [];
  await client.verifierConnexions((m) => journal.push(m), (m) => alertes.push(m));
  assert.ok(journal.some((m) => m.includes('AIRTEL_MONEY') && m.includes('connexion OK')), 'le compte Airtel est vérifié');
  assert.ok(alertes.some((m) => m.includes('MOOV_MONEY') && m.includes('ÉCHEC')), 'le compte Moov est signalé');
  assert.ok(!alertes.some((m) => m.includes('AIRTEL_MONEY')), 'Airtel n’est pas signalé à tort');
  assert.ok(![...journal, ...alertes].some((m) => m.includes('SEC_')), 'aucune clé dans les journaux');
});

test('un versement dont le montant ne correspond pas n’est jamais tenu pour versé', () => {
  assert.equal(verdictVersement({ nzeStatus: 'SUCCESS', amount: 4000 }, 4250), null, 'montant différent : pas de verdict');
  assert.equal(verdictVersement({ nzeStatus: 'SUCCESS', amount: 4250 }, 4250), 'VERSEE');
  assert.equal(verdictVersement({ nzeStatus: 'SUCCESS', amount: null }, 4250), 'VERSEE', 'sans montant renvoyé : le statut fait foi');
  assert.equal(verdictVersement({ nzeStatus: 'FAILED', amount: 4250 }, 4250), 'ECHEC');
  assert.equal(verdictVersement({ nzeStatus: 'PENDING', amount: null }, 4250), null, 'en attente : rien ne change');
});
