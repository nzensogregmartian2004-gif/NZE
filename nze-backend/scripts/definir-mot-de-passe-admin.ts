// Définit le mot de passe d'un compte administrateur.
// Le mot de passe est lu dans la variable ADMIN_NOUVEAU_MOT_DE_PASSE : il n'apparaît ni dans la commande, ni dans le journal.
// Usage : ADMIN_NOUVEAU_MOT_DE_PASSE=... npm run admin:mot-de-passe -- +241XXXXXXXX
import { createDb } from '../src/db/client.ts';
import { definirMotDePasseAdmin } from '../src/modules/auth/admin-mot-de-passe.ts';

const telephone = process.argv[2];
if (!telephone) {
  console.error('Indiquez le numéro du compte administrateur, après -- .');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL est absent : lancez la commande dans l’environnement du serveur.');
  process.exit(1);
}

const { db, pool } = createDb(process.env.DATABASE_URL);
try {
  const etat = await definirMotDePasseAdmin(db, telephone, process.env.ADMIN_NOUVEAU_MOT_DE_PASSE ?? '');
  console.log(etat === 'cree' ? 'Compte administrateur créé, mot de passe défini.' : 'Mot de passe du compte administrateur mis à jour.');
} catch (erreur) {
  console.error('Échec :', erreur instanceof Error ? erreur.message : erreur);
  process.exitCode = 1;
} finally {
  await pool.end();
}
