import { ActionIcon, Button, Group, Paper, Select, Text, Tooltip } from "@mantine/core";
import { IconBulb, IconExternalLink } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listeActes } from "../data/actes";
import { changerParent, creerCouple, majCouple, majFiliation, type IndividuComplet } from "../data/individus";
import { creerIndividuDepuisReleve, type ReleveAvecActe } from "../data/releves";
import { nomComplet } from "../lib/libelles";
import { LECTURE_SEULE } from "../lib/mode";
import { AnchorLink } from "../components/AnchorLink";
import { ACTES_FILIATION, type SuggestionActeFiliation, type SuggestionActeUnion, type SuggestionParent, type SuggestionUnion } from "../lib/suggestions";

type ActeSelectProps = {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  /** Actes à proposer en premier (ceux où la personne apparaît). */
  prioritaires: string[];
};

/** Choix d'un acte : d'abord ceux où la personne apparaît, puis tous les autres. */
export function ActeSelect({ label, value, onChange, prioritaires }: ActeSelectProps) {
  const navigate = useNavigate();
  const { data: actes = [] } = useQuery({ queryKey: ["actes"], queryFn: listeActes });
  const option = (a: (typeof actes)[number]) => ({ value: a.id, label: a.titre });
  const siens = actes.filter((a) => prioritaires.includes(a.id));
  const autres = actes.filter((a) => !prioritaires.includes(a.id));
  const data = [
    ...(siens.length ? [{ group: "Actes où la personne apparaît", items: siens.map(option) }] : []),
    { group: "Autres actes", items: autres.map(option) },
  ];
  return (
    <Group gap={4} wrap="nowrap" align="flex-end">
      <Select flex={1} label={label} placeholder="Aucun" searchable clearable data={data} value={value} onChange={onChange} nothingFoundMessage="Aucun acte" />
      {value && LECTURE_SEULE && (
        // Sur le site, le sélecteur est figé : un simple lien pour ouvrir l'acte.
        <AnchorLink to="/actes/$acteId" params={{ acteId: value }} size="xs" mb={10} style={{ whiteSpace: "nowrap" }}>
          Ouvrir
        </AnchorLink>
      )}
      {value && !LECTURE_SEULE && (
        <Tooltip label="Ouvrir l'acte">
          <ActionIcon variant="subtle" mb={4} onClick={() => navigate({ to: "/actes/$acteId", params: { acteId: value } })}>
            <IconExternalLink size={16} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}

/** Encart « suggestion » avec un bouton d'action. */
export function LigneSuggestion({ texte, detail, bouton, onClick }: { texte: React.ReactNode; detail?: string; bouton: string; onClick: () => void }) {
  if (LECTURE_SEULE) return null;
  return (
    <Paper p={6} px="xs" bg="yellow.0" style={{ border: "1px solid var(--mantine-color-yellow-3)" }}>
      <Group gap="xs" wrap="nowrap">
        <IconBulb size={16} color="var(--mantine-color-yellow-7)" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs">{texte}</Text>
          {detail && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {detail}
            </Text>
          )}
        </div>
        <Button size="compact-xs" onClick={onClick}>
          {bouton}
        </Button>
      </Group>
    </Paper>
  );
}

/** Nom affiché pour la personne d'un relevé (l'individu rattaché, sinon le nom écrit). */
export const nomDuReleve = (r: ReleveAvecActe) =>
  r.individuId
    ? nomComplet({ nom: r.individuNom, prenoms: r.individuPrenoms })
    : `${[r.nomEcrit || r.nom, r.prenomsEcrits || r.prenoms].filter(Boolean).join(" ") || "Personne sans nom"} (relevé non rattaché)`;

export const origine = (s: { source: ReleveAvecActe; releve?: ReleveAvecActe }) =>
  `${s.source.acteTitre}${s.releve?.role ? ` — ${s.releve.role}` : ""}`;

function sexeDuRole(role: string | null): "M" | "F" | null {
  const r = (role ?? "").toLowerCase();
  if (r.startsWith("mère") || r.startsWith("épouse") || r === "marraine") return "F";
  if (r.startsWith("père") || r.startsWith("époux") || r === "parrain") return "M";
  return null;
}

/** L'individu du relevé ; s'il n'est rattaché à personne, on le crée depuis le relevé. */
async function individuDuReleve(r: ReleveAvecActe): Promise<string> {
  return r.individuId ?? creerIndividuDepuisReleve({ ...r, sexe: r.sexe ?? sexeDuRole(r.role) });
}

/** Type de filiation selon l'acte qui l'établit. */
const typeFiliation = (acteType: string | null) =>
  acteType === "reconnaissance" ? "reconnue" : acteType === "legitimation" ? "legitimee" : "biologique";

export async function appliquerParent(ind: IndividuComplet, s: SuggestionParent) {
  const parentId = await individuDuReleve(s.releve);
  const actuel = s.role === "pere" ? ind.pere?.id : ind.mere?.id;
  // L'acte d'où vient la suggestion devient le justificatif du lien.
  await changerParent(ind.id, actuel ?? null, parentId, { type: typeFiliation(s.source.acteType), acteId: s.source.acteId });
}

export async function appliquerActeFiliation(s: SuggestionActeFiliation) {
  await majFiliation(s.filiationId, {
    acteId: s.source.acteId,
    ...(ACTES_FILIATION.includes(s.source.acteType ?? "") && { type: typeFiliation(s.source.acteType) }),
  });
}

/** Date et lieu de l'acte, pour une union ou un événement qui n'en a pas encore. */
const dateEtLieu = (a: ReleveAvecActe) => ({ date: a.acteDate, dateMin: a.acteDateMin, dateMax: a.acteDateMax, lieuId: a.acteLieuId });

export async function appliquerUnion(ind: IndividuComplet, s: SuggestionUnion) {
  const conjointId = await individuDuReleve(s.releve);
  await creerCouple(ind.id, conjointId, s.acteMariage ? { type: "mariage", acteId: s.source.acteId, ...dateEtLieu(s.source) } : { type: s.typeUnion });
}

export async function appliquerActeUnion(ind: IndividuComplet, s: SuggestionActeUnion) {
  const c = ind.couples.find((x) => x.id === s.coupleId);
  const complement = dateEtLieu(s.source);
  await majCouple(s.coupleId, {
    acteId: s.source.acteId,
    // Date et lieu repris de l'acte seulement s'ils manquent.
    ...(!c?.date && { date: complement.date, dateMin: complement.dateMin, dateMax: complement.dateMax }),
    ...(!c?.lieuId && complement.lieuId && { lieuId: complement.lieuId }),
  });
}
