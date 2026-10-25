import { useState } from "react";
import { Alert, Anchor, Badge, Button, Code, Group, Text } from "@mantine/core";
import { IconRocket } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { appelApi } from "../lib/rpc";
import { estAdmin } from "../lib/session";
import type { EtatMiseAJour, Installation } from "../lib/versions";

/** État de la mise à jour (vérifié par le serveur, au plus deux fois par jour). */
export const useMiseAJour = () =>
  useQuery({
    queryKey: ["mise-a-jour"],
    queryFn: () => appelApi<EtatMiseAJour>("/api/mise-a-jour", { silencieux: true }),
    staleTime: 6 * 3600 * 1000,
    retry: false,
  });

/** Comment mettre à jour, selon l'installation. */
export function InstructionsMiseAJour({ installation }: { installation: Installation }) {
  if (installation === "docker")
    return (
      <Text size="sm">
        Sur le serveur, dans le dossier de Tabularium : <Code>docker compose pull && docker compose up -d</Code>. Les données ne
        sont pas touchées.
      </Text>
    );
  if (installation === "ordinateur")
    return (
      <Text size="sm">
        Télécharger le zip de votre système sur la page de la version, puis remplacer le dossier du programme par le nouveau.
        Vos données (Documents/Tabularium) ne sont pas touchées.
      </Text>
    );
  return (
    <Text size="sm">
      Depuis les sources : <Code>git pull && bun install && bun run build</Code>, puis redémarrer.
    </Text>
  );
}

const CLE_IGNOREE = "tabularium.miseAJour.ignoree";
const lireIgnoree = () => {
  try {
    return localStorage.getItem(CLE_IGNOREE);
  } catch {
    return null;
  }
};

/** Accueil, pour les admins : une nouvelle version est disponible (masquable jusqu'à la suivante). */
export function AvisMiseAJour() {
  const { data } = useMiseAJour();
  const [ignoree, setIgnoree] = useState(lireIgnoree);
  if (!estAdmin() || !data?.disponible || !data.derniere || ignoree === data.derniere) return null;
  const ignorer = () => {
    setIgnoree(data.derniere!);
    try {
      localStorage.setItem(CLE_IGNOREE, data.derniere!);
    } catch {
      // stockage indisponible : l'avis reviendra à la prochaine visite
    }
  };
  return (
    <Alert color="teal" icon={<IconRocket size={18} />} title={`Nouvelle version disponible : ${data.derniere}`} withCloseButton onClose={ignorer}>
      <Text size="sm" mb="xs">
        Vous utilisez la version {data.actuelle}.{" "}
        {data.url && (
          <Anchor href={data.url} target="_blank" rel="noopener noreferrer">
            Voir les nouveautés
          </Anchor>
        )}
      </Text>
      <InstructionsMiseAJour installation={data.installation} />
    </Alert>
  );
}

/** Menu du compte : petit signal pour les admins. */
export function BadgeMiseAJour() {
  const { data } = useMiseAJour();
  if (!estAdmin() || !data?.disponible) return null;
  return (
    <Badge size="xs" color="teal" variant="filled" title={`Version ${data.derniere} disponible`}>
      MAJ
    </Badge>
  );
}

/** Présentation : version utilisée et état de la mise à jour. */
export function EtatVersion() {
  const { data } = useMiseAJour();
  if (!data) return null;
  return (
    <Group gap="xs" wrap="wrap">
      <Text size="sm">
        Version utilisée : <b>{data.actuelle}</b>
      </Text>
      {!data.verifiee ? (
        <Text size="sm" c="dimmed">
          (vérification des nouvelles versions désactivée ou impossible)
        </Text>
      ) : data.disponible ? (
        <>
          <Badge color="teal">nouvelle version {data.derniere} disponible</Badge>
          {data.url && (
            <Button component="a" href={data.url} target="_blank" rel="noopener noreferrer" size="compact-sm" variant="light">
              Nouveautés et téléchargement
            </Button>
          )}
        </>
      ) : (
        <Badge color="gray" variant="light">
          à jour
        </Badge>
      )}
    </Group>
  );
}
