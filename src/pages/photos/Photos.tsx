import { useState } from "react";
import {
  Badge, Button, Center, Checkbox, Group, Overlay, Paper, ScrollArea, Select, SimpleGrid, Stack, Text, TextInput, Title, Drawer,
} from "@mantine/core";
import { IconFilter, IconFolderPlus, IconPhoto, IconPhotoPlus, IconSearch, IconUpload } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { creerActe } from "../../data/actes";
import { listePhotos, type PhotoListe } from "../../data/photos";
import { creerRegistre, listeRegistres } from "../../data/registres";
import { IndividuSelect } from "../../components/selects";
import { useImportImages } from "../../hooks/useImportImages";
import { choisirImages, importerFichier, urlImage, type ImageEnregistree } from "../../lib/images";
import { nomComplet } from "../../lib/libelles";
import { LECTURE_SEULE } from "../../lib/mode";
import { clicOuvrir, useDefilement, useMemoire } from "../../lib/onglets";
import { ecrire } from "../../lib/query";
import { useEcran } from "../../lib/ecran";

const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function Vignette({ p }: { p: PhotoListe }) {
  const ouvrir = (e: React.MouseEvent) => clicOuvrir(e, `/actes/${p.id}`);
  return (
    <Paper withBorder radius="md" className="ligne-cliquable" onClick={ouvrir} onAuxClick={ouvrir} style={{ overflow: "hidden" }}>
      <div style={{ aspectRatio: "4 / 3", background: "var(--mantine-color-gray-1)" }}>
        {p.fichier ? (
          <img
            src={urlImage(p.fichier)}
            alt={p.titre}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <Center h="100%">
            <IconPhoto size={36} color="var(--mantine-color-gray-5)" />
          </Center>
        )}
      </div>
      <Stack gap={4} p="xs">
        <Text size="sm" fw={600} lineClamp={2}>
          {p.titre}
        </Text>
        {(p.date || p.lieuNom) && (
          <Text size="xs" c="dimmed">
            {[p.date, p.lieuNom].filter(Boolean).join(" · ")}
          </Text>
        )}
        {p.description && (
          <Text size="xs" lineClamp={2}>
            {p.description}
          </Text>
        )}
        <Group gap={4}>
          {p.identifies.length > 0 && (
            <Badge size="xs" variant="light" color="teal" title={p.identifies.map((i) => nomComplet(i)).join(", ")}>
              {p.identifies.length} identifié{p.identifies.length > 1 ? "s" : ""}
            </Badge>
          )}
          {p.nbInconnus > 0 && (
            <Badge size="xs" variant="light" color="orange">
              {p.nbInconnus} à identifier
            </Badge>
          )}
          {p.nbImages > 1 && (
            <Badge size="xs" variant="light" color="gray">
              recto / verso
            </Badge>
          )}
          {p.albumTitre && (
            <Badge size="xs" variant="outline" color="cyan" style={{ textTransform: "none" }}>
              {p.albumTitre}
            </Badge>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}

/** Galerie des photographies : portraits, photos de groupe… avec albums et personnes identifiées. */
export function Photos() {
  const { telephone } = useEcran();
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const navigate = useNavigate();
  const { data: photos = [], isSuccess } = useQuery({ queryKey: ["photos"], queryFn: listePhotos });
  const { data: registres = [] } = useQuery({ queryKey: ["registres"], queryFn: listeRegistres });
  const [album, setAlbum] = useMemoire<string | null>("photos.album", null);
  const [personne, setPersonne] = useMemoire<string | null>("photos.personne", null);
  const [aIdentifier, setAIdentifier] = useMemoire("photos.aIdentifier", false);
  const [texte, setTexte] = useMemoire("photos.texte", "");
  const defilement = useDefilement("photos", isSuccess);

  // Albums : registres de type « Album photo », et tout registre qui contient déjà des photos.
  const avecPhotos = new Set(photos.map((p) => p.sourceId).filter(Boolean));
  const albums = registres
    .filter((r) => (r.typeRegistre ?? "").toLowerCase().includes("album") || avecPhotos.has(r.id))
    .map((r) => ({ value: r.id, label: r.titre }));

  const filtrees = photos.filter(
    (p) =>
      (!album || p.sourceId === album) &&
      (!personne || p.identifies.some((i) => i.id === personne)) &&
      (!aIdentifier || p.nbInconnus > 0) &&
      (!texte ||
        sansAccents(
          `${p.titre} ${p.description ?? ""} ${p.date ?? ""} ${p.lieuNom ?? ""} ${p.albumTitre ?? ""} ${p.identifies.map((i) => nomComplet(i)).join(" ")}`,
        ).includes(sansAccents(texte))),
  );

  const filtres = (
    <>
      <Select w={{ base: "100%", sm: 220 }} placeholder="Album" data={albums} value={album} onChange={setAlbum} clearable searchable />
      <IndividuSelect w={{ base: "100%", sm: 260 }} placeholder="Personne sur la photo" value={personne} onChange={setPersonne} />
      <Checkbox label="À identifier seulement" checked={aIdentifier} onChange={(e) => setAIdentifier(e.currentTarget.checked)} />
    </>
  );

  // Chaque image devient une photo, rangée dans l'album filtré s'il y en a un.
  const importer = async (images: ImageEnregistree[]) => {
    const ids: string[] = [];
    for (const img of images) {
      const id = await ecrire(() => creerActe([img], { nature: "photo", titre: "Photo", sourceId: album }));
      if (id) ids.push(id);
    }
    if (ids.length === 1) navigate({ to: "/actes/$acteId", params: { acteId: ids[0] } });
  };
  const { survol } = useImportImages(importer);

  return (
    <Stack p="lg" gap="md" h="100%" pos="relative">
      {survol && (
        <Overlay color="var(--mantine-color-teal-1)" backgroundOpacity={0.85} zIndex={10}>
          <Center h="100%">
            <Stack align="center">
              <IconUpload size={48} />
              <Text size="xl">Déposer pour ajouter ces photos</Text>
              <Text c="dimmed">Une image = une photo ; le verso s'ajoute ensuite sur la photo</Text>
            </Stack>
          </Center>
        </Overlay>
      )}

      <Group justify="space-between">
        <Title order={2}>Photos</Title>
        {!LECTURE_SEULE && !telephone && (
          <Group>
            <Text size="sm" c="dimmed">
              Glissez des photos ici ou collez-les (Ctrl+V)
            </Text>
            <Button
              variant="default"
              leftSection={<IconFolderPlus size={18} />}
              onClick={async () => {
                const id = await ecrire(() => creerRegistre("Nouvel album", { typeRegistre: "Album photo" }));
                if (id) navigate({ to: "/registres/$sourceId", params: { sourceId: id } });
              }}
            >
              Nouvel album
            </Button>
            <Button
              leftSection={<IconPhotoPlus size={18} />}
              onClick={async () => {
                const chemins = await choisirImages();
                if (chemins.length) await importer(await Promise.all(chemins.map(importerFichier)));
              }}
            >
              Ajouter des photos
            </Button>
          </Group>
        )}
      </Group>

      {telephone ? (
        <Group gap="xs" wrap="nowrap">
          <TextInput
            style={{ flex: 1 }}
            placeholder="Rechercher…"
            leftSection={<IconSearch size={16} />}
            value={texte}
            onChange={(e) => setTexte(e.currentTarget.value)}
          />
          <Button variant={album || personne || aIdentifier ? "filled" : "default"} leftSection={<IconFilter size={16} />} onClick={() => setFiltresOuverts(true)}>
            Filtres
          </Button>
        </Group>
      ) : (
        <Group>
          <TextInput
            w={280}
            placeholder="Rechercher (description, lieu, personne…)"
            leftSection={<IconSearch size={16} />}
            value={texte}
            onChange={(e) => setTexte(e.currentTarget.value)}
          />
          {filtres}
          <Text size="sm" c="dimmed">
            {filtrees.length} photo{filtrees.length > 1 ? "s" : ""}
          </Text>
        </Group>
      )}
      <Drawer opened={filtresOuverts} onClose={() => setFiltresOuverts(false)} position="bottom" size="auto" title={`Filtres · ${filtrees.length} photo${filtrees.length > 1 ? "s" : ""}`}>
        <Stack gap="sm" pb="md">
          {filtres}
        </Stack>
      </Drawer>

      <ScrollArea flex={1} {...defilement}>
        {photos.length === 0 ? (
          <Center h={300}>
            <Stack align="center" c="dimmed">
              <IconPhoto size={48} />
              <Text>Aucune photo. Glissez des portraits ou des photos de groupe pour commencer.</Text>
            </Stack>
          </Center>
        ) : (
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4, xl: 6 }} spacing="md">
            {filtrees.map((p) => (
              <Vignette key={p.id} p={p} />
            ))}
          </SimpleGrid>
        )}
      </ScrollArea>
    </Stack>
  );
}
