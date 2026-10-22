import { useState } from "react";
import { CloseButton, Combobox, InputBase, useCombobox } from "@mantine/core";

type Option = { value: string; label: string };

type Props = {
  label?: string;
  placeholder?: string;
  data: Option[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Crée l'élément et renvoie son id. */
  onCreate: (texte: string) => Promise<string | undefined>;
};

/** Liste déroulante avec recherche et création à la volée (« + Créer « Brissac » »). */
export function SelectCreable({ label, placeholder, data, value, onChange, onCreate }: Props) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const selection = data.find((o) => o.value === value);
  const [recherche, setRecherche] = useState<string | null>(null);

  const texte = recherche ?? selection?.label ?? "";
  const filtre = (recherche ?? "").trim().toLowerCase();
  const options = filtre ? data.filter((o) => o.label.toLowerCase().includes(filtre)) : data;
  const existe = data.some((o) => o.label.toLowerCase() === filtre);

  return (
    <Combobox
      store={combobox}
      withinPortal
      onOptionSubmit={async (v) => {
        combobox.closeDropdown();
        setRecherche(null);
        if (v === "$creer") {
          const id = await onCreate(filtre ? recherche!.trim() : "");
          if (id) onChange(id);
        } else onChange(v);
      }}
    >
      <Combobox.Target>
        <InputBase
          label={label}
          placeholder={placeholder}
          value={texte}
          rightSection={
            value ? (
              <CloseButton size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(null)} />
            ) : (
              <Combobox.Chevron />
            )
          }
          rightSectionPointerEvents={value ? "all" : "none"}
          onChange={(e) => {
            setRecherche(e.currentTarget.value);
            combobox.openDropdown();
            combobox.updateSelectedOptionIndex();
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => {
            combobox.closeDropdown();
            setRecherche(null);
          }}
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options mah={260} style={{ overflowY: "auto" }}>
          {options.map((o) => (
            <Combobox.Option value={o.value} key={o.value} active={o.value === value}>
              {o.label}
            </Combobox.Option>
          ))}
          {filtre && !existe && <Combobox.Option value="$creer">+ Créer « {recherche!.trim()} »</Combobox.Option>}
          {!filtre && !options.length && <Combobox.Empty>Tapez pour créer</Combobox.Empty>}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
