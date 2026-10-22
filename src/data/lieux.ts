import { asc, eq } from "drizzle-orm";
import { db, newId } from "../db/client";
import { lieu, type Lieu } from "../db/schema";

export const listeLieux = () => db.select().from(lieu).orderBy(asc(lieu.nom));

export async function creerLieu(nom: string, departement?: string | null) {
  const id = newId();
  await db.insert(lieu).values({ id, nom, departement: departement || null });
  return id;
}

export const majLieu = (id: string, patch: Partial<Lieu>) => db.update(lieu).set(patch).where(eq(lieu.id, id));
export const supprimerLieu = (id: string) => db.delete(lieu).where(eq(lieu.id, id));

