// Banc d'essai MyPVit (lot 4 de l'audit). À lancer à la main, avec les identifiants de TEST fournis par MyPVit,
// passés par l'environnement de la machine locale : jamais dans le dépôt, jamais dans une discussion.
// Étape 1 : lecture seule (opérateurs, frais). Étape 2 : un encaissement de test, uniquement si SANDBOX_TEST_PAYMENT=oui.
import { writeFileSync } from 'node:fs';
import { loadMyPvitConfig, MyPvitClient, MyPvitError } from '../src/modules/paiements/providers/mypvit/index.ts';
import { classerFrais, verifierGardeSandbox } from '../src/modules/paiements/providers/mypvit/sandbox-garde.ts';

async function principal(): Promise<void> {
  const env = process.env;
  const garde = verifierGardeSandbox(env);
  if (garde) {
    console.error(`Arrêt : ${garde}`);
    process.exit(2);
  }

  const lignes: string[] = [];
  const noter = (texte: string) => {
    lignes.push(texte);
    console.log(texte);
  };
  // Aucune valeur de configuration ni identifiant n'est écrit ; les numéros sont masqués.
  const masquer = (numero: string) => `***${numero.slice(-3)}`;
  const decrire = (e: unknown) =>
    e instanceof MyPvitError ? `erreur MyPVit (statut ${e.status ?? 'aucun'}, code ${e.code ?? 'aucun'})` : 'erreur inattendue';

  const client = new MyPvitClient(loadMyPvitConfig(env));
  noter('# Dossier de preuves — banc d’essai MyPVit');
  noter(`Date : ${new Date().toISOString()}`);
  noter('Garde-fous : production exclue, adresse de test explicite, confirmation donnée.');
  noter('');
  noter('## Étape 1 — lecture seule');
  try {
    const operateurs = await client.listOperators('GA');
    noter(`- Opérateurs listés : ${operateurs.length}`);
  } catch (e) {
    noter(`- Opérateurs : ${decrire(e)}`);
  }
  for (const operateur of ['AIRTEL_MONEY', 'MOOV_MONEY']) {
    try {
      const f = await client.getFees(1000, operateur);
      const relation = classerFrais(1000, f.fees, f.totalAmount);
      noter(`- Frais ${operateur} pour 1 000 FCFA : ${f.fees} FCFA, total ${f.totalAmount} FCFA, relation : ${relation}`);
    } catch (e) {
      noter(`- Frais ${operateur} : ${decrire(e)}`);
    }
  }

  if (env.SANDBOX_TEST_PAYMENT === 'oui') {
    noter('');
    noter('## Étape 2 — encaissement de test');
    const numero = env.SANDBOX_MSISDN_TEST;
    const operateur = env.SANDBOX_OPERATEUR_TEST ?? 'AIRTEL_MONEY';
    const montant = Number(env.SANDBOX_MONTANT ?? 100);
    if (!numero) {
      noter('- Arrêt : SANDBOX_MSISDN_TEST requis (numéro de test fourni par MyPVit).');
    } else {
      const reference = `SBX${Date.now()}`;
      try {
        const init = await client.initiatePayment({ reference, amount: montant, operatorCode: operateur, customerMsisdn: numero });
        noter(`- Initiation (${operateur}, ${montant} FCFA, numéro ${masquer(numero)}) : ${init.nzeStatus}`);
        const identifiant = init.referenceId ?? reference;
        for (let i = 1; i <= 12; i++) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          const statut = await client.getTransactionStatus(identifiant, 'PAYMENT', operateur);
          noter(`- Statut interrogé (${i * 5} s) : ${statut.nzeStatus} (brut : ${statut.rawStatus})`);
          if (statut.nzeStatus === 'SUCCESS' || statut.nzeStatus === 'FAILED') break;
        }
      } catch (e) {
        noter(`- Initiation : ${decrire(e)}`);
      }
    }
  }

  noter('');
  noter('## Scénarios à exécuter à la main avec MyPVit');
  noter('Voir docs/SANDBOX-MYPVIT.md : callbacks, filtrage IP, timeout, résultat incertain, GIVE_CHANGE, frais de retrait.');
  writeFileSync('sandbox-rapport-mypvit.md', `${lignes.join('\n')}\n`);
  console.log('Rapport écrit : sandbox-rapport-mypvit.md');
}

principal().catch((e) => {
  console.error(decrireErreur(e));
  process.exit(1);
});

function decrireErreur(e: unknown): string {
  return e instanceof MyPvitError ? `Erreur MyPVit (statut ${e.status ?? 'aucun'}, code ${e.code ?? 'aucun'})` : 'Erreur inattendue';
}
