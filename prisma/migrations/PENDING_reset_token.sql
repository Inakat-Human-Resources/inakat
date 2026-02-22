-- MIGRACIÓN: Campos para reset de contraseña
-- Fecha: 2026-02-22
-- Descripción: Agrega resetToken y resetTokenExpiry al modelo User

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP(3);

-- Índice único para búsqueda rápida por token
CREATE UNIQUE INDEX IF NOT EXISTS "User_resetToken_key" ON "User"("resetToken");
