// RUTA: src/app/loading.tsx
export default function Loading() {
  return (
    <div className="min-h-screen bg-custom-beige flex items-center justify-center">
      {/* role/aria-live: el lector de pantalla no anunciaba la carga */}
      <div
        className="flex flex-col items-center gap-4"
        role="status"
        aria-live="polite"
      >
        <div
          className="w-10 h-10 border-4 border-button-green border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
        <p className="text-text-black/50 text-sm">Cargando...</p>
      </div>
    </div>
  );
}
