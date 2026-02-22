// RUTA: src/app/loading.tsx
export default function Loading() {
  return (
    <div className="min-h-screen bg-custom-beige flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-button-green border-t-transparent rounded-full animate-spin" />
        <p className="text-text-black/50 text-sm">Cargando...</p>
      </div>
    </div>
  );
}
