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

// Agent et produit envoyés à MyPVit : valeurs reprises de l'application qui fonctionne actuellement.
// Elles peuvent être remplacées par MYPVIT_AGENT et MYPVIT_PRODUCT dans Render (à demander à MyPVit pour NZE avant la production).
const AGENT_PAR_DEFAUT = 'AIFI-APP';
const PRODUIT_PAR_DEFAUT = 'AIFI';

// Noms alternatifs acceptés pour les mêmes valeurs MyPVit (noms utilisés dans l'autre application du propriétaire).
// Si le nom NZE est absent mais que le nom alternatif est renseigné, la valeur du nom alternatif est reprise.
const NOMS_ALTERNATIFS: Record<string, string> = {
  MYPVIT_PASSWORD: 'MYPVIT_API_PASSWORD',
  MYPVIT_CODE_SECRET: 'MYPVIT_URLCODE_RENEW_SECRET',
  MYPVIT_CODE_PAYMENT: 'MYPVIT_URLCODE_REST',
  MYPVIT_CODE_LINK: 'MYPVIT_URLCODE_LINK',
  MYPVIT_CODE_STATUS: 'MYPVIT_URLCODE_STATUS',
  MYPVIT_CODE_FEES: 'MYPVIT_URLCODE_GET_FEES',
  MYPVIT_CODE_COUNTRIES: 'MYPVIT_URLCODE_GET_COUNTRIES',
  MYPVIT_CODE_OPERATORS: 'MYPVIT_URLCODE_GET_OPERATORS',
  MYPVIT_CODE_QRCODE: 'MYPVIT_URLCODE_QR_CODE',
  MYPVIT_CODE_BALANCE: 'MYPVIT_URLCODE_BALANCE',
};

function resoudreNomsAlternatifs(brut: Record<string, string | undefined>): Record<string, string | undefined> {
  const env = { ...brut };
  for (const [nom, alternatif] of Object.entries(NOMS_ALTERNATIFS)) {
    if (!env[nom] && env[alternatif]) env[nom] = env[alternatif];
  }
  return env;
}

// Ne liste que les NOMS des variables manquantes, jamais leurs valeurs.
export function loadMyPvitConfig(brut: Record<string, string | undefined>): MyPvitConfig {
  const env = resoudreNomsAlternatifs(brut);
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
    agent: env.MYPVIT_AGENT || AGENT_PAR_DEFAUT,
    product: env.MYPVIT_PRODUCT || PRODUIT_PAR_DEFAUT,
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
