import { asc, eq } from "drizzle-orm";
import { db, newId, query } from "../db/client";
import { lieu, type Lieu } from "../db/schema";

export const listeLieux = () => db.select().from(lieu).orderBy(asc(lieu.nom));

export async function creerLieu(nom: string, departement?: string | null) {
  const id = newId();
  await db.insert(lieu).values({ id, nom, departement: departement || null });
  return id;
}

export const majLieu = (id: string, patch: Partial<Lieu>) => db.update(lieu).set(patch).where(eq(lieu.id, id));
export const supprimerLieu = (id: string) => db.delete(lieu).where(eq(lieu.id, id));

export type UsagesLieu = { personnes: number; unions: number; actes: number; registres: number };

/** Pour chaque lieu utilisé : nombre de personnes (nées ou décédées), d'unions, de documents et de registres qui y renvoient. */
export async function usagesLieux(): Promise<Record<string, UsagesLieu>> {
  const lignes = await query(`
    select lieu_id, sum(p), sum(u), sum(a), sum(r) from (
      select naissance_lieu_id as lieu_id, 1 as p, 0 as u, 0 as a, 0 as r from individu where naissance_lieu_id is not null
      union all
      -- Une personne née et décédée au même endroit ne compte qu'une fois.
      select deces_lieu_id, 1, 0, 0, 0 from individu
        where deces_lieu_id is not null and deces_lieu_id is not coalesce(naissance_lieu_id, '')
      union all select lieu_id, 0, 1, 0, 0 from couple where lieu_id is not null
      union all select lieu_id, 0, 0, 1, 0 from acte where lieu_id is not null
      union all select lieu_id, 0, 0, 0, 1 from source where lieu_id is not null
    ) group by lieu_id`);
  return Object.fromEntries(
    lignes.map(([id, personnes, unions, actes, registres]) => [
      id as string,
      { personnes: Number(personnes), unions: Number(unions), actes: Number(actes), registres: Number(registres) },
    ]),
  );
}

/** Tout ce qui renvoie à un lieu, pour le vérifier avant de le corriger ou de le supprimer. */
export async function rattachementsLieu(id: string) {
  const [personnes, unions, actes, registres] = await Promise.all([
    query(
      `select id, nom, prenoms, naissance_lieu_id = ? as nee, deces_lieu_id = ? as decedee from individu
       where naissance_lieu_id = ? or deces_lieu_id = ? order by nom, prenoms`,
      [id, id, id, id],
    ),
    query(
      `select c.id, c.date, a.id, a.nom, a.prenoms, b.id, b.nom, b.prenoms from couple c
       left join individu a on a.id = c.individu1_id left join individu b on b.id = c.individu2_id
       where c.lieu_id = ? order by c.date_min`,
      [id],
    ),
    query("select id, titre, nature, date from acte where lieu_id = ? order by date_min, titre", [id]),
    query("select id, titre from source where lieu_id = ? order by titre", [id]),
  ]);
  const personne = (pid: unknown, nom: unknown, prenoms: unknown) =>
    pid ? { id: pid as string, nom: nom as string | null, prenoms: prenoms as string | null } : null;
  return {
    personnes: personnes.map(([pid, nom, prenoms, nee, decedee]) => ({ ...personne(pid, nom, prenoms)!, nee: !!nee, decedee: !!decedee })),
    unions: unions.map(([cid, date, aId, aNom, aPrenoms, bId, bNom, bPrenoms]) => ({
      id: cid as string,
      date: date as string | null,
      conjoints: [personne(aId, aNom, aPrenoms), personne(bId, bNom, bPrenoms)].filter((x) => x !== null),
    })),
    actes: actes.map(([aid, titre, nature, date]) => ({ id: aid as string, titre: titre as string, nature: nature as string, date: date as string | null })),
    registres: registres.map(([rid, titre]) => ({ id: rid as string, titre: titre as string })),
  };
}
export type RattachementsLieu = Awaited<ReturnType<typeof rattachementsLieu>>;
