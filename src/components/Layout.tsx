import { useEffect, useState } from "react";
import {
  Alert, AppShell, Badge, Box, Burger, Button, Divider, Drawer, Group, Menu, Modal, NavLink, PasswordInput, Stack, Text, Title, UnstyledButton, SegmentedControl, useMantineColorScheme, ActionIcon, Kbd,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBinaryTree2, IconChevronUp, IconDatabaseExport, IconFileText, IconKey, IconListSearch, IconLogout, IconMap2, IconMapPin, IconPhoto,
  IconCamera, IconDots, IconHistory, IconHome, IconUserCog, IconUsers, IconInfoCircle, IconBrandGithub, IconSearch, IconBuildingBank, IconCalendarRepeat } from "@tabler/icons-react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { appelApi } from "../lib/rpc";
import { deconnexion, estAdmin, LIBELLES_ROLES, utilisateur } from "../lib/session";
import { useEvenements } from "../hooks/useEvenements";
import { useEcran } from "../lib/ecran";
import { LECTURE_SEULE } from "../lib/mode";
import { configuration } from "../lib/configuration";
import { BadgeMiseAJour } from "./MiseAJour";
import { DEPOT_URL } from "../lib/versions";
import { RechercheGlobale, useRechercheGlobale } from "./RechercheGlobale";

const ENTREES = [
  { to: "/", label: "Accueil", icone: IconHome, actif: (p: string) => p === "/" },
  {
    to: "/documents",
    label: "Documents",
    icone: IconFileText,
    actif: (p: string) => p.startsWith("/documents") || p.startsWith("/actes") || p.startsWith("/registres"),
  },
  { to: "/photos", label: "Photos", icone: IconPhoto, actif: (p: string) => p.startsWith("/photos") },
  { to: "/individus", label: "Individus", icone: IconUsers, actif: (p: string) => p.startsWith("/individus") },
  { to: "/arbre", label: "Arbre", icone: IconBinaryTree2, actif: (p: string) => p.startsWith("/arbre") },
  { to: "/cartographie", label: "Cartographie", icone: IconMap2, actif: (p: string) => p.startsWith("/cartographie") },
  { to: "/recherches", label: "Recherches", icone: IconListSearch, actif: (p: string) => p.startsWith("/recherches") },
  { to: "/archives", label: "Archives", icone: IconBuildingBank, actif: (p: string) => p.startsWith("/archives") },
  { to: "/lieux", label: "Lieux", icone: IconMapPin, actif: (p: string) => p.startsWith("/lieux") },
] as const;

const ENTREES_ADMIN = [
  { to: "/comptes", label: "Comptes", icone: IconUserCog, actif: (p: string) => p.startsWith("/comptes") },
  { to: "/journal", label: "Journal", icone: IconHistory, actif: (p: string) => p.startsWith("/journal") },
  { to: "/sauvegarde", label: "Sauvegarde", icone: IconDatabaseExport, actif: (p: string) => p.startsWith("/sauvegarde") },
] as const;

function ModalMotDePasse({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const valider = async () => {
    setErreur(null);
    try {
      await appelApi("/api/auth/mot-de-passe", { corps: { actuel, nouveau } });
      notifications.show({ color: "teal", message: "Mot de passe changé" });
      setActuel("");
      setNouveau("");
      onClose();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Modal opened={opened} onClose={onClose} title="Changer de mot de passe">
      <Stack>
        {erreur && <Alert color="red">{erreur}</Alert>}
        <PasswordInput label="Mot de passe actuel" autoComplete="current-password" value={actuel} onChange={(e) => setActuel(e.currentTarget.value)} data-autofocus />
        <PasswordInput
          label="Nouveau mot de passe"
          description="10 caractères au moins"
          autoComplete="new-password"
          value={nouveau}
          onChange={(e) => setNouveau(e.currentTarget.value)}
        />
        <Button onClick={valider} disabled={nouveau.length < 10 || !actuel}>
          Enregistrer
        </Button>
      </Stack>
    </Modal>
  );
}

/** Compte connecté, en bas du menu : rôle, mot de passe, déconnexion. */
function MenuCompte() {
  const moi = utilisateur();
  const [mdp, setMdp] = useState(false);
  if (!moi) return null;
  return (
    <>
      <Menu position="top-start" width={240}>
        <Menu.Target>
          <UnstyledButton p="xs" style={{ borderRadius: 8, borderTop: "1px solid var(--mantine-color-default-border)" }}>
            <Group gap="xs" wrap="nowrap">
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" fw={600} truncate>
                  {moi.email}
                </Text>
                <Group gap={6} wrap="nowrap">
                  <Badge size="xs" variant="light" color={moi.super ? "red" : moi.role === "lecture" ? "gray" : "teal"}>
                    {moi.super ? "Super admin" : LIBELLES_ROLES[moi.role]}
                  </Badge>
                  {configuration().version && (
                    <Text size="xs" c="dimmed">
                      v{configuration().version}
                    </Text>
                  )}
                  <BadgeMiseAJour />
                </Group>
              </Stack>
              <IconChevronUp size={14} />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconInfoCircle size={14} />} component={Link} to="/presentation">
            Présentation de Tabularium
          </Menu.Item>
          <Menu.Label>Aide</Menu.Label>
          <Menu.Item leftSection={<IconCalendarRepeat size={14} />} component={Link} to="/aide/calendrier-republicain">
            Calendrier révolutionnaire
          </Menu.Item>
          <Menu.Item leftSection={<IconBrandGithub size={14} />} component="a" href={DEPOT_URL} target="_blank" rel="noopener noreferrer">
            Code source et nouvelles versions
          </Menu.Item>
          <ChoixTheme />
          <Menu.Divider />
          <Menu.Item leftSection={<IconKey size={14} />} onClick={() => setMdp(true)}>
            Changer de mot de passe
          </Menu.Item>
          <Menu.Item leftSection={<IconLogout size={14} />} onClick={() => deconnexion()}>
            Se déconnecter
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <ModalMotDePasse opened={mdp} onClose={() => setMdp(false)} />
    </>
  );
}

const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Ouvre la recherche globale ; rappelle le raccourci clavier. */
function BoutonRecherche({ onClick }: { onClick: () => void }) {
  return (
    <UnstyledButton
      onClick={onClick}
      mb="sm"
      px="sm"
      py={6}
      style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: 8 }}
      aria-label="Rechercher (Ctrl+K)"
    >
      <Group gap={8} wrap="nowrap">
        <IconSearch size={16} color="var(--mantine-color-dimmed)" />
        <Text size="sm" c="dimmed" style={{ flex: 1, minWidth: 0 }} truncate>
          Rechercher…
        </Text>
        <Kbd size="xs" style={{ whiteSpace: "nowrap" }}>
          {MAC ? "⌘K" : "Ctrl K"}
        </Kbd>
      </Group>
    </UnstyledButton>
  );
}

/** Thème clair, sombre, ou celui du système (mémorisé sur l'appareil). */
function ChoixTheme() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <Box px="sm" py={6}>
      <Text size="xs" c="dimmed" mb={4}>
        Thème
      </Text>
      <SegmentedControl
        size="xs"
        fullWidth
        value={colorScheme}
        onChange={(v) => setColorScheme(v as "light" | "dark" | "auto")}
        data={[
          { value: "light", label: "Clair" },
          { value: "dark", label: "Sombre" },
          { value: "auto", label: "Auto" },
        ]}
      />
    </Box>
  );
}

type Entree = { to: string; label: string; icone: typeof IconHome; actif: (p: string) => boolean };

/** Liens du menu, dans l'ordre (les admins ont en plus Comptes, Journal, Sauvegarde). */
const liens = (): Entree[] => (estAdmin() ? [...ENTREES, ...ENTREES_ADMIN] : [...ENTREES]);

const CAPTURER: Entree = { to: "/capturer", label: "Capturer", icone: IconCamera, actif: (p) => p.startsWith("/capturer") };

function Liens({ chemin, surClic }: { chemin: string; surClic?: () => void }) {
  const { telephone, ordinateur } = useEcran();
  // La capture (appareil photo) sert sur téléphone et tablette, aux comptes en écriture.
  // Sur téléphone, l'accueil est déjà dans la barre du bas.
  const base = telephone ? liens().filter((e) => e.to !== "/") : liens();
  const entrees = !ordinateur && !LECTURE_SEULE ? [...base, CAPTURER] : base;
  return (
    <>
      {entrees.map((e) => (
        <NavLink
          key={e.to}
          component={Link}
          to={e.to} label={e.label} leftSection={<e.icone size={18} />} active={e.actif(chemin)} onClick={surClic} />
      ))}
    </>
  );
}

/** Téléphone : les pages les plus utiles en bas de l'écran, le reste dans « Plus ». */
const BARRE_TELEPHONE: Entree[] = [
  { to: "/", label: "Accueil", icone: IconHome, actif: (p) => p === "/" },
  { to: "/individus", label: "Individus", icone: IconUsers, actif: (p) => p.startsWith("/individus") },
  { to: "/arbre", label: "Arbre", icone: IconBinaryTree2, actif: (p) => p.startsWith("/arbre") },
  { to: "/photos", label: "Photos", icone: IconPhoto, actif: (p) => p.startsWith("/photos") },
];

function BarreBas({ chemin, onPlus }: { chemin: string; onPlus: () => void }) {
  const bouton = (contenu: React.ReactNode, actif: boolean) => (
    <Stack gap={2} align="center" c={actif ? "teal.7" : "gray.6"} py={6} style={{ flex: 1 }}>
      {contenu}
    </Stack>
  );
  return (
    <Group
      gap={0}
      wrap="nowrap"
      bg="var(--t-surface)"
      style={{ borderTop: "1px solid var(--mantine-color-default-border)", paddingBottom: "env(safe-area-inset-bottom)", flexShrink: 0 }}
    >
      {BARRE_TELEPHONE.map((e) => (
        <UnstyledButton key={e.to} component={Link} to={e.to} style={{ flex: 1 }}>
          {bouton(
            <>
              <e.icone size={22} />
              <Text size="xs">{e.label}</Text>
            </>,
            e.actif(chemin),
          )}
        </UnstyledButton>
      ))}
      <UnstyledButton onClick={onPlus} style={{ flex: 1 }}>
        {bouton(
          <>
            <IconDots size={22} />
            <Text size="xs">Plus</Text>
          </>,
          false,
        )}
      </UnstyledButton>
    </Group>
  );
}

export function Layout() {
  const chemin = useRouterState({ select: (s) => s.location.pathname });
  const { type } = useEcran();
  const [menu, setMenu] = useState(false);
  const recherche = useRechercheGlobale();
  useEvenements();
  // Changement de page : on referme le menu.
  useEffect(() => setMenu(false), [chemin]);

  if (type === "ordinateur") {
    return (
      <AppShell navbar={{ width: 200, breakpoint: 0 }} padding={0} h="100%">
        <AppShell.Navbar p="sm" style={{ display: "flex", flexDirection: "column" }}>
          <Stack gap={4} style={{ flex: 1 }}>
            <Group px="xs" pb="sm" gap={6}>
              <Title order={3}>Tabularium</Title>
            </Group>
            <BoutonRecherche onClick={recherche.ouvrir} />
            <Liens chemin={chemin} />
          </Stack>
          <MenuCompte />
        </AppShell.Navbar>
        <AppShell.Main h="100dvh" style={{ display: "flex", flexDirection: "column" }}>
          <Outlet />
        </AppShell.Main>
        <RechercheGlobale opened={recherche.ouverte} onClose={recherche.fermer} />
      </AppShell>
    );
  }

  // Tablette et téléphone : le menu complet dans un tiroir.
  const tiroir = (
    <Drawer opened={menu} onClose={() => setMenu(false)} size={type === "telephone" ? "85%" : 260} title="Tabularium" padding="sm">
      <Stack gap={4} h="100%">
        <BoutonRecherche
          onClick={() => {
            setMenu(false);
            recherche.ouvrir();
          }}
        />
        <Liens chemin={chemin} surClic={() => setMenu(false)} />
        <Divider my="sm" />
        <MenuCompte />
      </Stack>
    </Drawer>
  );
  const titre = liens().find((e) => e.actif(chemin))?.label ?? "Tabularium";

  return (
    <Box h="100dvh" style={{ display: "flex", flexDirection: "column" }}>
      {type === "tablette" && (
        <Group h={48} px="sm" gap="sm" wrap="nowrap" style={{ borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}>
          <Burger opened={menu} onClick={() => setMenu((o) => !o)} size="sm" aria-label="Menu" />
          <Text fw={700}>Tabularium</Text>
          <Text c="dimmed" size="sm" truncate style={{ flex: 1 }}>
            {titre}
          </Text>
          <ActionIcon variant="subtle" size="lg" onClick={recherche.ouvrir} aria-label="Rechercher">
            <IconSearch size={20} />
          </ActionIcon>
        </Group>
      )}
      <Box style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Outlet />
      </Box>
      {type === "telephone" && <BarreBas chemin={chemin} onPlus={() => setMenu(true)} />}
      {tiroir}
      <RechercheGlobale opened={recherche.ouverte} onClose={recherche.fermer} />
    </Box>
  );
}
