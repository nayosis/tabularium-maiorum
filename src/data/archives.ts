import { and, eq } from "drizzle-orm";
import { db, newId } from "../db/client";
import { lienArchives } from "../db/schema";
import { CATEGORIES_ARCHIVES } from "../lib/archives";

/** Liens de l'annuaire ajoutés, corrigés ou masqués par l'utilisateur. */
export const liensArchivesPerso = () => db.select().from(lienArchives);

const verifier = (categorie: string, url: string | null) => {
  if (!CATEGORIES_ARCHIVES.some((c) => c.value === categorie)) throw new Error(`Catégorie inconnue : ${categorie}`);
  if (url && !/^https?:\/\/\S+$/i.test(url.trim())) throw new Error("L'adresse doit commencer par http:// ou https://");
};

/** Ajoute un lien, ou remplace un lien fourni (`defaut` = son adresse). */
export async function enregistrerLienArchives(lien: { id?: string | null; departement: string; categorie: string; libelle: string; url: string; defaut?: string | null }) {
  verifier(lien.categorie, lien.url);
  const valeurs = { departement: lien.departement, categorie: lien.categorie, libelle: lien.libelle.trim() || "Lien", url: lien.url.trim(), defaut: lien.defaut ?? null, masque: false };
  if (lien.id) {
    await db.update(lienArchives).set(valeurs).where(eq(lienArchives.id, lien.id));
    return lien.id;
  }
  // Un seul remplacement par lien fourni.
  if (lien.defaut) await db.delete(lienArchives).where(and(eq(lienArchives.departement, lien.departement), eq(lienArchives.defaut, lien.defaut)));
  const id = newId();
  await db.insert(lienArchives).values({ id, ...valeurs });
  return id;
}

/** Masque un lien fourni (devenu faux ou inutile). */
export async function masquerLienArchives(departement: string, defaut: string, categorie: string) {
  await db.delete(lienArchives).where(and(eq(lienArchives.departement, departement), eq(lienArchives.defaut, defaut)));
  const id = newId();
  await db.insert(lienArchives).values({ id, departement, categorie, libelle: "(masqué)", url: null, defaut, masque: true });
  return id;
}

/** Supprime un lien ajouté, ou rétablit le lien fourni qu'il remplaçait ou masquait. */
export const supprimerLienArchives = (id: string) => db.delete(lienArchives).where(eq(lienArchives.id, id));
