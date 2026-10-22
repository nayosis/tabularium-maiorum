import { creerApp } from "./app";
import { ouvrirBase } from "./base";
import { installerSuperAdmin, ouvrirComptes } from "./comptes";
import { BASE_COMPTES, BASE_DONNEES, DOSSIER_DONNEES, DOSSIER_MIGRATIONS, PORT, preparerDossiers } from "./config";

preparerDossiers();
const { appliquees } = ouvrirBase(BASE_DONNEES, DOSSIER_MIGRATIONS);
if (appliquees.length) console.log(`Migrations appliquées : ${appliquees.join(", ")}`);

ouvrirComptes(BASE_COMPTES);
await installerSuperAdmin(process.env.SUPER_ADMIN_EMAIL, process.env.SUPER_ADMIN_MOT_DE_PASSE);

creerApp().listen(PORT);
console.log(`Tabularium : http://localhost:${PORT} (données : ${DOSSIER_DONNEES})`);
