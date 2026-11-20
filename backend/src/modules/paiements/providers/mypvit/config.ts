// Configuration du client PVit (MyPVit).
// Toutes les valeurs viennent de l'environnement serveur. Aucune valeur sensible n'est écrite dans ce fichier.

export interface MyPvitCodes {
  secret: string;
  payment: string;
  link: string;
  status: string;
  fees: string;
  countries: string;
  operators: string;
  qrcode: string;
  balance: string;
}

export type MyPvitAccountKey = 'DEFAULT' | 'AIRTEL_MONEY' | 'MOOV_MONEY' | 'CARD';
export type MyPvitAccounts = Partial<Record<MyPvitAccountKey, string>>;

export interface MyPvitConfig {
  baseUrl: string;
  // Un compte d'opération par opérateur ; DEFAULT sert de repli (compte unique).
  accounts: MyPvitAccounts;
  // Adresse enregistrée chez MyPVit pour recevoir la clé secrète par webhook, si le compte l'exige.
  receptionUrlCode: string | null;
  // IP autorisées à appeler les webhooks MyPVit (callbacks et réception de clé).
  webhookAllowedIps: string[];
  password: string;
  agent: string;
  product: string;
  callbackUrlCode: string;
  codes: MyPvitCodes;
  timeoutMs: number;
}

const REQUIRED = [
  'MYPVIT_PASSWORD',
  'MYPVIT_AGENT',
  'MYPVIT_PRODUCT',
  'MYPVIT_CALLBACK_URL_CODE',
  'MYPVIT_CODE_SECRET',
  'MYPVIT_CODE_PAYMENT',
  'MYPVIT_CODE_LINK',
  'MYPVIT_CODE_STATUS',
  'MYPVIT_CODE_FEES',
  'MYPVIT_CODE_COUNTRIES',
  'MYPVIT_CODE_OPERATORS',
  'MYPVIT_CODE_QRCODE',
  'MYPVIT_CODE_BALANCE',
];

// Ne liste que les NOMS des variables manquantes, jamais leurs valeurs.
export function loadMyPvitConfig(env: Record<string, string | undefined>): MyPvitConfig {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (!env.MYPVIT_OPERATION_ACCOUNT_CODE && !env.MYPVIT_OPERATION_ACCOUNT_CODE_AIRTEL && !env.MYPVIT_OPERATION_ACCOUNT_CODE_MOOV && !env.MYPVIT_OPERATION_ACCOUNT_CODE_CARD) {
    missing.push('MYPVIT_OPERATION_ACCOUNT_CODE (au moins un compte)');
  }
  // Liste des IP des callbacks : obligatoire en production (une liste vide laisserait n'importe quel appelant envoyer un callback),
  // et chaque adresse doit être une IPv4 valide, sinon le filtrage échouerait sans signal clair.
  const ipsRenseignees = (env.MYPVIT_WEBHOOK_ALLOWED_IPS ?? '').split(',').map((ip) => ip.trim()).filter(Boolean);
  if (env.APP_ENV === 'production' && ipsRenseignees.length === 0) {
    missing.push('MYPVIT_WEBHOOK_ALLOWED_IPS (obligatoire en production)');
  }
  const ipInvalides = ipsRenseignees.filter((ip) => !/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(ip));
  if (ipInvalides.length > 0) {
    missing.push(`MYPVIT_WEBHOOK_ALLOWED_IPS : adresse IPv4 invalide (${ipInvalides.length} entrée(s))`);
  }
  if (missing.length > 0) {
    throw new Error(`Configuration PVit incomplète : ${missing.join(', ')}`);
  }
  const v = (key: string): string => env[key] as string;
  return {
    baseUrl: env.MYPVIT_BASE_URL || 'https://api.mypvit.pro',
    accounts: {
      DEFAULT: env.MYPVIT_OPERATION_ACCOUNT_CODE || undefined,
      AIRTEL_MONEY: env.MYPVIT_OPERATION_ACCOUNT_CODE_AIRTEL || undefined,
      MOOV_MONEY: env.MYPVIT_OPERATION_ACCOUNT_CODE_MOOV || undefined,
      CARD: env.MYPVIT_OPERATION_ACCOUNT_CODE_CARD || undefined,
    },
    receptionUrlCode: env.MYPVIT_RECEPTION_URL_CODE || null,
    webhookAllowedIps: (env.MYPVIT_WEBHOOK_ALLOWED_IPS ?? '').split(',').map((ip) => ip.trim()).filter(Boolean),
    password: v('MYPVIT_PASSWORD'),
    agent: v('MYPVIT_AGENT'),
    product: v('MYPVIT_PRODUCT'),
    callbackUrlCode: v('MYPVIT_CALLBACK_URL_CODE'),
    codes: {
      secret: v('MYPVIT_CODE_SECRET'),
      payment: v('MYPVIT_CODE_PAYMENT'),
      link: v('MYPVIT_CODE_LINK'),
      status: v('MYPVIT_CODE_STATUS'),
      fees: v('MYPVIT_CODE_FEES'),
      countries: v('MYPVIT_CODE_COUNTRIES'),
      operators: v('MYPVIT_CODE_OPERATORS'),
      qrcode: v('MYPVIT_CODE_QRCODE'),
      balance: v('MYPVIT_CODE_BALANCE'),
    },
    timeoutMs: Number(env.MYPVIT_TIMEOUT_MS || 15000),
  };
}
