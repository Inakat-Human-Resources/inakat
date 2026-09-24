// RUTA: src/app/loading.tsx
//
// Carga de cualquier ruta sin loading propio (públicas y paneles). El isotipo
// hecho indicador: el punto (la persona) recorre el arco (el puente) de un lado
// a otro. Con movimiento reducido se queda quieto en lo alto del arco y el
// texto dice lo que pasa. Estilos: _estados/estados.css (prefijo es-).
import './_estados/estados.css';

export default function Loading() {
  return (
    // role/aria-live: el lector de pantalla anuncia la carga
    <div className="es-carga" role="status" aria-live="polite">
      <span className="es-carga__arco" aria-hidden="true">
        <span className="es-carga__brazo" />
      </span>
      <p className="es-carga__texto">Cargando…</p>
    </div>
  );
}
