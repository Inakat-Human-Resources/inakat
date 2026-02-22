// RUTA: __tests__/components/DistanceBadge.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/lib/distance', () => ({
  getDistanceInfo: jest.fn(),
}));

import { getDistanceInfo } from '@/lib/distance';
import DistanceBadge from '@/components/shared/DistanceBadge';

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

  it('should use green color for short distances (<=10km)', () => {
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
    expect(container.firstChild).toHaveClass('bg-green-50');
  });

  it('should use red color for long distances (>60km)', () => {
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
    expect(container.firstChild).toHaveClass('bg-red-50');
  });
});
