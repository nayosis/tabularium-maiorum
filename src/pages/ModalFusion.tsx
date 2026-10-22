import { useEffect, useState } from "react";
import { Alert, Button, Group, Modal, Radio, Stack, Table, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconArrowMerge } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { Individu } from "../db/schema";
import { chargerIndividu, fusionnerIndividus, type IndividuComplet } from "../data/individus";
import { relevesIndividu } from "../data/releves";
import { libelleLieu } from "../lib/libelles";
import { IndividuSelect, libelleIndividu, useLieux } from "../components/selects";
import { SEXES, libelle, nomComplet } from "../lib/libelles";
import { ecrire } from "../lib/query";

type Choix = "cible" | "doublon" | "les_deux";

/** Champs comparés ; une date floue se déplace avec ses bornes. */
const CHAMPS: { cle: keyof Individu; label: string; groupe?: (keyof Individu)[]; fusionnable?: boolean }[] = [
  { cle: "nom", label: "Nom" },
  { cle: "prenoms", label: "Prénoms" },
  { cle: "sexe", label: "Sexe" },
  { cle: "naissance", label: "Naissance", groupe: ["naissance", "naissanceMin", "naissanceMax"] },
  { cle: "naissanceLieuId", label: "Lieu de naissance" },
  { cle: "deces", label: "Décès", groupe: ["deces", "decesMin", "decesMax"] },
  { cle: "decesLieuId", label: "Lieu de décès" },
  { cle: "profession", label: "Profession" },
  { cle: "notes", label: "Notes", fusionnable: true },
];

const vide = (v: unknown) => v == null || v === "" || v === "?";

type Props = { cible: IndividuComplet; opened: boolean; onClose: () => void };

export function ModalFusion({ cible, opened, onClose }: Props) {
  const [doublonId, setDoublonId] = useState<string | null>(null);
  const [choix, setChoix] = useState<Record<string, Choix>>({});
  const [enCours, setEnCours] = useState(false);
  const { data: lieux = [] } = useLieux();
  const { data: doublon } = useQuery({
    queryKey: ["individu", doublonId],
    queryFn: () => chargerIndividu(doublonId!),
    enabled: !!doublonId,
  });
  const { data: relevesDoublon = [] } = useQuery({
    queryKey: ["releves-individu", doublonId],
    queryFn: () => relevesIndividu(doublonId!),
    enabled: !!doublonId,
  });

  // Choix par défaut : on garde la cible, sauf si elle est vide et le doublon renseigné.
  useEffect(() => {
    if (!doublon) return;
    const c: Record<string, Choix> = {};
    for (const f of CHAMPS) c[f.cle] = vide(cible[f.cle]) && !vide(doublon[f.cle]) ? "doublon" : "cible";
    if (doublon.notes && cible.notes && doublon.notes !== cible.notes) c.notes = "les_deux";
    c.pere = "cible";
    c.mere = "cible";
    setChoix(c);
  }, [doublon?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fermer = () => {
    setDoublonId(null);
    onClose();
  };

  const afficher = (cle: keyof Individu, v: unknown) => {
    if (vide(v)) return <Text span c="dimmed">—</Text>;
    if (cle === "sexe") return libelle(SEXES, v as string);
    if (cle === "naissanceLieuId" || cle === "decesLieuId") {
      const l = lieux.find((x) => x.id === v);
      return l ? libelleLieu(l) : "?";
    }
    return <Text span size="sm" style={{ whiteSpace: "pre-wrap" }}>{String(v)}</Text>;
  };

  const conflits = doublon ? CHAMPS.filter((f) => !vide(cible[f.cle]) && !vide(doublon[f.cle]) && cible[f.cle] !== doublon[f.cle]) : [];
  const completes = doublon ? CHAMPS.filter((f) => vide(cible[f.cle]) && !vide(doublon[f.cle])) : [];
  const conflitPere = !!(doublon?.pere && cible.pere && doublon.pere.id !== cible.pere.id);
  const conflitMere = !!(doublon?.mere && cible.mere && doublon.mere.id !== cible.mere.id);

  const fusionner = async () => {
    if (!doublon) return;
    const patch: Partial<Individu> = {};
    for (const f of CHAMPS) {
      const c = choix[f.cle];
      if (c === "doublon") for (const k of f.groupe ?? [f.cle]) Object.assign(patch, { [k]: doublon[k] });
      if (c === "les_deux") Object.assign(patch, { [f.cle]: `${cible[f.cle]}\n\n${doublon[f.cle]}` });
    }
    const liens: { enfantId: string; parentId: string }[] = [];
    for (const [role, conflit] of [["pere", conflitPere], ["mere", conflitMere]] as const) {
      if (!conflit) continue;
      // Le lien écarté est supprimé avant le transfert.
      liens.push(
        choix[role] === "doublon"
          ? { enfantId: cible.id, parentId: cible[role]!.id }
          : { enfantId: doublon.id, parentId: doublon[role]!.id },
      );
    }
    setEnCours(true);
    const ok = await ecrire(async () => {
      await fusionnerIndividus(cible.id, doublon.id, patch, liens);
      return true;
    });
    setEnCours(false);
    if (ok) {
      notifications.show({ color: "teal", message: `${nomComplet(doublon)} a été fusionné dans cette fiche.` });
      fermer();
    }
  };

  const radios = (cle: string, a: React.ReactNode, b: React.ReactNode, deux = false) => (
    <Radio.Group value={choix[cle]} onChange={(v) => setChoix((c) => ({ ...c, [cle]: v as Choix }))}>
      <Stack gap={4}>
        <Radio value="cible" label={a} />
        <Radio value="doublon" label={b} />
        {deux && <Radio value="les_deux" label="Garder les deux (à la suite)" />}
      </Stack>
    </Radio.Group>
  );

  return (
    <Modal opened={opened} onClose={fermer} title={`Fusionner un doublon dans « ${nomComplet(cible)} »`} size="xl">
      <Stack>
        <IndividuSelect
          label="Fiche en double (elle sera supprimée après transfert)"
          exclure={cible.id}
          value={doublonId}
          onChange={setDoublonId}
          data-autofocus
        />

        {doublon && (
          <>
            {conflits.length + (conflitPere ? 1 : 0) + (conflitMere ? 1 : 0) > 0 ? (
              <Table withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={140}>Champ</Table.Th>
                    <Table.Th>Valeur à garder (en haut : cette fiche · en bas : le doublon)</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {conflits.map((f) => (
                    <Table.Tr key={f.cle}>
                      <Table.Td fw={500}>{f.label}</Table.Td>
                      <Table.Td>{radios(f.cle, afficher(f.cle, cible[f.cle]), afficher(f.cle, doublon[f.cle]), f.fusionnable)}</Table.Td>
                    </Table.Tr>
                  ))}
                  {conflitPere && (
                    <Table.Tr>
                      <Table.Td fw={500}>Père</Table.Td>
                      <Table.Td>{radios("pere", libelleIndividu(cible.pere!), libelleIndividu(doublon.pere!))}</Table.Td>
                    </Table.Tr>
                  )}
                  {conflitMere && (
                    <Table.Tr>
                      <Table.Td fw={500}>Mère</Table.Td>
                      <Table.Td>{radios("mere", libelleIndividu(cible.mere!), libelleIndividu(doublon.mere!))}</Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            ) : (
              <Text size="sm" c="dimmed">
                Aucune valeur contradictoire.
              </Text>
            )}

            {completes.length > 0 && (
              <Text size="sm">
                Complété depuis le doublon : {completes.map((f) => f.label.toLowerCase()).join(", ")}.
              </Text>
            )}

            <Alert variant="light" icon={<IconAlertTriangle size={18} />}>
              Seront transférés vers cette fiche : {relevesDoublon.length} relevé{relevesDoublon.length > 1 ? "s" : ""},{" "}
              {doublon.enfants.length} enfant{doublon.enfants.length > 1 ? "s" : ""}, {doublon.couples.length} union
              {doublon.couples.length > 1 ? "s" : ""}
              {doublon.pere || doublon.mere ? " et ses parents" : ""}. La fiche « {nomComplet(doublon)} » sera ensuite supprimée.
            </Alert>
          </>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={fermer}>
            Annuler
          </Button>
          <Button leftSection={<IconArrowMerge size={16} />} disabled={!doublon} loading={enCours} onClick={fusionner}>
            Fusionner
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
