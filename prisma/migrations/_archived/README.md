# Migraciones archivadas

Estos SQL fueron aplicados manualmente a producción antes de migrar a
un flujo formal de Prisma migrations. Los archivos se conservan como
referencia histórica del schema delta.

| Fecha de aplicación | Archivo | Descripción |
|---|---|---|
| 2026-05-14 | 20260514_reset_token.sql | Agrega resetToken/resetTokenExpiry a User |
| 2026-05-14 | 20260514_notifications.sql | Crea tabla Notification con índices y FK |
| 2026-05-14 | 20260514_coordinates.sql | Agrega lat/lng a Candidate y Job |

Verificado contra el schema de producción el 2026-05-14 — todas las columnas, tipos, índices y constraints coinciden con el SQL declarado.

NO ejecutar estos archivos directamente — ya están aplicados.
