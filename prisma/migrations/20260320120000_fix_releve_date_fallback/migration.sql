-- Rattrapage : pour les relevés dont la date de mesure n'a jamais été définie
-- explicitement (date == createdAt), on utilise updatedAt comme fallback.
UPDATE "Releve" SET "date" = "updatedAt" WHERE "date" = "createdAt";
