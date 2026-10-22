-- Reprise : les « actes » de type table décennale sont des pages d'index.
-- (La migration 0005 a pu être appliquée avant d'inclure cette reprise ; sans effet si déjà faite.)
UPDATE `acte` SET `nature` = 'index' WHERE `type` = 'table_decennale' AND `nature` = 'acte';
