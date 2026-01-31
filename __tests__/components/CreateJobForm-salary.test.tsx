// RUTA: __tests__/components/CreateJobForm-salary.test.tsx

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn().mockReturnValue(null),
  }),
}));

// Mock Google Maps
jest.mock('@react-google-maps/api', () => ({
  useLoadScript: () => ({
    isLoaded: false,
    loadError: null,
  }),
  GoogleMap: ({ children }: { children: React.ReactNode }) => <div data-testid="google-map">{children}</div>,
  Marker: () => <div data-testid="marker" />,
  Autocomplete: ({ children }: { children: React.ReactNode }) => <div data-testid="autocomplete">{children}</div>,
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import component after mocks
import CreateJobForm from '@/components/sections/jobs/CreateJobForm';

describe('CreateJobForm - Salary Range Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock API responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/pricing/calculate') && !url.includes('POST')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            options: {
              profiles: ['Tecnología', 'Marketing'],
              seniorities: ['Junior', 'Mid', 'Senior'],
              workModes: ['presential', 'remote', 'hybrid'],
              locations: []
            }
          }),
        });
      }
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            user: { credits: 10, role: 'company' }
          }),
        });
      }
      if (url.includes('/api/specialties')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 1, name: 'Tecnología', slug: 'tecnologia', icon: '💻', color: '#000', subcategories: [] }
            ]
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });
  });

  it('should show error when salary range exceeds $10,000 MXN', async () => {
    render(<CreateJobForm />);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByPlaceholderText('15,000')).toBeInTheDocument();
    });

    const salaryMinInput = screen.getByPlaceholderText('15,000');
    const salaryMaxInput = screen.getByPlaceholderText('22,000');

    // Enter salaries with difference > $10,000
    await userEvent.clear(salaryMinInput);
    await userEvent.type(salaryMinInput, '15000');

    await userEvent.clear(salaryMaxInput);
    await userEvent.type(salaryMaxInput, '30000');

    // Check that error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/diferencia entre salario máximo y mínimo no puede ser mayor a \$10,000 MXN/i)).toBeInTheDocument();
    });
  });

  it('should not show error when salary range is within $10,000 MXN', async () => {
    render(<CreateJobForm />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('15,000')).toBeInTheDocument();
    });

    const salaryMinInput = screen.getByPlaceholderText('15,000');
    const salaryMaxInput = screen.getByPlaceholderText('22,000');

    // Enter salaries with difference <= $10,000
    await userEvent.clear(salaryMinInput);
    await userEvent.type(salaryMinInput, '15000');

    await userEvent.clear(salaryMaxInput);
    await userEvent.type(salaryMaxInput, '25000');

    // Check that no error message is displayed
    await waitFor(() => {
      expect(screen.queryByText(/diferencia entre salario máximo y mínimo no puede ser mayor a \$10,000 MXN/i)).not.toBeInTheDocument();
    });
  });

  it('should show error when min salary is greater than max salary', async () => {
    render(<CreateJobForm />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('15,000')).toBeInTheDocument();
    });

    const salaryMinInput = screen.getByPlaceholderText('15,000');
    const salaryMaxInput = screen.getByPlaceholderText('22,000');

    // Enter min > max
    await userEvent.clear(salaryMinInput);
    await userEvent.type(salaryMinInput, '25000');

    await userEvent.clear(salaryMaxInput);
    await userEvent.type(salaryMaxInput, '20000');

    // Check that error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/salario mínimo no puede ser mayor al máximo/i)).toBeInTheDocument();
    });
  });

  it('should clear error when salary range is corrected', async () => {
    render(<CreateJobForm />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('15,000')).toBeInTheDocument();
    });

    const salaryMinInput = screen.getByPlaceholderText('15,000');
    const salaryMaxInput = screen.getByPlaceholderText('22,000');

    // First, create an error
    await userEvent.clear(salaryMinInput);
    await userEvent.type(salaryMinInput, '15000');

    await userEvent.clear(salaryMaxInput);
    await userEvent.type(salaryMaxInput, '30000');

    // Verify error appears
    await waitFor(() => {
      expect(screen.getByText(/diferencia entre salario máximo y mínimo no puede ser mayor a \$10,000 MXN/i)).toBeInTheDocument();
    });

    // Now correct it
    await userEvent.clear(salaryMaxInput);
    await userEvent.type(salaryMaxInput, '25000');

    // Verify error is gone
    await waitFor(() => {
      expect(screen.queryByText(/diferencia entre salario máximo y mínimo no puede ser mayor a \$10,000 MXN/i)).not.toBeInTheDocument();
    });
  });

  it('should disable submit buttons when there is a salary error', async () => {
    render(<CreateJobForm />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('15,000')).toBeInTheDocument();
    });

    const salaryMinInput = screen.getByPlaceholderText('15,000');
    const salaryMaxInput = screen.getByPlaceholderText('22,000');

    // Enter invalid salary range
    await userEvent.clear(salaryMinInput);
    await userEvent.type(salaryMinInput, '15000');

    await userEvent.clear(salaryMaxInput);
    await userEvent.type(salaryMaxInput, '30000');

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/diferencia entre salario máximo y mínimo no puede ser mayor a \$10,000 MXN/i)).toBeInTheDocument();
    });

    // Check that the save draft button is disabled
    const saveDraftButton = screen.getByRole('button', { name: /guardar borrador/i });
    expect(saveDraftButton).toBeDisabled();
  });

  it('should allow exactly $10,000 MXN difference (edge case)', async () => {
    render(<CreateJobForm />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('15,000')).toBeInTheDocument();
    });

    const salaryMinInput = screen.getByPlaceholderText('15,000');
    const salaryMaxInput = screen.getByPlaceholderText('22,000');

    // Enter exactly $10,000 difference
    await userEvent.clear(salaryMinInput);
    await userEvent.type(salaryMinInput, '15000');

    await userEvent.clear(salaryMaxInput);
    await userEvent.type(salaryMaxInput, '25000');

    // Should not show error
    await waitFor(() => {
      expect(screen.queryByText(/diferencia entre salario máximo y mínimo no puede ser mayor a \$10,000 MXN/i)).not.toBeInTheDocument();
    });
  });
});
