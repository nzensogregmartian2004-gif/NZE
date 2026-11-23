// Client HTTP PVit (MyPVit).
// Référence : application en production (mypvit.client.ts) et collection Postman « PVit API — API Marchand ».
// Règles :
// - un compte d'opération par opérateur, et une clé secrète par compte : une clé n'est jamais envoyée avec le code d'un autre compte ;
// - la clé arrive dans la réponse de renouvellement, ou par webhook de réception (receptionUrlCode) ;
// - la clé X-Secret et le mot de passe ne sont jamais journalisés ni affichés dans une erreur ;
// - une réponse d'initiation n'est jamais un paiement réussi (voir status.ts).

import type { MyPvitAccountKey, MyPvitConfig } from './config.ts';
import { toInitiationStatus, toNzeStatus } from './status.ts';
import type { NzeStatus } from './status.ts';
import { assertAmount, assertMsisdn, assertReference } from './validation.ts';

export class MyPvitError extends Error {
  status: number | null;
  code: string | null;

  constructor(message: string, status: number | null, code: string | null) {
    super(message);
    this.name = 'MyPvitError';
    this.status = status;
    this.code = code;
  }
}

type Json = Record<string, unknown>;
type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface CallOptions {
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: Json;
  form?: boolean;
  authenticated?: boolean;
  accountCode?: string;
  retried?: boolean;
}

export interface InitiatePaymentInput {
  reference: string;
  amount: number;
  operatorCode: string;
  customerMsisdn: string;
  freeInfo?: string;
}

export interface PaymentLinkInput {
  reference: string;
  amount: number;
  successCode: string;
  failureCode: string;
  customerMsisdn?: string;
  freeInfo?: string;
}

export interface InitiationResult {
  nzeStatus: NzeStatus;
  referenceId: string | null;
  merchantReferenceId: string | null;
  message: string | null;
}

export interface StatusResult {
  nzeStatus: NzeStatus;
  rawStatus: string;
  amount: number | null;
  fees: number | null;
  operator: string | null;
  merchantReferenceId: string | null;
}

// Marge avant expiration : on renouvelle la clé 5 minutes avant son échéance.
const RENEW_MARGIN_MS = 5 * 60 * 1000;
// Délai d'attente d'une clé envoyée par webhook (référence : 15 s).
const DELIVERY_TIMEOUT_MS = 15_000;

interface Pending {
  accountCode: string;
  resolve: (secret: string) => void;
  timer: ReturnType<typeof setTimeout>;
}

const asJson = (data: unknown): Json => (data && typeof data === 'object' ? (data as Json) : {});
const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const asNumber = (value: unknown): number | null => (typeof value === 'number' ? value : null);

export class MyPvitClient {
  private readonly config: MyPvitConfig;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;
  // Une clé par compte : la clé d'un compte n'est jamais utilisée avec le code d'un autre.
  private readonly secrets = new Map<string, { value: string; expiresAt: number }>();
  // Un seul renouvellement à la fois par compte : les appels concurrents attendent la même clé.
  private readonly inflight = new Map<string, Promise<string>>();
  // Demandes de clé en attente d'un webhook, dans l'ordre d'envoi.
  private readonly pending: Pending[] = [];

  constructor(config: MyPvitConfig, options: { fetch?: FetchLike; now?: () => number } = {}) {
    this.config = config;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.now = options.now ?? (() => Date.now());
  }

  // Compte d'opération d'un opérateur : son compte, sinon le compte par défaut. Jamais le compte d'un autre opérateur.
  accountFor(operatorCode: string): string {
    const code = this.config.accounts[operatorCode as MyPvitAccountKey] ?? this.config.accounts.DEFAULT;
    if (!code) throw new MyPvitError(`Aucun compte MyPVit configuré pour ${operatorCode}`, null, 'PROVIDER_NOT_CONFIGURED');
    return code;
  }

  // Compte des liens de paiement (page PVit multi-canaux) : le compte par défaut, sinon le premier configuré.
  linkAccount(): string {
    const { DEFAULT, CARD, AIRTEL_MONEY, MOOV_MONEY } = this.config.accounts;
    const code = DEFAULT ?? CARD ?? AIRTEL_MONEY ?? MOOV_MONEY;
    if (!code) throw new MyPvitError('Aucun compte MyPVit configuré', null, 'PROVIDER_NOT_CONFIGURED');
    return code;
  }

  // Encaissement mobile money (Airtel Money, Moov Money). Le client valide sur son téléphone.
  async initiatePayment(input: InitiatePaymentInput): Promise<InitiationResult> {
    const accountCode = this.accountFor(input.operatorCode);
    const data = asJson(
      await this.call({
        method: 'POST',
        path: `/v2/${this.config.codes.payment}/rest`,
        body: this.paymentBody(input, 'PAYMENT', 'CUSTOMER', accountCode),
        accountCode,
      }),
    );
    return this.toInitiation(data);
  }

  // Versement Mobile Money vers un numéro de bénéficiaire (GIVE_CHANGE).
  // Réservé aux paiements sortants des commerçants ; jamais aux remboursements clients.
  async initiatePartnerWithdrawal(input: InitiatePaymentInput): Promise<InitiationResult> {
    const accountCode = this.accountFor(input.operatorCode);
    const data = asJson(
      await this.call({
        method: 'POST',
        path: `/v2/${this.config.codes.payment}/rest`,
        body: this.paymentBody(input, 'GIVE_CHANGE', 'MERCHANT', accountCode),
        accountCode,
      }),
    );
    return this.toInitiation(data);
  }

  // Lien de paiement multi-canaux : Airtel, Moov, et cartes Visa/Mastercard via la page sécurisée PVit.
  // NZE ne traite jamais les données de carte.
  async createPaymentLink(input: PaymentLinkInput): Promise<{ checkoutUrl: string; merchantReferenceId: string; nzeStatus: NzeStatus }> {
    const accountCode = this.linkAccount();
    const body: Json = {
      agent: this.config.agent,
      amount: assertAmount(input.amount),
      product: this.config.product,
      reference: assertReference(input.reference),
      service: 'WEB',
      callback_url_code: this.config.callbackUrlCode,
      merchant_operation_account_code: accountCode,
      transaction_type: 'PAYMENT',
      owner_charge: 'CUSTOMER',
      operator_owner_charge: 'MERCHANT',
      free_info: input.freeInfo ?? '',
      failed_redirection_url_code: input.failureCode,
      success_redirection_url_code: input.successCode,
      ...(input.customerMsisdn ? { customer_account_number: assertMsisdn(input.customerMsisdn) } : {}),
    };
    const data = asJson(await this.call({ method: 'POST', path: `/${this.config.codes.link}/link`, body, accountCode }));
    const checkoutUrl = asString(data.url);
    if (!checkoutUrl) {
      throw new MyPvitError('Réponse de lien de paiement inattendue', 200, null);
    }
    return {
      checkoutUrl,
      merchantReferenceId: asString(data.merchantReferenceId) ?? input.reference,
      nzeStatus: 'PENDING',
    };
  }

  // Statut d'une transaction, interrogé sur le compte qui l'a créée (opérateur, ou lien si aucun opérateur).
  async getTransactionStatus(
    transactionId: string,
    operation: 'PAYMENT' | 'GIVE_CHANGE' = 'PAYMENT',
    operatorCode: string | null = null,
  ): Promise<StatusResult> {
    const accountCode = operatorCode ? this.accountFor(operatorCode) : this.linkAccount();
    const data = asJson(
      await this.call({
        method: 'GET',
        path: `/${this.config.codes.status}/status`,
        query: {
          transactionId: assertReference(transactionId),
          accountOperationCode: accountCode,
          transactionOperation: operation,
        },
        accountCode,
      }),
    );
    const rawStatus = asString(data.status) ?? '';
    return {
      nzeStatus: toNzeStatus(rawStatus),
      rawStatus,
      amount: asNumber(data.amount),
      fees: asNumber(data.fees),
      operator: asString(data.operator),
      merchantReferenceId: asString(data.merchant_reference_id),
    };
  }

  // Frais appliqués à un montant. À afficher au client avant l'initiation.
  async getFees(amount: number, operatorCode: string, transactionType = 'PAYMENT'): Promise<{ fees: number; totalAmount: number }> {
    const accountCode = this.accountFor(operatorCode);
    const data = asJson(
      await this.call({
        method: 'GET',
        path: `/v2/${this.config.codes.fees}/get-fees`,
        query: {
          accountOperationCode: accountCode,
          transactionType,
          amount: assertAmount(amount),
          operatorCode,
        },
        accountCode,
      }),
    );
    const fees = asNumber(data.fees);
    const totalAmount = asNumber(data.totalAmount);
    if (fees === null || totalAmount === null) {
      throw new MyPvitError('Réponse de frais inattendue', 200, null);
    }
    return { fees, totalAmount };
  }

  // Opérateurs disponibles pour un pays. Appel public, sans clé.
  async listOperators(countryCode = 'GA'): Promise<unknown[]> {
    const data = await this.call({
      method: 'GET',
      path: `/v2/${this.config.codes.operators}/get-operators`,
      query: { 'country-code': countryCode },
      authenticated: false,
    });
    return Array.isArray(data) ? data : [data];
  }

  // Solde d'un compte d'opération marchand (le compte de l'opérateur, ou celui des liens si aucun).
  async getBalance(operatorCode: string | null = null): Promise<number> {
    const accountCode = operatorCode ? this.accountFor(operatorCode) : this.linkAccount();
    const data = asJson(
      await this.call({
        method: 'GET',
        path: `/${this.config.codes.balance}/balance`,
        query: { accountOperationCode: accountCode },
        accountCode,
      }),
    );
    const balance = asNumber(data.balance);
    if (balance === null) {
      throw new MyPvitError('Réponse de solde inattendue', 200, null);
    }
    return balance;
  }

  // Contrôle de connexion, sans paiement : obtient une clé pour chaque compte configuré.
  // La clé n'est jamais affichée ; un échec signale le compte concerné sans bloquer les autres.
  async verifierConnexions(
    log: (msg: string) => void = console.info,
    warn: (msg: string) => void = console.warn,
  ): Promise<void> {
    const comptes = Object.entries(this.config.accounts).filter((entree): entree is [string, string] => !!entree[1]);
    if (comptes.length === 0) {
      warn('[mypvit] contrôle au démarrage : aucun compte configuré (MYPVIT_OPERATION_ACCOUNT_CODE*).');
      return;
    }
    for (const [nom, code] of comptes) {
      try {
        await this.ensureSecret(code, true);
        log(`[mypvit] contrôle au démarrage : ${nom} — clé obtenue, connexion OK.`);
      } catch (err) {
        warn(`[mypvit] contrôle au démarrage : ${nom} — ÉCHEC : ${(err as Error).message}`);
      }
    }
  }

  // Réception d'une clé par webhook (route de réception). Routée au compte indiqué, sinon à la plus ancienne demande en attente.
  // Renvoie false si la clé ne correspond à aucune demande ni à aucun compte configuré.
  deliverSecret(secret: string, expiresIn: number, accountCode?: string | null): boolean {
    const configure = !!accountCode && this.isConfiguredAccount(accountCode);
    const demande = configure ? this.pending.find((p) => p.accountCode === accountCode) : this.pending[0];
    if (!demande && !configure) return false;
    const code = configure ? (accountCode as string) : (demande as Pending).accountCode;
    if (demande) {
      this.cancelDelivery(demande);
      demande.resolve(secret);
    }
    this.store(code, secret, expiresIn);
    return true;
  }

  // IP autorisées à appeler les webhooks MyPVit (liste vide : non filtré).
  webhookAllowedIps(): string[] {
    return this.config.webhookAllowedIps;
  }

  private isConfiguredAccount(code: string): boolean {
    return Object.values(this.config.accounts).includes(code);
  }

  private paymentBody(input: InitiatePaymentInput, transactionType: string, ownerCharge: string, accountCode: string): Json {
    return {
      agent: this.config.agent,
      amount: assertAmount(input.amount),
      product: this.config.product,
      reference: assertReference(input.reference),
      service: 'RESTFUL',
      callback_url_code: this.config.callbackUrlCode,
      customer_account_number: assertMsisdn(input.customerMsisdn),
      merchant_operation_account_code: accountCode,
      transaction_type: transactionType,
      owner_charge: ownerCharge,
      owner_charge_operator: 'CUSTOMER',
      free_info: input.freeInfo ?? '',
      operator_code: input.operatorCode,
    };
  }

  private toInitiation(data: Json): InitiationResult {
    return {
      nzeStatus: toInitiationStatus(data.status),
      referenceId: asString(data.reference_id),
      merchantReferenceId: asString(data.merchant_reference_id),
      message: asString(data.message),
    };
  }

  private store(accountCode: string, value: string, expiresIn: number): void {
    this.secrets.set(accountCode, { value, expiresAt: this.now() + expiresIn * 1000 });
  }

  // Demande une clé pour un compte. Elle vient dans la réponse, ou par webhook (attente bornée).
  // Le mot de passe part dans le corps (formulaire), jamais dans l'URL.
  private async renewSecret(accountCode: string): Promise<string> {
    const { promise, entry } = this.registerDelivery(accountCode);
    let data: Json;
    try {
      data = asJson(
        await this.call({
          method: 'POST',
          path: `/v2/${this.config.codes.secret}/renew-secret`,
          form: true,
          body: {
            operationAccountCode: accountCode,
            password: this.config.password,
            ...(this.config.receptionUrlCode ? { receptionUrlCode: this.config.receptionUrlCode } : {}),
          },
          authenticated: false,
        }),
      );
    } catch (err) {
      this.cancelDelivery(entry);
      throw err;
    }
    const secret = asString(data.secret);
    if (secret) {
      this.cancelDelivery(entry);
      this.store(accountCode, secret, asNumber(data.expires_in) ?? 3000);
      return secret;
    }
    return promise;
  }

  private async ensureSecret(accountCode: string, forceRenew = false): Promise<string> {
    const cached = this.secrets.get(accountCode);
    if (!forceRenew && cached && this.now() < cached.expiresAt - RENEW_MARGIN_MS) {
      return cached.value;
    }
    const running = this.inflight.get(accountCode);
    if (running) return running;
    const request = this.renewSecret(accountCode).finally(() => this.inflight.delete(accountCode));
    this.inflight.set(accountCode, request);
    return request;
  }

  private registerDelivery(accountCode: string): { promise: Promise<string>; entry: Pending } {
    let resolve!: (secret: string) => void;
    let reject!: (err: Error) => void;
    const promise = new Promise<string>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const entry: Pending = { accountCode, resolve, timer: undefined as unknown as ReturnType<typeof setTimeout> };
    entry.timer = setTimeout(() => {
      this.removePending(entry);
      reject(
        new MyPvitError(
          `MyPVit n'a pas envoyé la clé du compte dans le délai imparti (${DELIVERY_TIMEOUT_MS / 1000} s). Vérifie que l'URL de réception est enregistrée sous MYPVIT_RECEPTION_URL_CODE et joignable.`,
          null,
          'SECRET_TIMEOUT',
        ),
      );
    }, DELIVERY_TIMEOUT_MS);
    (entry.timer as unknown as { unref?: () => void }).unref?.();
    this.pending.push(entry);
    promise.catch(() => undefined);
    return { promise, entry };
  }

  private cancelDelivery(entry: Pending): void {
    clearTimeout(entry.timer);
    this.removePending(entry);
  }

  private removePending(entry: Pending): void {
    const idx = this.pending.indexOf(entry);
    if (idx !== -1) this.pending.splice(idx, 1);
  }

  // Appel authentifié. Sur 401 (clé refusée), la clé du compte est renouvelée et l'appel est rejoué une seule fois.
  private async call(opts: CallOptions): Promise<unknown> {
    try {
      return await this.send(opts);
    } catch (err) {
      if (err instanceof MyPvitError && err.status === 401 && opts.authenticated !== false && opts.accountCode && !opts.retried) {
        this.secrets.delete(opts.accountCode);
        return this.send({ ...opts, retried: true });
      }
      throw err;
    }
  }

  private async send(opts: CallOptions): Promise<unknown> {
    const url = new URL(`${this.config.baseUrl}${opts.path}`);
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    let payload: string | undefined;
    if (opts.body) {
      if (opts.form) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        payload = new URLSearchParams(Object.entries(opts.body).map(([k, v]) => [k, String(v)])).toString();
      } else {
        headers['Content-Type'] = 'application/json';
        headers['X-Callback-MediaType'] = 'application/json';
        payload = JSON.stringify(opts.body);
      }
    }
    if (opts.authenticated !== false) {
      if (!opts.accountCode) throw new MyPvitError('Compte MyPVit non précisé pour un appel authentifié', null, 'PROVIDER_NOT_CONFIGURED');
      headers['X-Secret'] = await this.ensureSecret(opts.accountCode);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(url, { method: opts.method, headers, body: payload, signal: controller.signal });
    } catch (err) {
      const reason = (err as Error).name === 'AbortError' ? 'délai dépassé' : 'erreur réseau';
      throw new MyPvitError(`Appel PVit impossible : ${reason}`, null, 'NETWORK');
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      // Le message ne contient ni l'URL, ni le corps de la requête, ni la clé ni le mot de passe.
      throw new MyPvitError(`PVit a répondu ${response.status}`, response.status, asString(asJson(data).code));
    }
    return data;
  }
}
