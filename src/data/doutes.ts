import { and, eq, or } from "drizzle-orm";
import { db, newId, query } from "../db/client";
import { doute, individu, type Doute } from "../db/schema";
import { STATUTS_DOUTE, type StatutDoute } from "../lib/doutes";
import { creerRecherche } from "./recherches";
import { sansTrace, verifierVersion, versionDe } from "./version";

/** Une paire est toujours rangée : individu1 < individu2. */
const paire = (a: string, b: string) => (a < b ? [a, b] : [b, a]);

/** Résumé d'une fiche pour comparer d'un coup d'œil. */
const RESUME = (alias: string) => `
  ${alias}.id, ${alias}.nom, ${alias}.prenoms, ${alias}.sexe, ${alias}.naissance, ${alias}.deces, ${alias}.profession,
  (select nom from lieu where id = ${alias}.naissance_lieu_id), (select nom from lieu where id = ${alias}.deces_lieu_id),
  ${alias}.portrait_annotation_id,
  (select count(*) from releve r where r.individu_id = ${alias}.id)`;

export type FicheResumee = {
  id: string;
  nom: string | null;
  prenoms: string | null;
  sexe: string | null;
  naissance: string | null;
  deces: string | null;
  profession: string | null;
  naissanceLieuNom: string | null;
  decesLieuNom: string | null;
  portraitAnnotationId: string | null;
  nbReleves: number;
};
const fiche = (l: unknown[], i: number): FicheResumee => ({
  id: l[i] as string,
  nom: l[i + 1] as string | null,
  prenoms: l[i + 2] as string | null,
  sexe: l[i + 3] as string | null,
  naissance: l[i + 4] as string | null,
  deces: l[i + 5] as string | null,
  profession: l[i + 6] as string | null,
  naissanceLieuNom: l[i + 7] as string | null,
  decesLieuNom: l[i + 8] as string | null,
  portraitAnnotationId: l[i + 9] as string | null,
  nbReleves: Number(l[i + 10] ?? 0),
});
const TAILLE_RESUME = 11;

async function doutes(condition: string, params: unknown[]) {
  const lignes = await query(
    `select d.id, d.statut, d.note, d.tache_id, t.titre, t.statut, d.cree_le, d.cree_par, d.modifie_le, d.modifie_par, t.individu_id,
            ${RESUME("a")}, ${RESUME("b")}
     from doute d
     join individu a on a.id = d.individu1_id
     join individu b on b.id = d.individu2_id
     left join tache t on t.id = d.tache_id
     ${condition}
     order by d.statut = 'a_verifier' desc, coalesce(d.modifie_le, d.cree_le) desc`,
    params,
  );
  return lignes.map((l) => ({
    id: l[0] as string,
    statut: l[1] as StatutDoute,
    note: l[2] as string | null,
    tacheId: l[3] as string | null,
    tacheTitre: l[4] as string | null,
    tacheStatut: l[5] as string | null,
    creeLe: l[6] as string,
    creePar: l[7] as string | null,
    modifieLe: l[8] as string | null,
    modifiePar: l[9] as string | null,
    /** Fiche qui porte la recherche liée. */
    tacheIndividuId: l[10] as string | null,
    a: fiche(l, 11),
    b: fiche(l, 11 + TAILLE_RESUME),
  }));
}
export type DouteDetaille = Awaited<ReturnType<typeof listeDoutes>>[number];

/** Toutes les paires (à vérifier d'abord). */
export const listeDoutes = () => doutes("", []);

/** Les doutes d'une fiche ; `a` est toujours la fiche demandée, `b` l'autre. */
export async function doutesIndividu(individuId: string) {
  const liste = await doutes("where d.individu1_id = ? or d.individu2_id = ?", [individuId, individuId]);
  return liste.map((d) => (d.a.id === individuId ? d : { ...d, a: d.b, b: d.a }));
}

/** « Peut-être la même personne » : crée le doute, ou rouvre celui qui existe déjà (la note est ajoutée). */
export async function creerDoute(individuA: string, individuB: string, note: string | null = null) {
  if (individuA === individuB) throw new Error("Une fiche ne peut pas être en doute avec elle-même.");
  const [i1, i2] = paire(individuA, individuB);
  const [existant] = await db.select().from(doute).where(and(eq(doute.individu1Id, i1), eq(doute.individu2Id, i2)));
  if (existant) {
    const notes = [existant.note, note].filter(Boolean).join("\n");
    await db.update(doute).set({ statut: "a_verifier", note: notes || null }).where(eq(doute.id, existant.id));
    return existant.id;
  }
  const id = newId();
  await db.insert(doute).values({ id, individu1Id: i1, individu2Id: i2, note: note || null });
  return id;
}

export async function majDoute(id: string, patch: Partial<Pick<Doute, "statut" | "note">>, version?: string | null) {
  if (patch.statut !== undefined && !STATUTS_DOUTE.some((s) => s.value === patch.statut))
    throw new Error(`Statut inconnu : ${patch.statut}`);
  await verifierVersion("doute", id, version);
  const { statut, note } = sansTrace(patch);
  await db.update(doute).set({ ...(statut !== undefined && { statut }), ...(note !== undefined && { note }) }).where(eq(doute.id, id));
  return versionDe("doute", id);
}

/** « Retirer » : le doute était une erreur. */
export const supprimerDoute = (id: string) => db.delete(doute).where(eq(doute.id, id));

/** Ouvre une recherche, sur la première fiche, pour lever le doute ; elle reste liée au doute. */
export async function creerRechercheDoute(id: string) {
  const [d] = await db.select().from(doute).where(eq(doute.id, id));
  if (!d) throw new Error("Doute introuvable.");
  if (d.tacheId) return d.tacheId;
  const fiches = await db
    .select({ id: individu.id, nom: individu.nom, prenoms: individu.prenoms })
    .from(individu)
    .where(or(eq(individu.id, d.individu1Id), eq(individu.id, d.individu2Id)));
  const nomDe = (iid: string) => {
    const f = fiches.find((x) => x.id === iid);
    return [f?.nom?.toUpperCase(), f?.prenoms].filter(Boolean).join(" ") || "?";
  };
  const tacheId = await creerRecherche(d.individu1Id, {
    titre: `Lever le doute : ${nomDe(d.individu1Id)} / ${nomDe(d.individu2Id)}`,
    type: "autre",
    description: ["Ces deux fiches sont peut-être la même personne.", d.note].filter(Boolean).join("\n"),
    statut: "a_faire",
  });
  await db.update(doute).set({ tacheId }).where(eq(doute.id, id));
  return tacheId;
}
