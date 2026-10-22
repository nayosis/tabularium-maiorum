ALTER TABLE `couple` ADD `acte_id` text REFERENCES acte(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `individu` ADD `acte_naissance_id` text REFERENCES acte(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `individu` ADD `acte_deces_id` text REFERENCES acte(id) ON DELETE SET NULL;