import { asc, eq, getTableColumns, sql } from "drizzle-orm";
import { db, newId } from "../db/client";
import { lieu, source } from "../db/schema";

const sourceIdQualifie = sql.raw(`"source"."id"`);

/** Tous les registres, avec ce qu'ils contiennent (documents, relevés) et les recherches qui y ont été faites. */
export async function listeRegistres() {
  return db
    .select({
      ...getTableColumns(source),
      lieuNom: lieu.nom,
      nbDocuments: sql<number>`(select count(*) from acte a where a.source_id = ${sourceIdQualifie})`,
      nbReleves: sql<number>`(select count(*) from releve r join acte a on a.id = r.acte_id where a.source_id = ${sourceIdQualifie})`,
      nbConsultations: sql<number>`(select count(*) from consultation c where c.source_id = ${sourceIdQualifie})`,
    })
    .from(source)
    .leftJoin(lieu, eq(lieu.id, source.lieuId))
    .orderBy(asc(source.titre));
}
export type RegistreListe = Awaited<ReturnType<typeof listeRegistres>>[number];

export async function creerRegistre(titre = "Nouveau registre", patch: Partial<typeof source.$inferInsert> = {}) {
  const id = newId();
  await db.insert(source).values({ ...patch, id, titre });
  return id;
}

/** Supprime le registre ; ses documents et consultations restent, simplement « sans registre ». */
export const supprimerRegistre = (id: string) => db.delete(source).where(eq(source.id, id));
