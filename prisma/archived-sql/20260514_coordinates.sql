-- Migración: Agregar coordenadas lat/lng a Candidate y Job
-- Ejecutar en producción antes del deploy

ALTER TABLE "Candidate" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Candidate" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN "longitude" DOUBLE PRECISION;
