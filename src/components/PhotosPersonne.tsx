import { ActionIcon, Badge, Group, Paper, SimpleGrid, Stack, Text, Tooltip } from "@mantine/core";
import { IconPhoto, IconUserCircle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { majIndividu, type IndividuComplet } from "../data/individus";
import { photosIndividu } from "../data/photos";
import { urlImage } from "../lib/images";
import { LECTURE_SEULE } from "../lib/mode";
import { clicOuvrir } from "../lib/onglets";
import { ecrire } from "../lib/query";
import { Portrait } from "./Portrait";

/** Fiche individu : les photos où la personne est identifiée, recadrées sur elle ; choix du portrait. */
export function PhotosPersonne({ ind }: { ind: IndividuComplet }) {
  const { data: photos = [] } = useQuery({ queryKey: ["photos-individu", ind.id], queryFn: () => photosIndividu(ind.id) });
  if (!photos.length) return null;

  return (
    <Paper withBorder p="md">
      <Group gap="xs" mb="sm">
        <IconPhoto size={18} />
        <Text fw={600}>Photos</Text>
        <Badge size="sm" variant="light">
          {photos.length}
        </Badge>
      </Group>
      <SimpleGrid cols={{ base: 3, sm: 4 }} spacing="sm">
        {photos.map((p) => {
          const estPortrait = !!p.portrait && p.portrait.annotationId === ind.portraitAnnotationId;
          const ouvrir = (e: React.MouseEvent) => clicOuvrir(e, `/actes/${p.acteId}`);
          return (
            <Stack key={p.acteId} gap={4} pos="relative">
              <div className="ligne-cliquable" onClick={ouvrir} onAuxClick={ouvrir} title={p.titre}>
                {p.portrait ? (
                  <Portrait portrait={p.portrait} taille={112} rond={false} sexe={ind.sexe} />
                ) : p.fichier ? (
                  <img src={urlImage(p.fichier)} alt={p.titre} style={{ width: 112, height: 112, objectFit: "cover", borderRadius: 8, display: "block" }} />
                ) : null}
              </div>
              {p.portrait && !LECTURE_SEULE && (
                <Tooltip label={estPortrait ? "Portrait actuel (cliquer pour le retirer)" : "Utiliser comme portrait"}>
                  <ActionIcon
                    pos="absolute"
                    top={4}
                    left={84}
                    size="sm"
                    radius="xl"
                    variant={estPortrait ? "filled" : "white"}
                    onClick={() => ecrire(() => majIndividu(ind.id, { portraitAnnotationId: estPortrait ? null : p.portrait!.annotationId }))}
                  >
                    <IconUserCircle size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
              <Text size="xs" c="dimmed" lineClamp={2} w={112}>
                {[p.date, p.titre].filter(Boolean).join(" · ")}
              </Text>
            </Stack>
          );
        })}
      </SimpleGrid>
    </Paper>
  );
}
