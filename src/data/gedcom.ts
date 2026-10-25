/*
 * Échange GEDCOM avec les autres logiciels de généalogie.
 * - Export (5.5.1) : individus, familles, dates, lieux (avec coordonnées), professions, notes, et les sources :
 *   chaque registre devient une source, chaque fait renvoie à son acte par une citation complète.
 * - Import : les personnes deviennent des fiches, les familles des unions et filiations ; chaque source citée
 *   devient un document « à transcrire » (sans image) rangé dans son registre, relié au fait et à la personne.
 *   Rien n'est fusionné : les ressemblances avec les fiches existantes apparaissent dans « Doublons possibles ».
 */
import { db, newId, query } from "../db/client";
import { acte, couple, filiation, individu, lieu, releve, source } from "../db/schema";
import { citation } from "../lib/citation";
import { analyserDate } from "../lib/dates";
import {
  dateDepuisGedcom, dateVersGedcom, enfant, enfants, ligne, lireGedcom, lireNom, nomGedcom, valeur, type Noeud,
} from "../lib/gedcom";
import { libelle, TYPES_ACTE } from "../lib/libelles";
import { donneesCitations } from "./citations";
import paquet from "../../package.json";

// --- Export

type LieuExport = { id: string; nom: string; departement: string | null; latitude: number | null; longitude: number | null };
const coord = (v: number, pos: string, neg: string) => `${v < 0 ? neg : pos}${Math.abs(v)}`;

export async function exporterGedcom() {
  const [individus, lieux, filiations, couples] = await Promise.all([
    db.select().from(individu),
    db.select().from(lieu),
    db.select().from(filiation),
    db.select().from(couple),
  ]);
  const parLieu = new Map<string, LieuExport>(lieux.map((l) => [l.id, l]));
  const parIndividu = new Map(individus.map((i) => [i.id, i]));

  // Citations des actes utilisés comme sources des faits.
  const acteIds = [...individus.flatMap((i) => [i.acteNaissanceId, i.acteDecesId]), ...couples.map((c) => c.acteId)].filter((x): x is string => !!x);
  const citations = new Map((await donneesCitations(acteIds)).map((d) => [d.acteId, d]));
  const acteSource = new Map(
    (acteIds.length ? await query(`select id, source_id from acte where id in (${[...new Set(acteIds)].map(() => "?").join(",")})`, [...new Set(acteIds)]) : []).map(
      ([id, s]) => [id as string, s as string | null],
    ),
  );
  const registres = await db.select().from(source);
  const parRegistre = new Map(registres.map((r) => [r.id, r]));

  // Identifiants GEDCOM.
  const xI = new Map(individus.map((i, n) => [i.id, `@I${n + 1}@`]));
  const xS = new Map<string, string>();
  const sourceDe = (acteId: string) => {
    const cle = acteSource.get(acteId) ?? "sans-registre";
    if (!xS.has(cle)) xS.set(cle, `@S${xS.size + 1}@`);
    return xS.get(cle)!;
  };

  // Familles : unions, puis parents d'enfants sans union enregistrée.
  type Famille = { x: string; mari: string | null; femme: string | null; enfants: string[]; union: (typeof couples)[number] | null };
  const familles: Famille[] = [];
  const parPaire = new Map<string, Famille>();
  const paire = (a: string | null, b: string | null) => [a ?? "", b ?? ""].sort().join("|");
  for (const c of couples) {
    const [a, b] = [parIndividu.get(c.individu1Id), c.individu2Id ? parIndividu.get(c.individu2Id) : undefined];
    const mari = a?.sexe === "F" ? (b?.id ?? null) : (a?.id ?? null);
    const femme = a?.sexe === "F" ? a.id : (b?.id ?? null);
    const f: Famille = { x: `@F${familles.length + 1}@`, mari, femme, enfants: [], union: c };
    familles.push(f);
    parPaire.set(paire(mari, femme), f);
  }
  const parentsDe = Map.groupBy(filiations, (f) => f.enfantId);
  for (const [enfantId, liens] of parentsDe) {
    const pere = liens.map((l) => parIndividu.get(l.parentId)).find((p) => p?.sexe === "M")?.id ?? null;
    const mere = liens.map((l) => parIndividu.get(l.parentId)).find((p) => p?.sexe !== "M")?.id ?? null;
    if (!pere && !mere) continue;
    let f = parPaire.get(paire(pere, mere));
    if (!f) {
      f = { x: `@F${familles.length + 1}@`, mari: pere, femme: mere, enfants: [], union: null };
      familles.push(f);
      parPaire.set(paire(pere, mere), f);
    }
    f.enfants.push(enfantId);
  }

  const L: string[] = [];
  const ajouter = (...lignes: string[][]) => lignes.forEach((l) => L.push(...l));
  const lieuLignes = (niveau: number, lieuId: string | null) => {
    const l = lieuId ? parLieu.get(lieuId) : undefined;
    if (!l) return [];
    const r = ligne(niveau, "PLAC", [l.nom, l.departement].filter(Boolean).join(", "));
    if (l.latitude != null && l.longitude != null)
      r.push(...ligne(niveau + 1, "MAP"), ...ligne(niveau + 2, "LATI", coord(l.latitude, "N", "S")), ...ligne(niveau + 2, "LONG", coord(l.longitude, "E", "W")));
    return r;
  };
  const sourceLignes = (niveau: number, acteId: string | null) => {
    const d = acteId ? citations.get(acteId) : undefined;
    if (!acteId || !d) return [];
    return [...ligne(niveau, "SOUR", sourceDe(acteId)), ...ligne(niveau + 1, "PAGE", citation(d))];
  };
  const evenement = (tag: string, texte: string | null, min: string | null, max: string | null, lieuId: string | null, acteId: string | null) => {
    const date = dateVersGedcom(texte, min, max);
    if (!date && !lieuId && !acteId) return [];
    return [...ligne(1, tag, date || lieuId || acteId ? undefined : "Y"), ...(date ? ligne(2, "DATE", date) : []), ...lieuLignes(2, lieuId), ...sourceLignes(2, acteId)];
  };

  const aujourdhui = new Date();
  ajouter(
    ligne(0, "HEAD"),
    ligne(1, "SOUR", "TABULARIUM"),
    ligne(2, "VERS", paquet.version),
    ligne(2, "NAME", "Tabularium Maiorum"),
    ligne(1, "DATE", `${aujourdhui.getDate()} ${["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][aujourdhui.getMonth()]} ${aujourdhui.getFullYear()}`),
    ligne(1, "SUBM", "@SUBM@"),
    ligne(1, "GEDC"),
    ligne(2, "VERS", "5.5.1"),
    ligne(2, "FORM", "LINEAGE-LINKED"),
    ligne(1, "CHAR", "UTF-8"),
    ligne(1, "LANG", "French"),
    ligne(0, "SUBM", undefined, "@SUBM@"),
    ligne(1, "NAME", "Tabularium Maiorum"),
  );

  for (const i of individus) {
    ajouter(ligne(0, "INDI", undefined, xI.get(i.id)), ligne(1, "NAME", nomGedcom(i.nom?.toUpperCase() ?? null, i.prenoms)));
    if (i.nom) ajouter(ligne(2, "SURN", i.nom.toUpperCase()));
    if (i.prenoms) ajouter(ligne(2, "GIVN", i.prenoms));
    if (i.sexe === "M" || i.sexe === "F") ajouter(ligne(1, "SEX", i.sexe));
    ajouter(evenement("BIRT", i.naissance, i.naissanceMin, i.naissanceMax, i.naissanceLieuId, i.acteNaissanceId));
    ajouter(evenement("DEAT", i.deces, i.decesMin, i.decesMax, i.decesLieuId, i.acteDecesId));
    if (i.profession) ajouter(ligne(1, "OCCU", i.profession));
    if (i.notes) ajouter(ligne(1, "NOTE", i.notes));
    for (const f of familles) {
      if (f.enfants.includes(i.id)) {
        ajouter(ligne(1, "FAMC", f.x));
        const type = filiations.find((l) => l.enfantId === i.id && (l.parentId === f.mari || l.parentId === f.femme))?.type;
        if (type === "adoptive") ajouter(ligne(2, "PEDI", "adopted"));
      }
      if (f.mari === i.id || f.femme === i.id) ajouter(ligne(1, "FAMS", f.x));
    }
  }

  for (const f of familles) {
    ajouter(ligne(0, "FAM", undefined, f.x));
    if (f.mari) ajouter(ligne(1, "HUSB", xI.get(f.mari)));
    if (f.femme) ajouter(ligne(1, "WIFE", xI.get(f.femme)));
    for (const e of f.enfants) ajouter(ligne(1, "CHIL", xI.get(e)));
    const u = f.union;
    if (u && (u.type === "mariage" || u.date || u.acteId)) ajouter(evenement("MARR", u.date, u.dateMin, u.dateMax, u.lieuId, u.acteId));
    if (u?.notes) ajouter(ligne(1, "NOTE", u.notes));
  }

  for (const [cle, x] of xS) {
    const r = parRegistre.get(cle);
    ajouter(ligne(0, "SOUR", undefined, x), ligne(1, "TITL", r?.titre ?? "Documents (Tabularium)"));
    if (r?.serviceArchives) ajouter(ligne(1, "AUTH", r.serviceArchives));
    if (r?.periode) ajouter(ligne(1, "PUBL", r.periode));
    const note = [r?.cote && `Cote : ${r.cote}`, r?.url && `En ligne : ${r.url}`].filter(Boolean).join("\n");
    if (note) ajouter(ligne(1, "NOTE", note));
  }
  ajouter(ligne(0, "TRLR"));
  return `${L.join("\n")}\n`;
}

// --- Import

const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
const degres = (v: string | null) => {
  const m = v?.trim().match(/^([NSEW])?\s*(-?\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] && /[SW]/i.test(m[1]) ? -Math.abs(n) : n;
};

export type BilanImport = { individus: number; familles: number; documents: number; registres: number; lieux: number; avertissements: string[] };

/** Importe un fichier GEDCOM (texte déjà décodé) : tout est créé en une seule transaction. */
export async function importerGedcom(nomFichier: string, texte: string): Promise<BilanImport> {
  const racines = lireGedcom(texte);
  if (!racines.some((r) => r.tag === "HEAD") && !racines.some((r) => r.tag === "INDI")) throw new Error("Ce fichier ne semble pas être un fichier GEDCOM.");
  const avertissements: string[] = [];
  const ops: { toSQL: () => unknown }[] = [];
  const parXref = new Map(racines.filter((r) => r.xref).map((r) => [r.xref!, r]));
  const texteNote = (n: Noeud) => (n.valeur.startsWith("@") ? (parXref.get(n.valeur.trim())?.valeur ?? "") : n.valeur);

  // Lieux : réutilise ceux qui existent (même nom, même département), crée les autres.
  const existants = await db.select({ id: lieu.id, nom: lieu.nom, departement: lieu.departement }).from(lieu);
  const lieux = new Map(existants.map((l) => [`${sansAccents(l.nom)}|${sansAccents(l.departement ?? "")}`, l.id]));
  const lieuxParNom = new Map(existants.map((l) => [sansAccents(l.nom), l.id]));
  let nbLieux = 0;
  const lieuDe = (ev: Noeud | undefined) => {
    const plac = enfant(ev, "PLAC");
    if (!plac?.valeur.trim()) return null;
    const parties = plac.valeur.split(",").map((p) => p.trim()).filter(Boolean);
    const [nom, departement = null] = parties;
    if (!nom) return null;
    const cle = `${sansAccents(nom)}|${sansAccents(departement ?? "")}`;
    const trouve = lieux.get(cle) ?? (departement ? undefined : lieuxParNom.get(sansAccents(nom)));
    if (trouve) return trouve;
    const id = newId();
    const map = enfant(plac, "MAP");
    ops.push(db.insert(lieu).values({ id, nom, departement, latitude: degres(valeur(map, "LATI")), longitude: degres(valeur(map, "LONG")) }));
    lieux.set(cle, id);
    lieuxParNom.set(sansAccents(nom), id);
    nbLieux++;
    return id;
  };

  // Registres : un par source GEDCOM citée, et un pour les citations sans source.
  const registres = new Map<string, string>();
  const registreDe = (sourXref: string | null) => {
    const cle = sourXref ?? "";
    if (registres.has(cle)) return registres.get(cle)!;
    const s = sourXref ? parXref.get(sourXref) : undefined;
    const id = newId();
    ops.push(
      db.insert(source).values({
        id,
        titre: valeur(s, "TITL") ?? (s?.valeur.trim() || `Import GEDCOM — ${nomFichier}`),
        serviceArchives: valeur(s, "AUTH"),
        periode: valeur(s, "PUBL"),
        notes: [enfant(s, "NOTE") && texteNote(enfant(s, "NOTE")!), `Importé depuis ${nomFichier}`].filter(Boolean).join("\n"),
      }),
    );
    registres.set(cle, id);
    return id;
  };

  // Un document par citation (même source, même page) : relié aux faits et aux personnes citées.
  const documents = new Map<string, string>();
  const parType: Record<string, string> = { BIRT: "naissance", CHR: "bapteme", BAPM: "bapteme", DEAT: "deces", BURI: "sepulture", MARR: "mariage" };
  const roleDe: Record<string, string> = { naissance: "enfant", bapteme: "enfant", deces: "défunt", sepulture: "défunt" };
  const releves: { acteId: string; individuId: string; role: string; nom: string | null; prenoms: string | null; sexe: string | null }[] = [];
  const documentDe = (ev: Noeud, sujet: string, date: string | null, lieuId: string | null) => {
    const sour = enfant(ev, "SOUR");
    if (!sour) return null;
    const sourXref = sour.valeur.trim().startsWith("@") ? sour.valeur.trim() : null;
    const page = valeur(sour, "PAGE");
    const texteSource = [!sourXref && sour.valeur.trim(), page, valeur(enfant(sour, "DATA"), "TEXT"), enfant(sour, "NOTE") && texteNote(enfant(sour, "NOTE")!)]
      .filter(Boolean)
      .join("\n");
    const type = parType[ev.tag] ?? null;
    const cle = `${sourXref ?? sour.valeur}|${page ?? ""}|${ev.tag === "MARR" ? sujet : `${ev.tag}|${sujet}`}`;
    if (documents.has(cle)) return documents.get(cle)!;
    const id = newId();
    const bornes = analyserDate(date);
    const titre = ["Acte", type ? libelle(TYPES_ACTE, type).toLowerCase() : null, sujet, date].filter(Boolean).join(" ");
    ops.push(
      db.insert(acte).values({
        id,
        nature: "acte",
        type,
        titre,
        date,
        dateMin: bornes?.min ?? null,
        dateMax: bornes?.max ?? null,
        lieuId,
        sourceId: registreDe(sourXref),
        statut: "a_transcrire",
        notes: [`Source importée (${nomFichier}) :`, texteSource].filter(Boolean).join("\n"),
      }),
    );
    documents.set(cle, id);
    return id;
  };

  // Individus.
  const ids = new Map<string, string>();
  const infos = new Map<string, { nom: string | null; prenoms: string | null; sexe: string | null }>();
  for (const r of racines.filter((r) => r.tag === "INDI" && r.xref)) {
    const id = newId();
    ids.set(r.xref!, id);
    const nomBrut = valeur(r, "NAME");
    const { nom, prenoms } = nomBrut ? lireNom(nomBrut) : { nom: null, prenoms: null };
    const nomPropre = nom ? nom.charAt(0).toUpperCase() + nom.slice(1).toLowerCase() : null;
    const sexe = valeur(r, "SEX")?.toUpperCase();
    infos.set(id, { nom: nomPropre, prenoms, sexe: sexe === "M" || sexe === "F" ? sexe : null });
  }
  for (const r of racines.filter((r) => r.tag === "INDI" && r.xref)) {
    const id = ids.get(r.xref!)!;
    const info = infos.get(id)!;
    const sujet = [info.nom?.toUpperCase(), info.prenoms].filter(Boolean).join(" ");
    const naissance = enfant(r, "BIRT") ?? enfant(r, "CHR") ?? enfant(r, "BAPM");
    const deces = enfant(r, "DEAT") ?? enfant(r, "BURI");
    const dn = dateDepuisGedcom(valeur(naissance, "DATE"));
    const dd = dateDepuisGedcom(valeur(deces, "DATE"));
    const [bn, bd] = [analyserDate(dn), analyserDate(dd)];
    const lieuN = lieuDe(naissance);
    const lieuD = lieuDe(deces);
    const acteN = naissance ? documentDe(naissance, sujet, dn, lieuN) : null;
    const acteD = deces ? documentDe(deces, sujet, dd, lieuD) : null;
    if (dn && !bn) avertissements.push(`Date non comprise pour ${sujet || r.xref} : « ${valeur(naissance, "DATE")} » (gardée telle quelle).`);
    const professions = enfants(r, "OCCU").map((o) => o.valeur.trim()).filter(Boolean);
    const notes = enfants(r, "NOTE").map(texteNote).filter(Boolean);
    ops.push(
      db.insert(individu).values({
        id,
        ...info,
        naissance: dn,
        naissanceMin: bn?.min ?? null,
        naissanceMax: bn?.max ?? null,
        naissanceLieuId: lieuN,
        acteNaissanceId: acteN,
        deces: dd,
        decesMin: bd?.min ?? null,
        decesMax: bd?.max ?? null,
        decesLieuId: lieuD,
        acteDecesId: acteD,
        profession: professions.join(", ") || null,
        notes: notes.join("\n\n") || null,
      }),
    );
    for (const [acteId, ev] of [[acteN, naissance], [acteD, deces]] as const)
      if (acteId && ev) releves.push({ acteId, individuId: id, role: roleDe[parType[ev.tag]] ?? "autre", ...info });
  }

  // Familles : union (avec le mariage), et filiation de chaque enfant vers chacun des parents.
  let nbFamilles = 0;
  const liens = new Set<string>();
  for (const f of racines.filter((r) => r.tag === "FAM")) {
    const mari = ids.get(valeur(f, "HUSB") ?? "") ?? null;
    const femme = ids.get(valeur(f, "WIFE") ?? "") ?? null;
    const marr = enfant(f, "MARR");
    if (mari || femme) {
      const date = dateDepuisGedcom(valeur(marr, "DATE"));
      const bornes = analyserDate(date);
      const lieuId = lieuDe(marr);
      const sujet = [mari, femme].map((x) => (x ? [infos.get(x)?.nom?.toUpperCase(), infos.get(x)?.prenoms].filter(Boolean).join(" ") : null)).filter(Boolean).join(" et ");
      const acteId = marr ? documentDe(marr, sujet, date, lieuId) : null;
      if (mari && femme) {
        ops.push(
          db.insert(couple).values({
            id: newId(),
            individu1Id: mari,
            individu2Id: femme,
            type: marr ? "mariage" : "inconnu",
            date,
            dateMin: bornes?.min ?? null,
            dateMax: bornes?.max ?? null,
            lieuId,
            acteId,
            notes: enfants(f, "NOTE").map(texteNote).join("\n\n") || null,
          }),
        );
        nbFamilles++;
      }
      if (acteId) {
        if (mari) releves.push({ acteId, individuId: mari, role: "époux", ...infos.get(mari)! });
        if (femme) releves.push({ acteId, individuId: femme, role: "épouse", ...infos.get(femme)! });
      }
    }
    for (const c of enfants(f, "CHIL")) {
      const enfantId = ids.get(c.valeur.trim());
      if (!enfantId) continue;
      // PEDI : adoption éventuelle, déclarée sur la fiche de l'enfant.
      const indi = parXref.get(c.valeur.trim());
      const famc = enfants(indi, "FAMC").find((x) => x.valeur.trim() === f.xref);
      const type = valeur(famc, "PEDI")?.toLowerCase() === "adopted" ? "adoptive" : "biologique";
      for (const parent of [mari, femme]) {
        if (!parent || liens.has(`${enfantId}|${parent}`)) continue;
        liens.add(`${enfantId}|${parent}`);
        ops.push(db.insert(filiation).values({ id: newId(), enfantId, parentId: parent, type }));
      }
    }
  }

  // Relevés : la personne telle que la source la nomme, déjà rattachée à sa fiche.
  for (const [n, r] of releves.entries())
    ops.push(db.insert(releve).values({ id: newId(), acteId: r.acteId, individuId: r.individuId, role: r.role, nom: r.nom, prenoms: r.prenoms, sexe: r.sexe, ordre: n }));

  if (!ids.size) throw new Error("Aucune personne trouvée dans ce fichier.");
  // Une seule transaction : tout ou rien.
  await db.batch(ops as unknown as Parameters<typeof db.batch>[0]);
  return { individus: ids.size, familles: nbFamilles, documents: documents.size, registres: registres.size, lieux: nbLieux, avertissements: avertissements.slice(0, 20) };
}
