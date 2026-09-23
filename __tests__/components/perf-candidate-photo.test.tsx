// RUTA: __tests__/components/perf-candidate-photo.test.tsx

/**
 * Auditoría 2026-09 · módulo perfil — CandidatePhoto
 *
 * PERF-002: fotoUrl no se validaba. next/image LANZA en el render si el host
 *           no está en images.remotePatterns, así que una foto con cualquier
 *           otro host tiraba la ficha del candidato para el staff y la empresa.
 *           Además no había fallback si la imagen no cargaba.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// next/image real lanzaría con hosts no configurados; aquí basta un <img> que
// reenvíe onError para comprobar el fallback.
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, onError }: any) => <img src={src} alt={alt} onError={onError} />,
}));

import CandidatePhoto, { esFotoRenderizable } from '@/components/shared/CandidatePhoto';

const URL_PROPIA = 'https://abc123store.public.blob.vercel-storage.com/foto.png';

describe('PERF-002 · CandidatePhoto', () => {
  it('pinta la foto si viene de nuestro almacenamiento', () => {
    render(<CandidatePhoto fotoUrl={URL_PROPIA} candidateName="Ana" />);
    expect(screen.getByAltText('Foto de Ana')).toBeInTheDocument();
  });

  it('con un host externo muestra el icono en vez de pasarlo a next/image', () => {
    render(<CandidatePhoto fotoUrl="https://evil.example/foto.png" candidateName="Ana" />);
    expect(screen.queryByAltText('Foto de Ana')).not.toBeInTheDocument();
  });

  it('si la imagen no carga vuelve al icono', () => {
    render(<CandidatePhoto fotoUrl={URL_PROPIA} candidateName="Ana" />);
    fireEvent.error(screen.getByAltText('Foto de Ana'));
    expect(screen.queryByAltText('Foto de Ana')).not.toBeInTheDocument();
  });

  it('esFotoRenderizable: sólo blob propio https o ruta local', () => {
    expect(esFotoRenderizable(URL_PROPIA)).toBe(true);
    expect(esFotoRenderizable('/uploads/foto.png')).toBe(true);
    expect(esFotoRenderizable('//evil.example/foto.png')).toBe(false);
    expect(esFotoRenderizable('http://abc.public.blob.vercel-storage.com/f.png')).toBe(false);
    expect(esFotoRenderizable('https://public.blob.vercel-storage.com.evil.example/f.png')).toBe(false);
    expect(esFotoRenderizable('javascript:alert(1)')).toBe(false);
    expect(esFotoRenderizable(null)).toBe(false);
    expect(esFotoRenderizable('')).toBe(false);
  });
});
