CREATE TABLE `acte` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text,
	`type` text,
	`numero` text,
	`date` text,
	`date_min` text,
	`date_max` text,
	`lieu_id` text,
	`titre` text NOT NULL,
	`cote` text,
	`transcription` text,
	`traduction` text,
	`statut` text DEFAULT 'a_analyser' NOT NULL,
	`notes` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`lieu_id`) REFERENCES `lieu`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `acte_statut_idx` ON `acte` (`statut`);--> statement-breakpoint
CREATE TABLE `acte_page` (
	`acte_id` text NOT NULL,
	`page_id` text NOT NULL,
	`ordre` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`acte_id`, `page_id`),
	FOREIGN KEY (`acte_id`) REFERENCES `acte`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `annotation` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`acte_id` text,
	`releve_id` text,
	`rectangles` text NOT NULL,
	`note` text,
	`texte_bulle` text,
	`couleur` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`acte_id`) REFERENCES `acte`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`releve_id`) REFERENCES `releve`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `annotation_page_idx` ON `annotation` (`page_id`);--> statement-breakpoint
CREATE TABLE `couple` (
	`id` text PRIMARY KEY NOT NULL,
	`individu1_id` text NOT NULL,
	`individu2_id` text,
	`type` text,
	`date` text,
	`date_min` text,
	`date_max` text,
	`lieu_id` text,
	`notes` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`individu1_id`) REFERENCES `individu`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`individu2_id`) REFERENCES `individu`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lieu_id`) REFERENCES `lieu`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `filiation` (
	`id` text PRIMARY KEY NOT NULL,
	`enfant_id` text NOT NULL,
	`parent_id` text NOT NULL,
	`type` text DEFAULT 'biologique' NOT NULL,
	`notes` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`enfant_id`) REFERENCES `individu`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `individu`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `filiation_unique` ON `filiation` (`enfant_id`,`parent_id`);--> statement-breakpoint
CREATE TABLE `individu` (
	`id` text PRIMARY KEY NOT NULL,
	`nom` text,
	`prenoms` text,
	`sexe` text,
	`naissance` text,
	`naissance_min` text,
	`naissance_max` text,
	`naissance_lieu_id` text,
	`deces` text,
	`deces_min` text,
	`deces_max` text,
	`deces_lieu_id` text,
	`profession` text,
	`notes` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`naissance_lieu_id`) REFERENCES `lieu`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deces_lieu_id`) REFERENCES `lieu`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `lien` (
	`id` text PRIMARY KEY NOT NULL,
	`acte_id` text,
	`page_id` text,
	`url` text NOT NULL,
	`libelle` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`acte_id`) REFERENCES `acte`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `page`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lieu` (
	`id` text PRIMARY KEY NOT NULL,
	`nom` text NOT NULL,
	`departement` text,
	`code_insee` text,
	`latitude` real,
	`longitude` real,
	`notes` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `page` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text,
	`fichier` text NOT NULL,
	`largeur` integer NOT NULL,
	`hauteur` integer NOT NULL,
	`numero_vue` text,
	`notes` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `releve` (
	`id` text PRIMARY KEY NOT NULL,
	`acte_id` text NOT NULL,
	`individu_id` text,
	`role` text,
	`nom_ecrit` text,
	`prenoms_ecrits` text,
	`nom` text,
	`prenoms` text,
	`sexe` text,
	`age` text,
	`naissance` text,
	`naissance_min` text,
	`naissance_max` text,
	`naissance_lieu` text,
	`mariage` text,
	`mariage_min` text,
	`mariage_max` text,
	`mariage_lieu` text,
	`deces` text,
	`deces_min` text,
	`deces_max` text,
	`deces_lieu` text,
	`profession` text,
	`domicile` text,
	`origine` text,
	`signature` text,
	`relations` text,
	`confiance` text,
	`notes` text,
	`ordre` integer DEFAULT 0 NOT NULL,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`acte_id`) REFERENCES `acte`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`individu_id`) REFERENCES `individu`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `releve_acte_idx` ON `releve` (`acte_id`);--> statement-breakpoint
CREATE INDEX `releve_individu_idx` ON `releve` (`individu_id`);--> statement-breakpoint
CREATE TABLE `source` (
	`id` text PRIMARY KEY NOT NULL,
	`titre` text NOT NULL,
	`type_registre` text,
	`lieu_id` text,
	`periode` text,
	`service_archives` text,
	`cote` text,
	`notes` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`lieu_id`) REFERENCES `lieu`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `tache` (
	`id` text PRIMARY KEY NOT NULL,
	`titre` text NOT NULL,
	`description` text,
	`statut` text DEFAULT 'a_faire' NOT NULL,
	`resultat` text,
	`individu_id` text,
	`acte_id` text,
	`source_id` text,
	`cree_le` text DEFAULT (datetime('now')) NOT NULL,
	`termine_le` text,
	FOREIGN KEY (`individu_id`) REFERENCES `individu`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`acte_id`) REFERENCES `acte`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_id`) REFERENCES `source`(`id`) ON UPDATE no action ON DELETE set null
);
