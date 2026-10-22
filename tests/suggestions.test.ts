import { describe, expect, test } from "bun:test";
import type { ReleveAvecActe } from "../src/data/releves";
import { suggestionsFamille, type EtatFiche } from "../src/lib/suggestions";

let n = 0;
const r = (acteId: string, role: string, individuId: string | null, acteType: string | null = "naissance"): ReleveAvecActe =>
  ({ id: `r${++n}`, acteId, role, individuId, acteType, acteTitre: `Acte ${acteId}`, nomEcrit: `N${n}` }) as ReleveAvecActe;

const etat = (patch: Partial<EtatFiche> = {}): EtatFiche => ({
  id: "henri", pereId: null, mereId: null, acteNaissanceId: null, acteDecesId: null, couples: [], ...patch,
});

// Acte de naissance d'Henri : père rattaché (ernest), mère non rattachée, témoin.
const naissance = [r("n1", "enfant", "henri"), r("n1", "père", "ernest"), r("n1", "mère", null), r("n1", "témoin", "louisH")];
// Mariage d'Henri : épouse rattachée (jeanne), parents de l'époux.
const mariage = [
  r("m1", "époux", "henri", "mariage"), r("m1", "épouse", "jeanne", "mariage"),
  r("m1", "père de l'époux", "ernest", "mariage"), r("m1", "mère de l'époux", "louise", "mariage"),
];
const tous = [...naissance, ...mariage];
const personne = tous.filter((x) => x.individuId === "henri");

describe("suggestionsFamille", () => {
  test("parents, conjoint et acte de naissance proposés", () => {
    const s = suggestionsFamille(etat(), personne, tous);
    const parents = s.filter((x) => x.type === "parent").map((x) => x.type === "parent" && `${x.role}:${x.releve.individuId ?? "?"}`);
    // père ernest (2 actes, une seule fois), mère non rattachée (acte de naissance), mère louise (mariage)
    expect(parents).toEqual(["pere:ernest", "mere:?", "mere:louise"]);
    const union = s.find((x) => x.type === "union");
    expect(union).toMatchObject({ typeUnion: "mariage", acteMariage: true, releve: { individuId: "jeanne" } });
    expect(s.find((x) => x.type === "acte")).toMatchObject({ quoi: "naissance", source: { acteId: "n1" } });
  });

  test("rien de déjà présent dans la fiche", () => {
    const s = suggestionsFamille(
      etat({ pereId: "ernest", mereId: "louise", acteNaissanceId: "n1", couples: [{ id: "c1", conjointId: "jeanne", acteId: "m1" }] }),
      personne,
      tous,
    );
    // Reste la mère non rattachée de l'acte de naissance (peut-être une autre écriture de Louise).
    expect(s.map((x) => x.type)).toEqual(["parent"]);
    expect(s[0]).toMatchObject({ role: "mere", remplace: true });
  });

  test("union connue sans acte : proposer d'y associer l'acte de mariage", () => {
    const s = suggestionsFamille(etat({ couples: [{ id: "c1", conjointId: "jeanne", acteId: null }] }), personne, tous);
    expect(s.find((x) => x.type === "acteUnion")).toMatchObject({ coupleId: "c1", source: { acteId: "m1" } });
    expect(s.some((x) => x.type === "union")).toBe(false);
  });

  test("parents d'un enfant : union proposée entre père et mère", () => {
    const pere = naissance[1];
    const s = suggestionsFamille({ ...etat(), id: "ernest" }, [pere], naissance);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ type: "union", typeUnion: "inconnu", acteMariage: false });
  });

  test("reconnaissance par la mère déjà liée : proposer l'acte comme justificatif", () => {
    const reco = [r("rc1", "enfant", "henri", "reconnaissance"), r("rc1", "mère", "louise", "reconnaissance")];
    const s = suggestionsFamille(
      etat({ mereId: "louise", liens: { pere: null, mere: { filiationId: "f1", acteId: "n1" } } }),
      [reco[0]],
      reco,
    );
    expect(s).toEqual([expect.objectContaining({ type: "acteFiliation", role: "mere", filiationId: "f1", source: expect.objectContaining({ acteId: "rc1" }) })]);
    // Déjà associé : plus rien à proposer.
    expect(suggestionsFamille(etat({ mereId: "louise", liens: { pere: null, mere: { filiationId: "f1", acteId: "rc1" } } }), [reco[0]], reco)).toEqual([]);
  });

  test("page d'index : aucune suggestion entre lignes voisines", () => {
    const table = [
      { ...r("t1", "enfant", "henri", "table_decennale"), acteNature: "index" },
      { ...r("t1", "père", "ernest", "table_decennale"), acteNature: "index" },
      { ...r("t1", "épouse", "jeanne", "table_decennale"), acteNature: "index" },
    ] as typeof naissance;
    expect(suggestionsFamille(etat(), [table[0]], table)).toEqual([]);
  });

  test("acte de décès du défunt", () => {
    const deces = [r("d1", "défunt", "henri", "deces"), r("d1", "conjoint du défunt", "jeanne", "deces")];
    const s = suggestionsFamille(etat({ couples: [{ id: "c1", conjointId: "jeanne", acteId: "m1" }] }), [deces[0]], deces);
    expect(s).toEqual([expect.objectContaining({ type: "acte", quoi: "deces" })]);
  });
});
