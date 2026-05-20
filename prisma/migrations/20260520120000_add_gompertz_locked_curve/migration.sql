-- Add lockedCurve and lastObservationDay to GompertzVague
-- These fields enable frozen predictions: past Gompertz curve points
-- never change even when the model is recalibrated with new data.

ALTER TABLE "GompertzVague" ADD COLUMN "lockedCurve" JSONB;
ALTER TABLE "GompertzVague" ADD COLUMN "lastObservationDay" INTEGER;
