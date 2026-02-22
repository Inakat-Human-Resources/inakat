// RUTA: src/app/admin/loading.tsx
export default function AdminLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 font-medium">Cargando panel de administración...</p>
      </div>
    </div>
  );
}
