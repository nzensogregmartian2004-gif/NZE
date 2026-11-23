// Tests du client PVit. Aucun appel réseau réel : fetch est simulé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMyPvitConfig } from '../providers/mypvit/config.ts';
import { MyPvitClient, MyPvitError } from '../providers/mypvit/client.ts';
import { toInitiationStatus, toNzeStatus } from '../providers/mypvit/status.ts';

const ENV: Record<string, string> = {
  MYPVIT_OPERATION_ACCOUNT_CODE: 'ACC_TEST',
  MYPVIT_PASSWORD: 'pwd-test-123',
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

const SECRET = 'sk_test_1';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Simule PVit : renouvellement de clé, initiation, lien, statut.
function fakePvit(overrides: Record<string, (url: string) => Response> = {}) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> | null }[] = [];
  const fetchImpl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const brut = init?.body ? String(init.body) : null;
    const formulaire = (headers['Content-Type'] ?? '').includes('x-www-form-urlencoded');
    const body = brut === null ? null : formulaire ? (Object.fromEntries(new URLSearchParams(brut)) as Record<string, unknown>) : (JSON.parse(brut) as Record<string, unknown>);
    calls.push({ url, headers, body });
    for (const [key, handler] of Object.entries(overrides)) {
      if (url.includes(key)) return handler(url);
    }
    if (url.includes('/renew-secret')) return json({ operation_account_code: 'ACC_TEST', secret: SECRET, expires_in: 3600 });
    if (url.includes('/PAY_CODE/rest')) return json({ status: 'SUCCESS', status_code: '200', reference_id: 'PAY1', merchant_reference_id: 'REF1', message: 'Demande acceptée' });
    if (url.includes('/LINK_CODE/link')) return json({ url: 'https://checkout.mypvit.pro/PAY1', merchantReferenceId: 'REF1', status: 'SUCCESS', statusCode: 200 });
    if (url.includes('/STATUS_CODE/status')) return json({ status: 'SUCCESS', amount: 150, fees: 3.5, operator: 'AIRTEL_MONEY', merchant_reference_id: 'REF1' });
    return json({}, 404);
  };
  return { calls, fetchImpl };
}

const makeClient = (fetchImpl: (input: string | URL, init?: RequestInit) => Promise<Response>, now = () => 0) =>
  new MyPvitClient(loadMyPvitConfig(ENV), { fetch: fetchImpl, now });

test('renouvelle la clé puis l’envoie dans X-Secret', async () => {
  const { calls, fetchImpl } = fakePvit();
  await makeClient(fetchImpl).initiatePayment({ reference: 'REF1', amount: 150, operatorCode: 'AIRTEL_MONEY', customerMsisdn: '074111111' });
  assert.ok(calls[0].url.includes('/v2/SECRET_CODE/renew-secret'));
  assert.equal(calls[1].headers['X-Secret'], SECRET);
});

test('le mot de passe PVit part dans le corps, jamais dans l’URL', async () => {
  const { calls, fetchImpl } = fakePvit();
  await makeClient(fetchImpl).initiatePayment({ reference: 'REF1', amount: 150, operatorCode: 'AIRTEL_MONEY', customerMsisdn: '074111111' });
  const renouvellement = calls.find((c) => c.url.includes('/renew-secret'));
  assert.ok(renouvellement, 'un renouvellement de clé est attendu');
  assert.ok(!renouvellement.url.includes(ENV.MYPVIT_PASSWORD), 'le mot de passe ne doit pas figurer dans l’URL');
  assert.equal(renouvellement.body?.password, ENV.MYPVIT_PASSWORD);
});

test('réutilise la clé tant qu’elle est valide', async () => {
  const { calls, fetchImpl } = fakePvit();
  const client = makeClient(fetchImpl);
  const input = { reference: 'REF1', amount: 150, operatorCode: 'AIRTEL_MONEY', customerMsisdn: '074111111' };
  await client.initiatePayment(input);
  await client.initiatePayment(input);
  assert.equal(calls.filter((c) => c.url.includes('/renew-secret')).length, 1);
});

test('renouvelle la clé avant son expiration', async () => {
  const { calls, fetchImpl } = fakePvit();
  let t = 0;
  const client = makeClient(fetchImpl, () => t);
  await client.getBalance().catch(() => undefined);
  t = (3600 - 240) * 1000; // à 4 minutes de l'échéance, dans la marge de 5 minutes
  await client.getBalance().catch(() => undefined);
  assert.equal(calls.filter((c) => c.url.includes('/renew-secret')).length, 2);
});

test('un paiement accepté par PVit reste PENDING, jamais SUCCESS', async () => {
  const { calls, fetchImpl } = fakePvit();
  const result = await makeClient(fetchImpl).initiatePayment({ reference: 'REF1', amount: 150, operatorCode: 'AIRTEL_MONEY', customerMsisdn: '074111111' });
  assert.equal(result.nzeStatus, 'PENDING');
  const body = calls.find((c) => c.url.includes('/rest'))!.body!;
  assert.equal(body.transaction_type, 'PAYMENT');
  assert.equal(body.owner_charge, 'CUSTOMER');
  assert.equal(body.operator_code, 'AIRTEL_MONEY');
  assert.equal(body.customer_account_number, '074111111');
  assert.equal(body.merchant_operation_account_code, 'ACC_TEST');
});

test('un versement partenaire utilise GIVE_CHANGE, jamais un remboursement client', async () => {
  const { calls, fetchImpl } = fakePvit();
  await makeClient(fetchImpl).initiatePartnerWithdrawal({ reference: 'RET2', amount: 50, operatorCode: 'MOOV_MONEY', customerMsisdn: '074111111' });
  const body = calls.find((c) => c.url.includes('/rest'))!.body!;
  assert.equal(body.transaction_type, 'GIVE_CHANGE');
  assert.equal(body.owner_charge, 'MERCHANT');
  assert.equal(body.operator_code, 'MOOV_MONEY');
});

test('le lien de paiement passe par la page PVit et reste PENDING', async () => {
  const { calls, fetchImpl } = fakePvit();
  const result = await makeClient(fetchImpl).createPaymentLink({ reference: 'REF1', amount: 150, successCode: 'SUCCESS123', failureCode: 'FAILURE123' });
  assert.equal(result.checkoutUrl, 'https://checkout.mypvit.pro/PAY1');
  assert.equal(result.nzeStatus, 'PENDING');
  const call = calls.find((c) => c.url.includes('/LINK_CODE/link'))!;
  assert.ok(!call.url.includes('/v2/'), 'le lien n’utilise pas le préfixe /v2/');
  assert.equal(call.body!.service, 'WEB');
});

test('le statut d’une transaction est traduit vers les statuts NZE', async () => {
  const { fetchImpl } = fakePvit();
  const status = await makeClient(fetchImpl).getTransactionStatus('PAY1');
  assert.equal(status.nzeStatus, 'SUCCESS');
  assert.equal(status.amount, 150);
  assert.equal(toNzeStatus('PENDING'), 'PENDING');
  assert.equal(toNzeStatus('FAILED'), 'FAILED');
  assert.equal(toNzeStatus('UNE_VALEUR_INCONNUE'), 'UNCERTAIN');
  assert.equal(toInitiationStatus('SUCCESS'), 'PENDING');
});

test('une erreur HTTP ne révèle ni la clé ni le mot de passe', async () => {
  const { fetchImpl } = fakePvit({ '/PAY_CODE/rest': () => json({ code: 'E500' }, 500) });
  const client = makeClient(fetchImpl);
  await assert.rejects(
    () => client.initiatePayment({ reference: 'REF1', amount: 150, operatorCode: 'AIRTEL_MONEY', customerMsisdn: '074111111' }),
    (err: unknown) => {
      assert.ok(err instanceof MyPvitError);
      assert.equal(err.status, 500);
      assert.equal(err.code, 'E500');
      assert.ok(!err.message.includes(SECRET));
      assert.ok(!err.message.includes(ENV.MYPVIT_PASSWORD));
      return true;
    },
  );
});

test('les données invalides sont refusées avant tout appel réseau', async () => {
  const { calls, fetchImpl } = fakePvit();
  const client = makeClient(fetchImpl);
  const base = { reference: 'REF1', amount: 150, operatorCode: 'AIRTEL_MONEY', customerMsisdn: '074111111' };
  await assert.rejects(() => client.initiatePayment({ ...base, amount: 0 }), /Montant invalide/);
  await assert.rejects(() => client.initiatePayment({ ...base, amount: 150.5 }), /Montant invalide/);
  await assert.rejects(() => client.initiatePayment({ ...base, reference: 'REF 1' }), /Référence invalide/);
  await assert.rejects(() => client.initiatePayment({ ...base, customerMsisdn: '+241 07 41' }), /Numéro invalide/);
  assert.equal(calls.length, 0);
});

test('la configuration signale les variables manquantes sans afficher de valeur', () => {
  const env = { ...ENV };
  delete env.MYPVIT_PASSWORD;
  assert.throws(() => loadMyPvitConfig(env), (err: Error) => {
    assert.ok(err.message.includes('MYPVIT_PASSWORD'));
    assert.ok(!err.message.includes(ENV.MYPVIT_OPERATION_ACCOUNT_CODE));
    return true;
  });
});
