/**
 * RUTA: __tests__/lib/fechas.test.ts
 *
 * El formateador único de fechas (src/lib/fechas.ts): el mismo texto en el
 * servidor y en el navegador, nada de 1970 ni de «Invalid Date» en pantalla,
 * y las fechas sin hora leídas en UTC para que no se corran un día.
 */
import { aFecha, esFechaValida, fechaCorta, fechaHora, fechaIso, fechaLarga, hora } from '@/lib/fechas';

describe('fechas', () => {
  // Fecha local (sin zona): el resultado no depende de la zona de la máquina.
  const tarde = new Date(2026, 8, 23, 18, 22);

  it('fechaCorta: «23 sep 2026» para tablas y listas', () => {
    expect(fechaCorta(tarde)).toBe('23 sep 2026');
    expect(fechaCorta(tarde.toISOString())).toBe('23 sep 2026');
    expect(fechaCorta(tarde.getTime())).toBe('23 sep 2026');
  });

  it('fechaHora y hora: 24 h con dos cifras', () => {
    expect(fechaHora(tarde)).toBe('23 sep 2026, 18:22');
    expect(hora(new Date(2026, 0, 5, 7, 4))).toBe('07:04');
  });

  it('fechaLarga: sólo para detalle o title', () => {
    expect(fechaLarga(tarde)).toBe('23 de septiembre de 2026');
    expect(fechaLarga(new Date(2026, 1, 25))).toBe('25 de febrero de 2026');
  });

  it('sin fecha, o con una que no lo es, devuelve «—» (nunca 1970 ni Invalid Date)', () => {
    for (const malo of [null, undefined, '', 'no es fecha']) {
      expect(fechaCorta(malo)).toBe('—');
      expect(fechaHora(malo)).toBe('—');
      expect(fechaLarga(malo)).toBe('—');
      expect(hora(malo)).toBe('—');
      expect(fechaIso(malo)).toBeUndefined();
      expect(esFechaValida(malo)).toBe(false);
      expect(aFecha(malo)).toBeNull();
    }
    expect(fechaCorta(null, { vacio: 'Nunca' })).toBe('Nunca');
  });

  it('utc: una fecha sin hora guardada a medianoche UTC no se corre un día', () => {
    expect(fechaCorta('2020-01-01T00:00:00.000Z', { utc: true })).toBe('1 ene 2020');
    expect(fechaLarga('2020-12-31T00:00:00.000Z', { utc: true })).toBe('31 de diciembre de 2020');
  });

  it('fechaIso sirve para <time dateTime>', () => {
    expect(fechaIso('2026-09-23T18:22:00.000Z')).toBe('2026-09-23T18:22:00.000Z');
  });
});
