import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon, Alert, Button, Center, Group, Image, Paper, Progress, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput, Textarea, Title,
} from "@mantine/core";
import { IconCamera, IconCheck, IconPhoto, IconPhotoPlus, IconUpload, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { creerActe } from "../../data/actes";
import { listeRegistres } from "../../data/registres";
import { enregistrerBlob, type ImageEnregistree } from "../../lib/images";
import { LECTURE_SEULE } from "../../lib/mode";
import { ecrire } from "../../lib/query";
import { reduireImage } from "../../lib/reduireImage";

type Genre = "acte" | "photo";

// Dernier registre / album utilisé, par genre, mémorisé sur l'appareil.
const CLE_DERNIER = "tabularium.capture.dernier";
const lireDerniers = (): Record<string, string | null> => {
  try {
    return JSON.parse(localStorage.getItem(CLE_DERNIER) ?? "{}");
  } catch {
    return {};
  }
};
const lireDernier = (genre: Genre) => lireDerniers()[genre] ?? null;
const ecrireDernier = (genre: Genre, id: string | null) => {
  try {
    localStorage.setItem(CLE_DERNIER, JSON.stringify({ ...lireDerniers(), [genre]: id }));
  } catch {
    // sans importance
  }
};

const estAlbum = (typeRegistre: string | null) => (typeRegistre ?? "").toLowerCase().includes("album");

/** Image photographiée, avant l'envoi. */
type Prise = { fichier: File; apercu: string };

/**
 * Sur le terrain (aux archives, chez un parent) : photographier un acte ou une photo de famille,
 * page après page, puis l'envoyer. Le document arrive « à transcrire », à traiter plus tard sur grand écran.
 */
export function Capturer() {
  const navigate = useNavigate();
  const { data: registres = [] } = useQuery({ queryKey: ["registres"], queryFn: listeRegistres });
  const [genre, setGenre] = useState<Genre>("acte");
  const [prises, setPrises] = useState<Prise[]>([]);
  const [registre, setRegistre] = useState<string | null>(() => lireDernier("acte"));
  const [titre, setTitre] = useState("");
  const [note, setNote] = useState("");
  const [envoi, setEnvoi] = useState<{ fait: number; total: number } | null>(null);
  const [envoye, setEnvoye] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const appareil = useRef<HTMLInputElement>(null);
  const galerie = useRef<HTMLInputElement>(null);

  // Aperçus libérés en quittant la page.
  const apercus = useRef<Prise[]>([]);
  apercus.current = prises;
  useEffect(() => () => apercus.current.forEach((p) => URL.revokeObjectURL(p.apercu)), []);

  // Albums pour les photos, les autres registres pour les actes.
  const choix = useMemo(
    () => registres.filter((r) => (genre === "photo") === estAlbum(r.typeRegistre)).map((r) => ({ value: r.id, label: r.titre })),
    [registres, genre],
  );

  if (LECTURE_SEULE) {
    return (
      <Center h="100%" p="lg">
        <Text c="dimmed" ta="center">
          Votre compte est en lecture seule : la capture de documents est réservée aux comptes en écriture.
        </Text>
      </Center>
    );
  }

  const ajouter = (input: HTMLInputElement) => {
    const fichiers = Array.from(input.files ?? []);
    input.value = "";
    if (fichiers.length) setPrises((p) => [...p, ...fichiers.map((f) => ({ fichier: f, apercu: URL.createObjectURL(f) }))]);
  };
  const retirer = (i: number) =>
    setPrises((p) => {
      URL.revokeObjectURL(p[i].apercu);
      return p.filter((_, j) => j !== i);
    });

  const changerGenre = (g: Genre) => {
    setGenre(g);
    setRegistre(lireDernier(g));
  };

  const recommencer = () => {
    prises.forEach((p) => URL.revokeObjectURL(p.apercu));
    setPrises([]);
    setTitre("");
    setNote("");
    setEnvoye(null);
    setErreur(null);
  };

  const envoyer = async () => {
    setErreur(null);
    setEnvoi({ fait: 0, total: prises.length });
    try {
      const images: ImageEnregistree[] = [];
      for (const [i, p] of prises.entries()) {
        images.push(await enregistrerBlob(await reduireImage(p.fichier)));
        setEnvoi({ fait: i + 1, total: prises.length });
      }
      const sourceId = choix.some((c) => c.value === registre) ? registre : null;
      const id = await ecrire(() =>
        creerActe(images, {
          nature: genre,
          titre: titre.trim() || (genre === "photo" ? "Photo" : `Document capturé le ${new Date().toLocaleDateString("fr-FR")}`),
          sourceId,
          statut: "a_transcrire",
          notes: note.trim() || null,
        }),
      );
      if (!id) throw new Error("Le document n'a pas pu être créé.");
      ecrireDernier(genre, sourceId);
      setEnvoye(id);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnvoi(null);
    }
  };

  if (envoye) {
    return (
      <Center h="100%" p="lg">
        <Stack align="center" gap="sm" maw={340}>
          <IconCheck size={48} color="var(--mantine-color-teal-6)" />
          <Title order={3} ta="center">
            Envoyé
          </Title>
          <Text ta="center" c="dimmed" size="sm">
            {genre === "photo" ? "La photo est dans la galerie, à identifier" : "Le document est « à transcrire »"} : à traiter plus tard, sur
            ordinateur ou tablette.
          </Text>
          <Button size="md" leftSection={<IconCamera size={18} />} onClick={recommencer}>
            Capturer {genre === "photo" ? "une autre photo" : "un autre document"}
          </Button>
          <Button variant="subtle" onClick={() => navigate({ to: "/actes/$acteId", params: { acteId: envoye } })}>
            Voir ce qui a été envoyé
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="md" p="md" h="100%" style={{ overflowY: "auto" }}>
      <Title order={2}>Capturer</Title>
      <SegmentedControl
        fullWidth
        size="md"
        value={genre}
        onChange={(v) => changerGenre(v as Genre)}
        data={[
          { value: "acte", label: "Acte / archive" },
          { value: "photo", label: "Photo de famille" },
        ]}
      />

      {/* Appareil photo du téléphone, ou images déjà dans la galerie */}
      <input ref={appareil} type="file" accept="image/*" capture="environment" hidden onChange={(e) => ajouter(e.currentTarget)} />
      <input ref={galerie} type="file" accept="image/*" multiple hidden onChange={(e) => ajouter(e.currentTarget)} />
      <Group grow>
        <Button size="lg" leftSection={<IconCamera size={22} />} onClick={() => appareil.current?.click()}>
          {prises.length ? (genre === "photo" && prises.length === 1 ? "Verso" : "Suivante") : "Photographier"}
        </Button>
        <Button size="lg" variant="default" leftSection={<IconPhotoPlus size={22} />} onClick={() => galerie.current?.click()}>
          Galerie
        </Button>
      </Group>

      {prises.length > 0 ? (
        <SimpleGrid cols={3} spacing="xs">
          {prises.map((p, i) => (
            <Paper key={p.apercu} withBorder pos="relative" style={{ overflow: "hidden" }}>
              <Image src={p.apercu} h={110} fit="cover" alt={`Image ${i + 1}`} />
              <Text size="xs" ta="center" py={2}>
                {genre === "photo" ? (i === 0 ? "recto" : i === 1 ? "verso" : `image ${i + 1}`) : `page ${i + 1}`}
              </Text>
              <ActionIcon pos="absolute" top={4} right={4} color="red" radius="xl" onClick={() => retirer(i)} aria-label="Retirer">
                <IconX size={14} />
              </ActionIcon>
            </Paper>
          ))}
        </SimpleGrid>
      ) : (
        <Paper withBorder p="lg">
          <Stack align="center" gap={4} c="dimmed">
            <IconPhoto size={36} />
            <Text size="sm" ta="center">
              {genre === "photo"
                ? "Photographiez la photo, puis son verso s'il porte une inscription."
                : "Photographiez l'acte page après page : bien à plat, sans reflet."}
            </Text>
          </Stack>
        </Paper>
      )}

      <Select
        label={genre === "photo" ? "Album (facultatif)" : "Registre (facultatif)"}
        placeholder={genre === "photo" ? "Aucun album" : "Aucun registre"}
        data={choix}
        value={choix.some((c) => c.value === registre) ? registre : null}
        onChange={setRegistre}
        clearable
        searchable
      />
      <TextInput
        label="Titre (facultatif)"
        placeholder={genre === "photo" ? "Mariage de…" : "Naissance de…"}
        value={titre}
        onChange={(e) => setTitre(e.currentTarget.value)}
      />
      <Textarea
        label="Note (facultative)"
        placeholder={genre === "photo" ? "Qui l'a prêtée, ce qu'on en sait…" : "Cote, numéro de vue, où l'original est conservé…"}
        autosize
        minRows={2}
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
      />

      {erreur && <Alert color="red">{erreur}</Alert>}
      {envoi && <Progress value={(envoi.fait / Math.max(envoi.total, 1)) * 100} animated size="lg" />}
      <Button size="lg" leftSection={<IconUpload size={20} />} disabled={!prises.length} loading={!!envoi} onClick={envoyer}>
        Envoyer{prises.length > 1 ? ` les ${prises.length} images` : ""}
      </Button>
    </Stack>
  );
}
