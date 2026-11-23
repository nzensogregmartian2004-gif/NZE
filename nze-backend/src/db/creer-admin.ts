// Création du premier administrateur, hors application.
// Usage : DATABASE_URL=... node --experimental-strip-types src/db/creer-admin.ts +241XXXXXXXX [admin_principal|admin_secondaire]
import { createDb } from './client.ts';
import { creerAdministrateur } from '../modules/auth/service.ts';

const [telephone, role = 'admin_principal'] = process.argv.slice(2);
if (!telephone || (role !== 'admin_principal' && role !== 'admin_secondaire')) {
  console.error('Usage : creer-admin.ts +241XXXXXXXX [admin_principal|admin_secondaire]');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL requis');
const { pool, db } = createDb(url);
const admin = await creerAdministrateur(db, telephone, role);
console.log(`Administrateur prêt : ${admin.role} (${admin.telephone})`);
await pool.end();
