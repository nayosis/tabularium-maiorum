ALTER TABLE `filiation` ADD `acte_id` text REFERENCES acte(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `individu` ADD `pere_inconnu` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `individu` ADD `mere_inconnue` integer DEFAULT 0 NOT NULL;