import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon, Badge, Box, Button, Center, ColorSwatch, Drawer, Group, Image, Loader, Menu, Overlay, ScrollArea, SegmentedControl, Select, Stack, Tabs, Text,
  TextInput, Tooltip, UnstyledButton,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft, IconDots, IconLayoutSidebarRight, IconDownload, IconNote, IconPhoto, IconPhotoPlus, IconPlus, IconRefresh, IconTrash, IconUpload, IconUserCheck, IconX,
} from "@tabler/icons-react";
import { useMediaQuery } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { atelierRoute } from "../../router";
import type { Annotation, Rect } from "../../db/schema";
import {
  ajouterPages, annotationsPages, chargerActe, creerActeSurPages, creerZoneNote, creerZonePersonne, creerZonePourReleve, lierPage,
  listeSources, majActe, majAnnotation, retirerPage, supprimerActe, supprimerAnnotation, voisinsDansLaLiasse, type ActeComplet,
} from "../../data/actes";
import { creerReleve, relevesActe, type ReleveActe } from "../../data/releves";
import { libelleLieu } from "../../lib/libelles";
import { useLieux } from "../../components/selects";
import { useAutoSave } from "../../hooks/useAutoSave";
import { useImportImages } from "../../hooks/useImportImages";
import { choisirImages, importerFichier, urlImage, type ImageEnregistree } from "../../lib/images";
import {
  CONFIANCES, NATURES, STATUTS_ACTE, TYPES_ACTE, TYPES_INDEX, couleurRole, libelle, libelleType, nomComplet,
} from "../../lib/libelles";
import { ecrire } from "../../lib/query";
import { titreAuto } from "../../lib/titres";
import { Visionneuse, type Mode } from "./Visionneuse";
import { FormNote, FormReleve } from "./FormReleve";
import { PanneauActe, PanneauTranscription } from "./PanneauActe";
import { COULEUR_NOTE, texteAutoReleve } from "./bulles";
import { LECTURE_SEULE } from "../../lib/mode";
import { Lecture } from "../../components/Lecture";
import { retour } from "../../lib/onglets";
import { NavRegistre } from "./NavRegistre";
import { telechargerImages } from "../../lib/telechargement";
import { FormIdentification } from "./FormIdentification";
import { useEcran } from "../../lib/ecran";
import { VisionneuseMobile } from "../mobile/VisionneuseMobile";
import { useMemoire } from "../../lib/onglets";
import { BoutonCitation } from "../../components/Citations";

type Selection = { releveId: string } | { annotationId: string } | null;

/** Document : atelier d'annotation sur grand écran ; visionneuse simple en lecture sur téléphone. */
export function Atelier() {
  const { acteId } = atelierRoute.useParams();
  const { releve } = atelierRoute.useSearch();
  const { telephone } = useEcran();
  return telephone ? <VisionneuseMobile key={acteId} acteId={acteId} releveInitial={releve} /> : <AtelierComplet />;
}

function AtelierComplet() {
  const { acteId } = atelierRoute.useParams();
  const { releve: releveInitial } = atelierRoute.useSearch();
  const navigate = useNavigate();

  const acteQ = useQuery({ queryKey: ["acte", acteId], queryFn: () => chargerActe(acteId) });
  const relevesQ = useQuery({ queryKey: ["releves", acteId], queryFn: () => relevesActe(acteId) });
  const pageIds = acteQ.data?.pages.map((p) => p.id) ?? [];
  const annotationsQ = useQuery({
    queryKey: ["annotations", acteId, pageIds.join(",")],
    queryFn: () => annotationsPages(pageIds),
    enabled: !!acteQ.data,
  });

  const { data: liasse } = useQuery({ queryKey: ["liasse", acteId], queryFn: () => voisinsDansLaLiasse(acteId) });
  const [indexPage, setIndexPage] = useState(0);
  const [selection, setSelection] = useState<Selection>(releveInitial ? { releveId: releveInitial } : null);
  const [mode, setMode] = useState<Mode>("personne");
  const [onglet, setOnglet] = useMemoire<string | null>("atelier.onglet", "releves");
  // Tablette en portrait : pas la place pour le panneau de 440 px ; il devient un tiroir, ouvert à la sélection.
  const etroit = useMediaQuery("(max-width: 1023.98px)", false, { getInitialValueInEffect: false });
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  const cleSelection = selection ? ("releveId" in selection ? selection.releveId : selection.annotationId) : null;
  useEffect(() => {
    if (cleSelection) setPanneauOuvert(true);
  }, [cleSelection]);
  const tracerZone = () => {
    setMode("zone-releve");
    setPanneauOuvert(false);
  };

  const ajouter = async (images: ImageEnregistree[]) => {
    await ecrire(() => ajouterPages(acteId, images));
    setIndexPage(pageIds.length);
  };
  const { survol } = useImportImages(ajouter);

  const acte = acteQ.data;
  const releves = relevesQ.data ?? [];
  const annotations = annotationsQ.data ?? [];
  const relevesParId = useMemo(() => new Map(releves.map((r) => [r.id, r])), [releves]);

  if (acteQ.isLoading) return <Center h="100%"><Loader /></Center>;
  if (!acte) return <Center h="100%"><Text>Document introuvable.</Text></Center>;

  const page = acte.pages[Math.min(indexPage, acte.pages.length - 1)];
  const annotationsPage = page ? annotations.filter((a) => a.pageId === page.id) : [];

  const releveSel = selection && "releveId" in selection ? relevesParId.get(selection.releveId) : undefined;
  const noteSel = selection && "annotationId" in selection ? annotations.find((a) => a.id === selection.annotationId) : undefined;
  const annotationSel = releveSel ? annotationsPage.find((a) => a.releveId === releveSel.id) : noteSel?.pageId === page?.id ? noteSel : undefined;

  const selectionner = (a: Annotation | null) => {
    if (mode === "zone-releve") setMode("personne");
    setSelection(a ? (a.releveId ? { releveId: a.releveId } : { annotationId: a.id }) : null);
    if (a) setOnglet("releves");
  };

  const choisirReleve = (id: string) => {
    setSelection({ releveId: id });
    // Si sa zone est sur une autre page, on y va.
    const surCettePage = annotationsPage.some((a) => a.releveId === id);
    const ailleurs = annotations.find((a) => a.releveId === id);
    if (!surCettePage && ailleurs) setIndexPage(acte.pages.findIndex((p) => p.id === ailleurs.pageId));
  };

  const surRect = async (rect: Rect, ajout: boolean) => {
    if (!page) return;
    if (ajout && annotationSel) {
      await ecrire(() => majAnnotation(annotationSel.id, { rectangles: [...annotationSel.rectangles, rect] }));
    } else if (mode === "zone-releve" && releveSel) {
      await ecrire(() => creerZonePourReleve(acteId, page.id, releveSel.id, rect));
      setMode("personne");
    } else if (mode === "note") {
      const id = await ecrire(() => creerZoneNote(acteId, page.id, rect));
      if (id) setSelection({ annotationId: id });
    } else {
      const id = await ecrire(() => creerZonePersonne(acteId, page.id, rect));
      if (id) setSelection({ releveId: id });
    }
    setOnglet("releves");
  };

  const supprimerZone = (zone: Annotation | undefined = annotationSel, dernierRectangle = false) => {
    if (!zone) return;
    modals.openConfirmModal({
      title: dernierRectangle ? "C'est le seul rectangle de cette zone" : "Supprimer cette zone ?",
      children: (
        <Text size="sm">
          {dernierRectangle && "Le retirer supprime la zone entière. "}
          {zone.releveId ? "Le relevé est conservé, seule la zone surlignée est retirée." : "La note sera supprimée."}
        </Text>
      ),
      labels: { confirm: "Supprimer la zone", cancel: "Annuler" },
      confirmProps: { color: "red" },
      onConfirm: () => ecrire(() => supprimerAnnotation(zone.id)),
    });
  };

  const panneau = (
        <Tabs value={acte.nature === "photo" && onglet === "transcription" ? "releves" : onglet} onChange={setOnglet} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <Tabs.List>
            <Tabs.Tab value="releves">
              {acte.nature === "photo" ? "Personnes" : "Relevés"} ({releves.length})
            </Tabs.Tab>
            <Tabs.Tab value="acte">{acte.nature === "photo" ? "Photo" : "Acte"}</Tabs.Tab>
            {acte.nature !== "photo" && <Tabs.Tab value="transcription">Transcription</Tabs.Tab>}
          </Tabs.List>
          <ScrollArea flex={1} p="md">
            <Tabs.Panel value="releves">
              {releveSel && acte.nature === "photo" ? (
                <FormIdentification
                  key={`${releveSel.id}-${annotationSel?.id ?? ""}`}
                  releve={releveSel}
                  zone={annotationSel}
                  onRetour={() => setSelection(null)}
                  onTracerZone={tracerZone}
                />
              ) : releveSel ? (
                <FormReleve
                  key={`${releveSel.id}-${annotationSel?.id ?? ""}`}
                  releve={releveSel}
                  acte={acte}
                  zone={annotationSel}
                  onRetour={() => setSelection(null)}
                  onTracerZone={tracerZone}
                  autres={releves}
                />
              ) : noteSel ? (
                <FormNote key={noteSel.id} annotation={noteSel} onRetour={() => setSelection(null)} />
              ) : (
                <ListeReleves
                  photo={acte.nature === "photo"}
                  releves={releves}
                  notes={annotations.filter((a) => !a.releveId && a.acteId === acteId)}
                  onReleve={choisirReleve}
                  onNote={(a) => {
                    setSelection({ annotationId: a.id });
                    setIndexPage(acte.pages.findIndex((p) => p.id === a.pageId));
                  }}
                  onNouveau={async () => {
                    const id = await ecrire(() => creerReleve(acteId));
                    if (id) setSelection({ releveId: id });
                  }}
                />
              )}
            </Tabs.Panel>
            <Tabs.Panel value="acte">
              <Lecture>
                <PanneauActe key={`${acte.id}-${acte.nature}`} acte={acte} pageId={page?.id} />
              </Lecture>
            </Tabs.Panel>
            <Tabs.Panel value="transcription">
              <Lecture>
                <PanneauTranscription key={acte.id} acte={acte} />
              </Lecture>
            </Tabs.Panel>
          </ScrollArea>
        </Tabs>
  );

  return (
    <Stack gap={0} h="100%" pos="relative">
      {survol && (
        <Overlay color="var(--mantine-color-teal-1)" backgroundOpacity={0.85} zIndex={50}>
          <Center h="100%">
            <Stack align="center">
              <IconUpload size={48} />
              <Text size="xl">Déposer pour ajouter une page à ce document</Text>
            </Stack>
          </Center>
        </Overlay>
      )}

      <EnTete key={acte.id} acte={acte} releves={releves} indexPage={indexPage} onSupprime={() => navigate({ to: "/documents" })} />

      <Group gap={0} flex={1} align="stretch" wrap="nowrap" style={{ minHeight: 0 }}>
        <Stack gap={0} flex={1} style={{ minWidth: 0 }}>
          {page ? (
            <Visionneuse
              page={page}
              annotations={annotationsPage}
              acteId={acteId}
              releves={relevesParId}
              selectionId={annotationSel?.id ?? null}
              mode={LECTURE_SEULE ? "deplacer" : mode}
              onMode={setMode}
              onSelect={selectionner}
              onRect={surRect}
              onRetirerRect={(a, i) =>
                a.rectangles.length > 1
                  ? ecrire(() => majAnnotation(a.id, { rectangles: a.rectangles.filter((_, j) => j !== i) }))
                  : supprimerZone(a, true)
              }
              onSupprimer={() => supprimerZone()}
              contour={acte.nature === "photo"}
            />
          ) : (
            <Center flex={1}>
              <Text c="dimmed">Aucune page. Glissez une image ou collez-la (Ctrl+V).</Text>
            </Center>
          )}
          {etroit && !panneauOuvert && (
            <Button
              pos="absolute"
              bottom={110}
              right={12}
              style={{ zIndex: 2 }}
              size="md"
              leftSection={<IconLayoutSidebarRight size={18} />}
              onClick={() => setPanneauOuvert(true)}
            >
              {acte.nature === "photo" ? "Personnes" : "Relevés"} ({releves.length})
            </Button>
          )}
          <BandePages
            acte={acte}
            indexPage={indexPage}
            onPage={setIndexPage}
            onAjouter={async () => {
              const chemins = await choisirImages();
              if (chemins.length) await ajouter(await Promise.all(chemins.map(importerFichier)));
            }}
            liasse={liasse}
            onLier={async (pageId) => {
              await ecrire(() => lierPage(acteId, pageId));
              setIndexPage(acte.pages.length);
            }}
            onNouvelActe={async () => {
              if (!page) return;
              const id = await ecrire(() =>
                creerActeSurPages([page.id], { sourceId: acte.sourceId, lieuId: acte.lieuId, cote: acte.cote }),
              );
              if (id) navigate({ to: "/actes/$acteId", params: { acteId: id } });
            }}
          />
        </Stack>

        {etroit ? (
          <Drawer
            opened={panneauOuvert}
            onClose={() => setPanneauOuvert(false)}
            position="right"
            size={420}
            withOverlay={false}
            lockScroll={false}
            trapFocus={false}
            withCloseButton={false}
            shadow="xl"
            styles={{ content: { display: "flex", flexDirection: "column" }, body: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: 0 } }}
          >
            <Group justify="flex-end" px="xs" pt={4}>
              <ActionIcon variant="subtle" size="lg" onClick={() => setPanneauOuvert(false)} aria-label="Fermer le panneau">
                <IconX size={18} />
              </ActionIcon>
            </Group>
            {panneau}
          </Drawer>
        ) : (
          <Box w={440} style={{ borderLeft: "1px solid var(--mantine-color-default-border)", display: "flex", flexDirection: "column" }}>
            {panneau}
          </Box>
        )}
      </Group>
    </Stack>
  );
}

/** Télécharger les images du document : directement s'il n'y en a qu'une, sinon cette page ou toutes. */
function BoutonTelecharger({ acte, indexPage }: { acte: ActeComplet; indexPage: number }) {
  const page = acte.pages[indexPage] ?? acte.pages[0];
  const lancer = async (pages: ActeComplet["pages"], numeros?: number[]) => {
    try {
      const n = await telechargerImages(acte.titre, pages, numeros);
      if (n && !LECTURE_SEULE) notifications.show({ color: "teal", message: n > 1 ? `${n} images enregistrées` : "Image enregistrée" });
    } catch (e) {
      notifications.show({ color: "red", title: "Téléchargement impossible", message: String(e) });
    }
  };
  if (!page) return null;
  if (acte.pages.length === 1) {
    return (
      <Tooltip label="Télécharger l'image">
        <ActionIcon variant="subtle" onClick={() => lancer([page])} aria-label="Télécharger">
          <IconDownload size={18} />
        </ActionIcon>
      </Tooltip>
    );
  }
  const n = acte.pages.indexOf(page) + 1;
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <Tooltip label="Télécharger">
          <ActionIcon variant="subtle" aria-label="Télécharger">
            <IconDownload size={18} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconPhoto size={16} />} onClick={() => lancer([page], [n])}>
          Cette image ({n} / {acte.pages.length})
        </Menu.Item>
        <Menu.Item leftSection={<IconPhotoPlus size={16} />} onClick={() => lancer(acte.pages)}>
          Toutes les images ({acte.pages.length})
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function EnTete({
  acte, releves, indexPage, onSupprime,
}: { acte: ActeComplet; releves: ReleveActe[]; indexPage: number; onSupprime: () => void }) {
  const { valeurs, modifier } = useAutoSave({ titre: acte.titre, statut: acte.statut }, (p, version) => majActe(acte.id, p, version), {
    version: acte.modifieLe,
  });
  const { data: lieux = [] } = useLieux();
  const lieu = lieux.find((l) => l.id === acte.lieuId);
  const { data: sources = [] } = useQuery({ queryKey: ["sources"], queryFn: listeSources });
  const registre = sources.find((s) => s.id === acte.sourceId)?.titre;

  if (LECTURE_SEULE) {
    return (
      <Group px="md" py="xs" gap="sm" wrap="nowrap" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
        <ActionIcon variant="subtle" onClick={() => retour("/documents")}>
          <IconArrowLeft size={18} />
        </ActionIcon>
        <NavRegistre acteId={acte.id} sourceId={acte.sourceId} />
        <Text fw={600} size="xl" flex={1} lineClamp={1}>
          {acte.titre}
        </Text>
        {lieu && (
          <Text size="sm" c="dimmed">
            {libelleLieu(lieu)}
          </Text>
        )}
        <Badge variant="outline" color={acte.nature === "index" ? "grape" : acte.nature === "photo" ? "cyan" : "gray"}>
          {libelleType(acte.nature, acte.type) || libelle(NATURES, acte.nature)}
        </Badge>
        <BoutonCitation acteId={acte.id} />
        <BoutonTelecharger acte={acte} indexPage={indexPage} />
      </Group>
    );
  }

  return (
    <Group px="md" py="xs" gap="sm" wrap="wrap" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
      <Tooltip label="Retour">
        <ActionIcon variant="subtle" onClick={() => retour("/documents")}>
          <IconArrowLeft size={18} />
        </ActionIcon>
      </Tooltip>
      <NavRegistre acteId={acte.id} sourceId={acte.sourceId} />
      <TextInput
        flex={1}
        miw={260}
        variant="unstyled"
        styles={{ input: { fontSize: 20, fontWeight: 600 } }}
        value={valeurs.titre}
        onChange={(e) => modifier({ titre: e.currentTarget.value })}
      />
      <Tooltip
        label={
          acte.nature === "photo"
            ? "Générer le titre (personnes identifiées, date)"
            : acte.nature === "index"
              ? "Générer le titre (registre, page)"
              : "Générer le titre (type, personne principale — les deux époux pour un mariage —, date, lieu)"
        }
      >
        <ActionIcon variant="subtle" onClick={() => modifier({ titre: titreAuto(acte, releves, lieu, registre) })}>
          <IconRefresh size={18} />
        </ActionIcon>
      </Tooltip>
      {lieu && (
        <Text size="sm" c="dimmed" visibleFrom="lg">
          {libelleLieu(lieu)}
        </Text>
      )}
      <Tooltip label="Acte : un acte sur une ou plusieurs images. Index : une page de table (table décennale…) dont chaque ligne renvoie à un acte. Photo : une photographie (recto, verso), avec les personnes identifiées.">
        <SegmentedControl
          size="xs"
          data={NATURES}
          value={acte.nature}
          onChange={(n) =>
            ecrire(() =>
              majActe(acte.id, {
                nature: n,
                // Le type ne garde son sens que s'il existe dans l'autre liste.
                ...(n !== "photo" && (n === "index" ? TYPES_INDEX : TYPES_ACTE).some((t) => t.value === acte.type) ? {} : { type: null }),
              }),
            )
          }
        />
      </Tooltip>
      <Select
        w={150}
        data={STATUTS_ACTE}
        value={valeurs.statut}
        onChange={(s) => s && modifier({ statut: s })}
        allowDeselect={false}
      />
      <BoutonCitation acteId={acte.id} />
        <BoutonTelecharger acte={acte} indexPage={indexPage} />
      <Menu position="bottom-end">
        <Menu.Target>
          <ActionIcon variant="subtle">
            <IconDots size={18} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={() =>
              modals.openConfirmModal({
                title: "Supprimer ce document ?",
                children: <Text size="sm">Les images, relevés et zones de ce document seront supprimés définitivement.</Text>,
                labels: { confirm: "Supprimer", cancel: "Annuler" },
                confirmProps: { color: "red" },
                onConfirm: async () => {
                  await ecrire(() => supprimerActe(acte.id));
                  onSupprime();
                },
              })
            }
          >
            Supprimer le document
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

type PropsBande = {
  acte: ActeComplet;
  indexPage: number;
  onPage: (i: number) => void;
  onAjouter: () => void;
  liasse: Awaited<ReturnType<typeof voisinsDansLaLiasse>> | undefined;
  onLier: (pageId: string) => void;
  onNouvelActe: () => void;
};

function BandePages({ acte, indexPage, onPage, onAjouter, liasse, onLier, onNouvelActe }: PropsBande) {
  const navigate = useNavigate();
  return (
    <Group gap="xs" p={6} style={{ borderTop: "1px solid var(--mantine-color-default-border)" }} wrap="nowrap">
      {acte.pages.map((p, i) => (
        <Box key={p.id} pos="relative">
          <UnstyledButton onClick={() => onPage(i)}>
            <Image
              src={urlImage(p.fichier)}
              h={48}
              w={64}
              fit="cover"
              radius="sm"
              style={{ outline: i === indexPage ? "2px solid var(--mantine-color-teal-6)" : "1px solid var(--mantine-color-gray-4)" }}
            />
          </UnstyledButton>
          {!LECTURE_SEULE && acte.pages.length > 1 && (
            <ActionIcon
              size="xs"
              radius="xl"
              color="red"
              pos="absolute"
              top={-6}
              right={-6}
              onClick={() =>
                modals.openConfirmModal({
                  title: "Retirer cette page du document ?",
                  labels: { confirm: "Retirer", cancel: "Annuler" },
                  confirmProps: { color: "red" },
                  onConfirm: async () => {
                    await ecrire(() => retirerPage(acte.id, p.id));
                    onPage(0);
                  },
                })
              }
            >
              <IconX size={10} />
            </ActionIcon>
          )}
        </Box>
      ))}
      {!LECTURE_SEULE && (
      <Menu position="top-start" shadow="md">
        <Menu.Target>
          <Tooltip label="Ajouter une image à cet acte">
            <ActionIcon variant="default" size={48}>
              <IconPlus size={20} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconUpload size={14} />} onClick={onAjouter}>
            Importer une image… (ou glisser / coller)
          </Menu.Item>
          {!!liasse?.pages.length && (
            <>
              <Menu.Label>L'acte continue sur une image de la liasse</Menu.Label>
              {liasse.pages.map((p) => (
                <Menu.Item key={p.id} onClick={() => onLier(p.id)} leftSection={<Image src={urlImage(p.fichier)} w={40} h={30} fit="cover" radius="xs" />}>
                  {p.numeroVue ? `Vue ${p.numeroVue}` : "Image de la liasse"}
                </Menu.Item>
              ))}
            </>
          )}
        </Menu.Dropdown>
      </Menu>
      )}

      {/* Liasses : plusieurs actes peuvent se partager une image. */}
      <Group gap={6} ml="md" wrap="wrap" style={{ minWidth: 0 }}>
        {!!liasse?.actes.length && (
          <>
            <Text size="xs" c="dimmed">
              Aussi sur ces images :
            </Text>
            {liasse.actes.map((a) => (
              <Badge
                key={a.id}
                variant="light"
                color={a.nature === "index" ? "grape" : a.nature === "photo" ? "cyan" : "gray"}
                style={{ cursor: "pointer", textTransform: "none" }}
                onClick={() => navigate({ to: "/actes/$acteId", params: { acteId: a.id } })}
              >
                {a.titre}
              </Badge>
            ))}
          </>
        )}
        {!LECTURE_SEULE && acte.pages.length > 0 && (
          <Tooltip label="Un autre acte commence sur cette image (liasse, registre)">
            <Button size="compact-xs" variant="subtle" leftSection={<IconPlus size={12} />} onClick={onNouvelActe}>
              Autre acte sur cette image
            </Button>
          </Tooltip>
        )}
      </Group>
    </Group>
  );
}

function ListeReleves({
  photo, releves, notes, onReleve, onNote, onNouveau,
}: {
  photo: boolean;
  releves: ReleveActe[];
  notes: Annotation[];
  onReleve: (id: string) => void;
  onNote: (a: Annotation) => void;
  onNouveau: () => void;
}) {
  return (
    <Stack gap="xs">
      {releves.length === 0 && (
        <Text size="sm" c="dimmed">
          {photo
            ? "Entourez une personne sur la photo pour l'identifier, ou la noter « à identifier »."
            : "Surlignez une personne sur l'image pour créer son relevé : nom, rôle, âge, relations…"}
        </Text>
      )}
      {releves.map((r) => (
        <UnstyledButton
          key={r.id}
          onClick={() => onReleve(r.id)}
          p="xs"
          style={{ borderRadius: 8, border: "1px solid var(--mantine-color-default-border)" }}
        >
          <Group gap="sm" wrap="nowrap">
            <ColorSwatch color={photo ? (r.individuId ? "#0ca678" : "#f08c00") : couleurRole(r.role)} size={14} />
            <Stack gap={0} flex={1}>
              <Text size="sm" fw={500}>
                {photo
                  ? texteAutoReleve(r).split("\n")[0]
                  : [r.nomEcrit || r.nom, r.prenomsEcrits || r.prenoms].filter(Boolean).join(" ") || "Personne ?"}
              </Text>
              <Text size="xs" c="dimmed">
                {(photo
                  ? [r.confiance && r.confiance !== "certain" && libelle(CONFIANCES, r.confiance).toLowerCase(), r.age, r.notes]
                  : [r.role, r.relations, r.age]
                )
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </Stack>
            {r.individuId ? (
              <Tooltip label={`Rattaché à ${nomComplet({ nom: r.individuNom, prenoms: r.individuPrenoms })}`}>
                <IconUserCheck size={18} color="var(--mantine-color-teal-6)" />
              </Tooltip>
            ) : (
              <Badge size="xs" variant="light" color={photo ? "orange" : "gray"}>
                {photo ? "à identifier" : "à rattacher"}
              </Badge>
            )}
          </Group>
        </UnstyledButton>
      ))}
      {notes.map((a) => (
        <UnstyledButton key={a.id} onClick={() => onNote(a)} p="xs" style={{ borderRadius: 8, border: "1px dashed var(--mantine-color-gray-4)" }}>
          <Group gap="sm" wrap="nowrap">
            <IconNote size={14} color={COULEUR_NOTE} />
            <Text size="sm" c="dimmed" lineClamp={2}>
              {a.note || "Note vide"}
            </Text>
          </Group>
        </UnstyledButton>
      ))}
      <Button display={LECTURE_SEULE ? "none" : undefined} variant="subtle" size="xs" leftSection={<IconPlus size={14} />} onClick={onNouveau}>
        {photo ? "Ajouter une personne sans zone" : "Ajouter un relevé sans zone"}
      </Button>
    </Stack>
  );
}
