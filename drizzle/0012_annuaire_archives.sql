CREATE TABLE `lien_archives` (
	`id` text PRIMARY KEY NOT NULL,
	`departement` text NOT NULL,
	`categorie` text NOT NULL,
	`libelle` text NOT NULL,
	`url` text,
	`defaut` text,
	`masque` integer DEFAULT false NOT NULL,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	`cree_par` text,
	`modifie_par` text,
	`modifie_le` text
);
