import { useMemo } from "react";
import { Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { donneesArbre } from "../data/individus";
import { rattacher } from "../data/releves";
import { indexCandidats, type ContexteActe, type ReleveCible } from "../lib/candidats";
import { nomComplet } from "../lib/libelles";
import { resumeVie } from "../lib/evenements";
import { LigneSuggestion } from "../pages/liensActes";
import { ecrire } from "../lib/query";

/** L'index des candidats, recalculé seulement quand l'arbre change. */
export function useIndexCandidats() {
  const { data } = useQuery({ queryKey: ["arbre"], queryFn: donneesArbre });
  return useMemo(() => (data ? indexCandidats(data) : null), [data]);
}

type Props = { releve: ReleveCible; contexte: ContexteActe; max?: number };

/** « Peut-être : GOUADON Aimable René — père de … dans l'arbre, même nom [Rattacher] ». */
export function CandidatsRattachement({ releve, contexte, max = 3 }: Props) {
  const candidats = useIndexCandidats();
  const liste = candidats ? candidats(releve, contexte, max) : [];
  if (!liste.length) return null;
  return (
    <Stack gap={4}>
      {liste.map((c) => (
        <LigneSuggestion
          key={c.personne.id}
          texte={
            <>
              Peut-être : <b>{nomComplet(c.personne)}</b>
              {resumeVie(c.personne) && (
                <Text span size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                  {"  "}
                  {resumeVie(c.personne)}
                </Text>
              )}
            </>
          }
          detail={c.raisons.join(" · ")}
          bouton="Rattacher"
          onClick={() => ecrire(() => rattacher(releve.id, c.personne.id))}
        />
      ))}
    </Stack>
  );
}
