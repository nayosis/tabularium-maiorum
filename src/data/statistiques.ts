import { query } from "../db/client";

const nombre = async (sql: string) => Number((await query(sql))[0]?.[0] ?? 0);
const lignes = (sql: string) => query(sql);

/** Date de dernière modification au format ISO (cree_le est « AAAA-MM-JJ HH:MM:SS » en UTC). */
const derniereModif = (t = "") =>
  `(case when ${t}modifie_le is not null then ${t}modifie_le else replace(${t}cree_le, ' ', 'T') || 'Z' end)`;

/**
 * Tableau de bord de l'accueil : chiffres clés, travail en cours, complétude de l'arbre,
 * répartitions (siècles, patronymes, lieux), recherches à mener et activité récente.
 */
export async function tableauDeBord() {
  const [individus, documents, index, photos, registres, releves, lieux, recherches] = await Promise.all([
    nombre("select count(*) from individu"),
    nombre("select count(*) from acte where nature = 'acte'"),
    nombre("select count(*) from acte where nature = 'index'"),
    nombre("select count(*) from acte where nature = 'photo'"),
    nombre("select count(*) from source"),
    nombre("select count(*) from releve r join acte a on a.id = r.acte_id where a.nature <> 'photo'"),
    nombre("select count(*) from lieu"),
    nombre("select count(*) from tache"),
  ]);

  const statuts = Object.fromEntries(
    (await lignes("select statut, count(*) from acte where nature <> 'photo' group by statut")).map(([s, n]) => [s as string, Number(n)]),
  );

  const [relevesARattacher, personnesAIdentifier, doutes] = await Promise.all([
    nombre("select count(*) from releve r join acte a on a.id = r.acte_id where a.nature <> 'photo' and r.individu_id is null"),
    nombre("select count(*) from releve r join acte a on a.id = r.acte_id where a.nature = 'photo' and r.individu_id is null"),
    nombre("select count(*) from doute where statut = 'a_verifier'"),
  ]);

  // Complétude : part des individus dont on connaît chaque élément.
  const [c] = await lignes(`
    select
      sum(naissance_min is not null),
      sum(naissance_lieu_id is not null),
      sum(acte_naissance_id is not null),
      sum(deces_min is not null or acte_deces_id is not null),
      sum(exists (select 1 from filiation f where f.enfant_id = i.id))
    from individu i`);
  const [avecNaissance, avecLieuNaissance, avecActeNaissance, avecDeces, avecParents] = (c ?? []).map((v) => Number(v ?? 0));

  const parSiecle = (
    await lignes(`
      select cast(substr(naissance_min, 1, 2) as integer) + 1 as siecle, count(*)
      from individu where naissance_min is not null and naissance_min glob '[0-9][0-9][0-9][0-9]*'
      group by siecle order by siecle`)
  ).map(([s, n]) => ({ siecle: Number(s), n: Number(n) }));

  const patronymes = (
    await lignes(`
      select upper(trim(nom)) as p, count(*) as n from individu
      where nom is not null and trim(nom) <> '' group by p order by n desc, p limit 8`)
  ).map(([nom, n]) => ({ nom: nom as string, n: Number(n) }));

  const lieuxNaissance = (
    await lignes(`
      select l.id, l.nom, l.departement, count(*) as n from individu i join lieu l on l.id = i.naissance_lieu_id
      group by l.id order by n desc, l.nom limit 8`)
  ).map(([id, nom, departement, n]) => ({ id: id as string, nom: nom as string, departement: departement as string | null, n: Number(n) }));

  // Dispersion géographique : communes et départements de naissance distincts.
  const [g] = await lignes(`
    select count(distinct i.naissance_lieu_id), count(distinct nullif(trim(l.departement), ''))
    from individu i join lieu l on l.id = i.naissance_lieu_id`);
  const geographie = { communes: Number(g?.[0] ?? 0), departements: Number(g?.[1] ?? 0) };

  const [ancien] = await lignes(`
    select id, nom, prenoms, naissance, sexe from individu
    where naissance_min is not null order by naissance_min limit 1`);
  const plusAncien = ancien
    ? { id: ancien[0] as string, nom: ancien[1] as string | null, prenoms: ancien[2] as string | null, naissance: ancien[3] as string | null, sexe: ancien[4] as string | null }
    : null;

  const statutsRecherches = Object.fromEntries(
    (await lignes("select statut, count(*) from tache group by statut")).map(([s, n]) => [s as string, Number(n)]),
  );
  const recherchesOuvertes = (
    await lignes(`
      select t.id, t.titre, t.statut, t.individu_id, i.nom, i.prenoms from tache t left join individu i on i.id = t.individu_id
      where t.statut in ('a_faire', 'en_cours')
      order by t.statut = 'en_cours' desc, ${derniereModif("t.")} desc limit 6`)
  ).map(([id, titre, statut, individuId, nom, prenoms]) => ({
    id: id as string,
    titre: titre as string,
    statut: statut as string,
    individuId: individuId as string | null,
    nom: nom as string | null,
    prenoms: prenoms as string | null,
  }));

  // Dernières fiches et derniers documents modifiés (ou créés).
  const activite = (
    await lignes(`
      select * from (
        select 'individu' as genre, id, trim(coalesce(upper(nom), '') || ' ' || coalesce(prenoms, '')) as libelle,
               ${derniereModif()} as quand, coalesce(modifie_par, cree_par) as par from individu
        union all
        select 'document', id, titre, ${derniereModif()}, coalesce(modifie_par, cree_par) from acte
      ) order by quand desc limit 8`)
  ).map(([genre, id, libelle, quand, par]) => ({
    genre: genre as "individu" | "document",
    id: id as string,
    libelle: (libelle as string) || "(sans nom)",
    quand: quand as string,
    par: par as string | null,
  }));

  // Communes sans coordonnées : absentes de la carte, de la cartographie et des parcours. Les plus utilisées d'abord.
  const nonPlaces = (
    await lignes(`
      select l.id, l.nom, l.departement,
        (select count(*) from individu i where i.naissance_lieu_id = l.id or i.deces_lieu_id = l.id)
        + (select count(*) from couple c where c.lieu_id = l.id)
        + (select count(*) from acte a where a.lieu_id = l.id)
        + (select count(*) from source s where s.lieu_id = l.id) as n
      from lieu l where l.latitude is null or l.longitude is null
      order by n desc, l.nom`)
  ).map(([id, nom, departement, n]) => ({ id: id as string, nom: nom as string, departement: departement as string | null, n: Number(n) }));
  const lieuxNonPlaces = { total: nonPlaces.length, premiers: nonPlaces.slice(0, 8) };

  return {
    totaux: { individus, documents, index, photos, registres, releves, lieux, recherches },
    lieuxNonPlaces,
    statuts,
    aFaire: { relevesARattacher, personnesAIdentifier, doutes },
    completude: { avecNaissance, avecLieuNaissance, avecActeNaissance, avecDeces, avecParents },
    parSiecle,
    patronymes,
    lieuxNaissance,
    geographie,
    plusAncien,
    statutsRecherches,
    recherchesOuvertes,
    activite,
  };
}
export type TableauDeBord = Awaited<ReturnType<typeof tableauDeBord>>;
