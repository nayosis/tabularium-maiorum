import { Select, type SelectProps } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { creerLieu, listeLieux } from "../data/lieux";
import { libelleLieu } from "../lib/libelles";
import { creerSource, listeSources } from "../data/actes";
import { listeIndividus, type IndividuListe } from "../data/individus";
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

export const libelleIndividu = (i: Pick<IndividuListe, "nom" | "prenoms" | "naissanceMin" | "naissanceMax" | "decesMin" | "decesMax">) => {
  const dates = i.naissanceMin || i.naissanceMax || i.decesMin ? ` (${annee(i.naissanceMin ?? i.naissanceMax)}–${i.decesMin ? annee(i.decesMin) : ""})` : "";
  return nomComplet(i) + dates;
};

export function IndividuSelect({
  sexe,
  exclure,
  ...props
}: SelectIdProps & { sexe?: "M" | "F"; exclure?: string } & Omit<SelectProps, "value" | "onChange" | "data">) {
  const { data = [] } = useIndividus();
  const options = data
    .filter((i) => i.id !== exclure && (!sexe || i.sexe === sexe || !i.sexe || i.sexe === "?" || i.id === props.value))
    .map((i) => ({ value: i.id, label: libelleIndividu(i) }));
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
