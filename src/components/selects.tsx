import { Select, type SelectProps } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { creerLieu, listeLieux } from "../data/lieux";
import { libelleLieu } from "../lib/libelles";
import { creerSource, listeSources } from "../data/actes";
import { listeIndividus, type IndividuListe } from "../data/individus";
import { cleHomonyme, distinctions, groupesHomonymes, mention as mentionDe, suffixe } from "../lib/homonymes";
import { ecrire } from "../lib/query";
import { nomComplet } from "../lib/libelles";
import { SelectCreable } from "./SelectCreable";

export const useLieux = () => useQuery({ queryKey: ["lieux"], queryFn: listeLieux });
export const useIndividus = () => useQuery({ queryKey: ["individus"], queryFn: listeIndividus });

type SelectIdProps = { label?: string; value: string | null; onChange: (id: string | null) => void };

/** Saisie « Brissac 49 » ou « Brissac (49) » → nom + département. */
function decouperLieu(texte: string) {
  const m = texte.match(/^(.*?)[\s(]+(\d[\dAB]?)\)?$/);
  return m ? { nom: m[1].trim(), departement: m[2] } : { nom: texte, departement: null };
}

export function LieuSelect(props: SelectIdProps) {
  const { data = [] } = useLieux();
  return (
    <SelectCreable
      {...props}
      placeholder="Commune"
      data={data.map((l) => ({ value: l.id, label: libelleLieu(l) }))}
      onCreate={(t) => {
        const { nom, departement } = decouperLieu(t);
        return nom ? ecrire(() => creerLieu(nom, departement)) : Promise.resolve(undefined);
      }}
    />
  );
}

export function SourceSelect(props: SelectIdProps) {
  const { data = [] } = useQuery({ queryKey: ["sources"], queryFn: listeSources });
  return (
    <SelectCreable
      {...props}
      placeholder="Registre (ex. NMD Brissac 1893-1902)"
      data={data.map((s) => ({ value: s.id, label: s.titre }))}
      onCreate={(t) => (t ? ecrire(() => creerSource(t)) : Promise.resolve(undefined))}
    />
  );
}

const annee = (d: string | null) => d?.slice(0, 4) ?? "?";

type PersonneDatee = Pick<IndividuListe, "nom" | "prenoms" | "naissanceMin" | "naissanceMax" | "decesMin" | "decesMax">;
const dates = (i: PersonneDatee) => (i.naissanceMin || i.naissanceMax || i.decesMin ? `${annee(i.naissanceMin ?? i.naissanceMax)}–${i.decesMin ? annee(i.decesMin) : ""}` : null);

export const libelleIndividu = (i: PersonneDatee) => {
  const d = dates(i);
  return nomComplet(i) + (d ? ` (${d})` : "");
};

type Nommable = { id?: string | null; nom?: string | null; prenoms?: string | null };

/**
 * Noms qui distinguent les homonymes : « VEILLON François (Denault, °1742) ».
 * `nom` pour les titres et les listes, `libelle` pour les menus de choix (dates fusionnées dans la parenthèse),
 * `mention` pour le seul contenu de la parenthèse, `distinction` pour ses éléments, `homonymes` pour les autres
 * personnes du même nom.
 */
export function useNoms() {
  const { data = [] } = useIndividus();
  const { parId, groupes, liste } = useMemo(() => {
    const groupes = groupesHomonymes(data);
    return { parId: distinctions(data), groupes, liste: new Map(data.map((i) => [i.id, i])) };
  }, [data]);
  const nom = useCallback((p: Nommable) => nomComplet(p) + suffixe(p.id ? parId.get(p.id) : undefined), [parId]);
  const libelle = useCallback((p: Nommable & PersonneDatee) => {
    const d = p.id ? parId.get(p.id) : undefined;
    return d ? nomComplet(p) + suffixe(d, dates(p)) : libelleIndividu(p);
  }, [parId]);
  const mention = useCallback((id: string | null | undefined) => (id ? mentionDe(parId.get(id)) : null), [parId]);
  const homonymes = useCallback(
    (p: Nommable) => {
      const cle = cleHomonyme({ nom: p.nom ?? null, prenoms: p.prenoms ?? null });
      return (cle ? (groupes.get(cle) ?? []) : []).filter((id) => id !== p.id).map((id) => liste.get(id)!);
    },
    [groupes, liste],
  );
  const distinction = useCallback((id: string | null | undefined) => (id ? parId.get(id) : undefined), [parId]);
  return { nom, libelle, mention, homonymes, distinction };
}

export function IndividuSelect({
  sexe,
  exclure,
  ...props
}: SelectIdProps & { sexe?: "M" | "F"; exclure?: string } & Omit<SelectProps, "value" | "onChange" | "data">) {
  const { data = [] } = useIndividus();
  const { libelle } = useNoms();
  const options = data
    .filter((i) => i.id !== exclure && (!sexe || i.sexe === sexe || !i.sexe || i.sexe === "?" || i.id === props.value))
    .map((i) => ({ value: i.id, label: libelle(i) }));
  return (
    <Select
      searchable
      clearable
      nothingFoundMessage="Aucun individu"
      placeholder="Chercher un individu"
      {...props}
      data={options}
      value={props.value}
      onChange={(v) => props.onChange(v)}
    />
  );
}
