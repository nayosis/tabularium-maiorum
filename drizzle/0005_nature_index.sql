ALTER TABLE `acte` ADD `nature` text DEFAULT 'acte' NOT NULL;--> statement-breakpoint
ALTER TABLE `releve` ADD `acte_renvoi_id` text REFERENCES acte(id) ON DELETE SET NULL;--> statement-breakpoint
-- Reprise : les « actes » de type table décennale sont des pages d'index.
UPDATE `acte` SET `nature` = 'index' WHERE `type` = 'table_decennale';
