// RUTA: __tests__/components/DistanceBadge.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/lib/distance', () => ({
  getDistanceInfo: jest.fn(),
}));

import { getDistanceInfo } from '@/lib/distance';
import DistanceBadge, { UMBRAL_LEJOS_KM } from '@/components/shared/DistanceBadge';

const mockGetDistanceInfo = getDistanceInfo as jest.Mock;

describe('DistanceBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render null when coordinates are missing', () => {
    mockGetDistanceInfo.mockReturnValue(null);
    const { container } = render(
      <DistanceBadge candidateLat={null} candidateLng={null} jobLat={null} jobLng={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render compact badge with distance', () => {
    mockGetDistanceInfo.mockReturnValue({
      distanceKm: 12.5,
      driving: '30 min',
      transit: '50 min',
    });
    render(
      <DistanceBadge
        candidateLat={25.68}
        candidateLng={-100.31}
        jobLat={25.66}
        jobLng={-100.40}
        compact
      />
    );
    expect(screen.getByText('12.5 km')).toBeInTheDocument();
  });

  it('should render full badge with driving and transit times', () => {
    mockGetDistanceInfo.mockReturnValue({
      distanceKm: 25,
      driving: '1h',
      transit: '1h 40min',
    });
    render(
      <DistanceBadge
        candidateLat={25.68}
        candidateLng={-100.31}
        jobLat={19.43}
        jobLng={-99.13}
      />
    );
    expect(screen.getByText('25 km')).toBeInTheDocument();
    expect(screen.getByText('1h')).toBeInTheDocument();
    expect(screen.getByText('1h 40min')).toBeInTheDocument();
  });

  // Rediseño 2026-09 (QA visual): la cercanía ya no se dice sólo con color.
  // El chip es el mismo (neutro) para cualquier distancia; pasado el umbral
  // dice «lejos» con texto. La cifra en km siempre va escrita.
  it('una distancia corta sale en el chip neutro y sin «lejos»', () => {
    mockGetDistanceInfo.mockReturnValue({
      distanceKm: 5,
      driving: '12 min',
      transit: '20 min',
    });
    const { container } = render(
      <DistanceBadge
        candidateLat={25.68}
        candidateLng={-100.31}
        jobLat={25.66}
        jobLng={-100.32}
        compact
      />
    );
    expect(container.firstChild).toHaveClass('bg-mist');
    expect(screen.getByText('5 km')).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/lejos/);
  });

  it('una distancia larga lleva el MISMO chip y además el texto «lejos» (color y texto)', () => {
    mockGetDistanceInfo.mockReturnValue({
      distanceKm: 100,
      driving: '4h',
      transit: '6h 40min',
    });
    const { container } = render(
      <DistanceBadge
        candidateLat={25.68}
        candidateLng={-100.31}
        jobLat={19.43}
        jobLng={-99.13}
        compact
      />
    );
    expect(container.firstChild).toHaveClass('bg-mist');
    expect(container.firstChild).not.toHaveClass('bg-danger-tint');
    expect(screen.getByText('100 km')).toBeInTheDocument();
    expect(container).toHaveTextContent(/lejos/);
  });

  it('el umbral: justo en el corte no es «lejos»; por encima, sí', () => {
    mockGetDistanceInfo.mockReturnValue({ distanceKm: UMBRAL_LEJOS_KM, driving: '1h', transit: '2h' });
    const { container, rerender } = render(<DistanceBadge candidateLat={1} candidateLng={1} jobLat={1} jobLng={1} compact />);
    expect(container).not.toHaveTextContent(/lejos/);
    mockGetDistanceInfo.mockReturnValue({ distanceKm: UMBRAL_LEJOS_KM + 0.1, driving: '1h', transit: '2h' });
    rerender(<DistanceBadge candidateLat={1} candidateLng={1} jobLat={1} jobLng={1} compact />);
    expect(container).toHaveTextContent(/lejos/);
  });

  it('la versión completa también dice «lejos» con texto', () => {
    mockGetDistanceInfo.mockReturnValue({ distanceKm: 73.9, driving: '2h 57min', transit: '4h 56min' });
    const { container } = render(<DistanceBadge candidateLat={1} candidateLng={1} jobLat={1} jobLng={1} />);
    expect(screen.getByText('73.9 km')).toBeInTheDocument();
    expect(container).toHaveTextContent(/lejos/);
  });
});
