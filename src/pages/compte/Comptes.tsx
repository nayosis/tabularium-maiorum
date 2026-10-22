import { useState } from "react";
import {
  ActionIcon, Alert, Badge, Button, CopyButton, Group, Menu, Modal, ScrollArea, Select, Stack, Table, Text, TextInput, Title, Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconCheck, IconCopy, IconDots, IconKey, IconLinkOff, IconLogout, IconPlayerPause, IconPlayerPlay, IconTrash, IconUserPlus,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IndividuSelect } from "../../components/selects";
import { appelApi } from "../../lib/rpc";
import { LIBELLES_ROLES, utilisateur, type Role } from "../../lib/session";

type Compte = {
  id: string;
  email: string;
  role: Role;
  super: boolean;
  individuId: string | null;
  actif: boolean;
  aMotDePasse: boolean;
  creeLe: string;
  derniereConnexion: string | null;
  lienEnAttente: { type: string; expireLe: number } | null;
  gerable: boolean;
};

const dateHeure = (d: string | number) =>
  new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const COULEUR_ROLE: Record<Role, string> = { lecture: "gray", ecriture: "blue", admin: "grape" };

/** Lien à copier et transmettre à la personne (aucun e-mail n'est envoyé par l'application). */
function ModalLien({ lien, email, onClose }: { lien: { url: string; expire: number } | null; email: string; onClose: () => void }) {
  return (
    <Modal opened={!!lien} onClose={onClose} title="Lien à transmettre" size="lg">
      {lien && (
        <Stack>
          <Text size="sm">
            Envoyez ce lien à <b>{email}</b> (message, SMS…). Il permet de choisir son mot de passe, <b>une seule fois</b>, jusqu'au{" "}
            {dateHeure(lien.expire)}.
          </Text>
          <Group gap="xs" wrap="nowrap">
            <TextInput value={lien.url} readOnly flex={1} onFocus={(e) => e.currentTarget.select()} />
            <CopyButton value={lien.url}>
              {({ copied, copy }) => (
                <Button leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} color={copied ? "teal" : undefined} onClick={copy}>
                  {copied ? "Copié" : "Copier"}
                </Button>
              )}
            </CopyButton>
          </Group>
          <Text size="xs" c="dimmed">
            Ce lien n'est affiché qu'ici : s'il est perdu, générez-en un nouveau (l'ancien ne marchera plus).
          </Text>
        </Stack>
      )}
    </Modal>
  );
}

function ModalNouveau({ opened, onClose, roles, onLien }: { opened: boolean; onClose: () => void; roles: Role[]; onLien: (l: { url: string; expire: number }, email: string) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("lecture");
  const [individuId, setIndividuId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const client = useQueryClient();
  const creer = async () => {
    setErreur(null);
    try {
      const r = await appelApi<{ lien: string; expire: number }>("/api/comptes", { corps: { email, role, individuId } });
      await client.invalidateQueries({ queryKey: ["comptes"] });
      onLien({ url: location.origin + r.lien, expire: r.expire }, email.trim().toLowerCase());
      setEmail("");
      setIndividuId(null);
      onClose();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Modal opened={opened} onClose={onClose} title="Nouveau compte">
      <Stack>
        {erreur && <Alert color="red">{erreur}</Alert>}
        <TextInput label="Adresse e-mail" description="Sert d'identifiant ; aucun message n'y est envoyé." value={email} onChange={(e) => setEmail(e.currentTarget.value)} data-autofocus />
        <Select label="Rôle" data={roles.map((r) => ({ value: r, label: LIBELLES_ROLES[r] }))} value={role} onChange={(v) => v && setRole(v as Role)} allowDeselect={false} />
        <IndividuSelect label="Sa fiche dans l'arbre (facultatif)" value={individuId} onChange={setIndividuId} />
        <Button onClick={creer} disabled={!email.includes("@")}>
          Créer le compte et obtenir le lien
        </Button>
      </Stack>
    </Modal>
  );
}

/** Gestion des comptes : admins (comptes lecture et écriture) et super admin (tous). */
export function Comptes() {
  const client = useQueryClient();
  const { data } = useQuery({ queryKey: ["comptes"], queryFn: () => appelApi<{ comptes: Compte[]; rolesAttribuables: Role[] }>("/api/comptes") });
  const [nouveau, setNouveau] = useState(false);
  const [lien, setLien] = useState<{ url: string; expire: number } | null>(null);
  const [emailLien, setEmailLien] = useState("");
  const moi = utilisateur();

  const action = async (f: () => Promise<unknown>, message?: string) => {
    try {
      await f();
      await client.invalidateQueries({ queryKey: ["comptes"] });
      if (message) notifications.show({ color: "teal", message });
    } catch (e) {
      notifications.show({ color: "red", title: "Erreur", message: e instanceof Error ? e.message : String(e) });
    }
  };
  const patch = (c: Compte, corps: Record<string, unknown>, message?: string) =>
    action(() => appelApi(`/api/comptes/${c.id}`, { methode: "PATCH", corps }), message);
  const genererLien = (c: Compte) =>
    action(async () => {
      const r = await appelApi<{ lien: string; expire: number }>(`/api/comptes/${c.id}/lien`, { corps: {} });
      setEmailLien(c.email);
      setLien({ url: location.origin + r.lien, expire: r.expire });
    });

  return (
    <Stack p="lg" gap="md" h="100%">
      <Group justify="space-between">
        <Title order={2}>Comptes</Title>
        <Button leftSection={<IconUserPlus size={18} />} onClick={() => setNouveau(true)}>
          Nouveau compte
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        Lecture : consulter. Écriture : saisir et modifier. Admin : gérer les comptes lecture et écriture, télécharger les sauvegardes.
      </Text>
      <ScrollArea flex={1}>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Compte</Table.Th>
              <Table.Th>Rôle</Table.Th>
              <Table.Th>Fiche</Table.Th>
              <Table.Th>État</Table.Th>
              <Table.Th>Dernière connexion</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(data?.comptes ?? []).map((c) => (
              <Table.Tr key={c.id} opacity={c.actif ? 1 : 0.55}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {c.email}
                  </Text>
                  {c.id === moi?.id && (
                    <Text size="xs" c="dimmed">
                      vous
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {c.super ? (
                    <Badge color="red" variant="light">
                      Super admin
                    </Badge>
                  ) : c.gerable ? (
                    <Select
                      w={130}
                      size="xs"
                      data={(data?.rolesAttribuables ?? []).map((r) => ({ value: r, label: LIBELLES_ROLES[r] }))}
                      value={c.role}
                      onChange={(v) => v && v !== c.role && patch(c, { role: v }, `Rôle de ${c.email} : ${LIBELLES_ROLES[v as Role]}`)}
                      allowDeselect={false}
                    />
                  ) : (
                    <Badge color={COULEUR_ROLE[c.role]} variant="light">
                      {LIBELLES_ROLES[c.role]}
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td w={260}>
                  {(c.gerable || c.id === moi?.id) ? (
                    <IndividuSelect size="xs" placeholder="Aucune" value={c.individuId} onChange={(id) => patch(c, { individuId: id })} />
                  ) : null}
                </Table.Td>
                <Table.Td>
                  {!c.actif ? (
                    <Badge color="gray">Désactivé</Badge>
                  ) : c.lienEnAttente ? (
                    <Tooltip label={`Lien valable jusqu'au ${dateHeure(c.lienEnAttente.expireLe)}`}>
                      <Badge color="orange" variant="light">
                        {c.lienEnAttente.type === "creation" ? "Invitation en attente" : "Réinitialisation en attente"}
                      </Badge>
                    </Tooltip>
                  ) : !c.aMotDePasse ? (
                    <Badge color="orange" variant="outline">
                      Sans mot de passe
                    </Badge>
                  ) : (
                    <Badge color="teal" variant="light">
                      Actif
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {c.derniereConnexion ? dateHeure(c.derniereConnexion) : "jamais"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {c.gerable && (
                    <Menu position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle">
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconKey size={14} />} onClick={() => genererLien(c)}>
                          {c.aMotDePasse ? "Lien de réinitialisation du mot de passe" : "Nouveau lien d'invitation"}
                        </Menu.Item>
                        {c.lienEnAttente && (
                          <Menu.Item leftSection={<IconLinkOff size={14} />} onClick={() => action(() => appelApi(`/api/comptes/${c.id}/lien`, { methode: "DELETE" }), "Lien annulé")}>
                            Annuler le lien en attente
                          </Menu.Item>
                        )}
                        <Menu.Item leftSection={<IconLogout size={14} />} onClick={() => action(() => appelApi(`/api/comptes/${c.id}/deconnecter`, { corps: {} }), "Sessions fermées")}>
                          Déconnecter de tous ses appareils
                        </Menu.Item>
                        <Menu.Item
                          leftSection={c.actif ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
                          onClick={() => patch(c, { actif: !c.actif }, c.actif ? "Compte désactivé" : "Compte réactivé")}
                        >
                          {c.actif ? "Désactiver" : "Réactiver"}
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() =>
                            modals.openConfirmModal({
                              title: `Supprimer le compte ${c.email} ?`,
                              children: <Text size="sm">La personne ne pourra plus se connecter. Ses contributions restent.</Text>,
                              labels: { confirm: "Supprimer", cancel: "Annuler" },
                              confirmProps: { color: "red" },
                              onConfirm: () => action(() => appelApi(`/api/comptes/${c.id}`, { methode: "DELETE" }), "Compte supprimé"),
                            })
                          }
                        >
                          Supprimer
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      <ModalNouveau
        opened={nouveau}
        onClose={() => setNouveau(false)}
        roles={data?.rolesAttribuables ?? []}
        onLien={(l, email) => {
          setEmailLien(email);
          setLien(l);
        }}
      />
      <ModalLien lien={lien} email={emailLien} onClose={() => setLien(null)} />
    </Stack>
  );
}
