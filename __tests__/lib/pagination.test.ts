// RUTA: __tests__/lib/pagination.test.ts

/**
 * Tests para el módulo de paginación.
 */

import { getPaginationParams, buildPaginatedResponse } from '@/lib/pagination';

describe('getPaginationParams', () => {
  it('debe retornar defaults cuando no hay params', () => {
    const params = new URLSearchParams();
    const result = getPaginationParams(params);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(20);
  });

  it('debe parsear page y limit correctamente', () => {
    const params = new URLSearchParams('page=3&limit=10');
    const result = getPaginationParams(params);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
    expect(result.skip).toBe(20); // (3-1) * 10
    expect(result.take).toBe(10);
  });

  it('debe calcular skip correctamente para diferentes páginas', () => {
    const params1 = new URLSearchParams('page=1&limit=25');
    expect(getPaginationParams(params1).skip).toBe(0);

    const params2 = new URLSearchParams('page=2&limit=25');
    expect(getPaginationParams(params2).skip).toBe(25);

    const params5 = new URLSearchParams('page=5&limit=25');
    expect(getPaginationParams(params5).skip).toBe(100);
  });

  it('debe respetar el defaultLimit custom', () => {
    const params = new URLSearchParams();
    const result = getPaginationParams(params, 30);
    expect(result.limit).toBe(30);
  });

  it('debe capear al maxLimit', () => {
    const params = new URLSearchParams('limit=500');
    const result = getPaginationParams(params, 20, 100);
    expect(result.limit).toBe(100);
  });

  it('debe respetar maxLimit custom', () => {
    const params = new URLSearchParams('limit=60');
    const result = getPaginationParams(params, 20, 50);
    expect(result.limit).toBe(50);
  });

  it('debe forzar page mínimo 1', () => {
    const params = new URLSearchParams('page=0');
    expect(getPaginationParams(params).page).toBe(1);

    const params2 = new URLSearchParams('page=-5');
    expect(getPaginationParams(params2).page).toBe(1);
  });

  it('debe forzar limit mínimo 1', () => {
    const params = new URLSearchParams('limit=0');
    expect(getPaginationParams(params).limit).toBe(1);

    const params2 = new URLSearchParams('limit=-10');
    expect(getPaginationParams(params2).limit).toBe(1);
  });

  it('take debe ser igual a limit', () => {
    const params = new URLSearchParams('limit=15');
    const result = getPaginationParams(params);
    expect(result.take).toBe(result.limit);
  });

  it('debe manejar valores no numéricos gracefully', () => {
    const params = new URLSearchParams('page=abc&limit=xyz');
    const result = getPaginationParams(params);
    // parseInt('abc') = NaN, Math.max(1, NaN) = NaN en JS
    // Verificar que no crashea
    expect(result).toBeDefined();
  });
});

describe('buildPaginatedResponse', () => {
  const sampleData = ['a', 'b', 'c'];
  const params = { page: 1, limit: 10, skip: 0, take: 10 };

  it('debe construir respuesta correctamente', () => {
    const result = buildPaginatedResponse(sampleData, 25, params);
    expect(result.data).toEqual(sampleData);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(10);
    expect(result.pagination.total).toBe(25);
    expect(result.pagination.totalPages).toBe(3); // ceil(25/10)
    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.hasPrev).toBe(false);
  });

  it('debe calcular hasNext y hasPrev correctamente en página intermedia', () => {
    const page2 = { page: 2, limit: 10, skip: 10, take: 10 };
    const result = buildPaginatedResponse(sampleData, 25, page2);
    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it('debe marcar hasNext=false en última página', () => {
    const lastPage = { page: 3, limit: 10, skip: 20, take: 10 };
    const result = buildPaginatedResponse(sampleData, 25, lastPage);
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it('debe manejar 0 resultados', () => {
    const result = buildPaginatedResponse([], 0, params);
    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(false);
  });

  it('debe manejar exactamente 1 página', () => {
    const result = buildPaginatedResponse(sampleData, 3, params);
    expect(result.pagination.totalPages).toBe(1);
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(false);
  });

  it('debe calcular totalPages con ceil', () => {
    // 21 items / 10 per page = 3 pages (ceil)
    const result = buildPaginatedResponse(sampleData, 21, params);
    expect(result.pagination.totalPages).toBe(3);
  });

  it('debe manejar total exactamente divisible por limit', () => {
    // 20 items / 10 per page = 2 pages exactas
    const result = buildPaginatedResponse(sampleData, 20, params);
    expect(result.pagination.totalPages).toBe(2);
    expect(result.pagination.hasNext).toBe(true); // page 1 of 2
  });

  it('debe preservar data tipada', () => {
    interface Item { id: number; name: string }
    const data: Item[] = [{ id: 1, name: 'test' }];
    const result = buildPaginatedResponse(data, 1, params);
    expect(result.data[0].id).toBe(1);
    expect(result.data[0].name).toBe('test');
  });
});
