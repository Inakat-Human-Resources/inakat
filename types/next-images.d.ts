// `next-env.d.ts` está en .gitignore y sólo lo regenera `next build`/`next dev`,
// así que NO existe en un checkout limpio de CI. Sin él, `tsc --noEmit` no tiene
// las declaraciones de módulos de imágenes (*.png, *.jpg, *.webp, …) que Next
// aporta vía `next/image-types/global`, y falla con TS2307 en cada import de
// imagen. Este archivo versionado re-declara esas referencias de tipos. En local
// convive con next-env.d.ts sin conflicto (las referencias al mismo paquete de
// tipos se deduplican).
/// <reference types="next" />
/// <reference types="next/image-types/global" />
