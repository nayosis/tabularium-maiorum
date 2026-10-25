import { query } from "../db/client";
import type { DonneesCitation } from "../lib/citation";

/** Tout ce qu'il faut pour citer ces documents (registre, archives, cote, première vue, lien en ligne). */
export async function donneesCitations(acteIds: string[]): Promise<DonneesCitation[]> {
  const ids = [...new Set(acteIds.filter(Boolean))];
  if (!ids.length) return [];
  const lignes = await query(
    `select a.id, a.titre, a.nature, a.type, a.numero, a.date, a.cote,
            (select nom from lieu where id = a.lieu_id),
            s.titre, s.periode, s.cote, s.service_archives,
            (select p.numero_vue from acte_page ap join page p on p.id = ap.page_id where ap.acte_id = a.id order by ap.ordre limit 1),
            coalesce((select l.url from lien l where l.acte_id = a.id order by l.cree_le limit 1), s.url)
     from acte a left join source s on s.id = a.source_id
     where a.id in (${ids.map(() => "?").join(", ")})`,
    ids,
  );
  return lignes.map((l) => ({
    acteId: l[0] as string,
    titre: l[1] as string,
    nature: l[2] as string,
    type: l[3] as string | null,
    numero: l[4] as string | null,
    date: l[5] as string | null,
    coteActe: l[6] as string | null,
    acteLieu: l[7] as string | null,
    registreTitre: l[8] as string | null,
    periode: l[9] as string | null,
    coteRegistre: l[10] as string | null,
    archives: l[11] as string | null,
    vue: l[12] as string | null,
    url: l[13] as string | null,
  }));
}
