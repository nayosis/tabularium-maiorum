-- Portrait : zone d'une photo où la personne est identifiée (retiré si la zone disparaît).
ALTER TABLE `individu` ADD `portrait_annotation_id` text REFERENCES annotation(id) ON DELETE SET NULL;
