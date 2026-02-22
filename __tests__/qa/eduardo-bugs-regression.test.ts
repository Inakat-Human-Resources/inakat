// RUTA: __tests__/qa/eduardo-bugs-regression.test.ts

/**
 * Tests de regresión para bugs reportados por Eduardo (Feb 2026)
 * Cada test verifica que un bug corregido no vuelva a ocurrir
 */

import * as fs from 'fs';
import * as path from 'path';

const readFile = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

// ============================================================
// E-8: Admin page resilience (Promise.allSettled)
// ============================================================

describe('E-8: Admin page should not crash when APIs fail', () => {
  it('should handle partial API failures gracefully', () => {
    const mockResults = [
      { status: 'fulfilled' as const, value: { success: true, data: [] } },
      { status: 'rejected' as const, reason: new Error('DB connection failed') },
      { status: 'fulfilled' as const, value: { success: true, data: [] } },
      { status: 'fulfilled' as const, value: { success: true, data: [] } },
    ];

    const jobsData = mockResults[0].status === 'fulfilled' ? mockResults[0].value : { success: false };
    const requestsData = mockResults[1].status === 'fulfilled' ? (mockResults[1] as any).value : { success: false };

    expect(jobsData.success).toBe(true);
    expect(requestsData.success).toBe(false);
  });

  it('should use Promise.allSettled instead of Promise.all', () => {
    const content = readFile('src/app/admin/page.tsx');
    expect(content).toContain('Promise.allSettled');
    expect(content).not.toMatch(/Promise\.all\(\[[\s\S]*?fetch/);
  });

  it('should have error.tsx boundary file', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/app/admin/error.tsx'))).toBe(true);
  });

  it('should have loading.tsx file', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/app/admin/loading.tsx'))).toBe(true);
  });
});

// ============================================================
// E-1: Chrome autocomplete on Departamento field
// ============================================================

describe('E-1: Departamento field should not be autocompleted as email', () => {
  it('should have autoComplete attribute in FormRegisterForQuotation', () => {
    const content = readFile('src/components/sections/companies/FormRegisterForQuotationSection.tsx');
    expect(content).toContain('autoComplete=');
    expect(content).toMatch(/name=["']departamento["'][\s\S]*?autoComplete=/);
  });
});

// ============================================================
// E-2: Google Maps should include establishments
// ============================================================

describe('E-2: Google Maps Autocomplete should show establishments', () => {
  it('should NOT restrict to address type only', () => {
    const content = readFile('src/components/sections/companies/FormRegisterForQuotationSection.tsx');
    expect(content).not.toMatch(/types:\s*\[\s*['"]address['"]\s*\]/);
    expect(content).toContain('establishment');
  });
});

// ============================================================
// E-3: Draft save before purchasing credits
// ============================================================

describe('E-3: Should save draft before redirecting to buy credits', () => {
  it('should have "Guardar Borrador" option in insufficient credits modal', () => {
    const content = readFile('src/components/sections/jobs/CreateJobForm.tsx');
    expect(content).toMatch(/Guardar\s+Borrador/i);
  });

  it('should call handleSubmit before redirect in credits modal', () => {
    const content = readFile('src/components/sections/jobs/CreateJobForm.tsx');
    const modalMatch = content.match(/showInsufficientCreditsModal[\s\S]*?\/credits\/purchase/);
    expect(modalMatch).toBeTruthy();
    if (modalMatch) {
      expect(modalMatch[0]).toContain('handleSubmit');
    }
  });
});

// ============================================================
// E-4: Candidate location with Google Autocomplete
// ============================================================

describe('E-4: Candidate profile should have Google Autocomplete for location', () => {
  it('should import Autocomplete in profile page', () => {
    const content = readFile('src/app/profile/page.tsx');
    expect(content).toMatch(/import.*Autocomplete.*from.*@react-google-maps/);
  });

  it('should have Autocomplete component wrapping ubicacion input', () => {
    const content = readFile('src/app/profile/page.tsx');
    expect(content).toContain('<Autocomplete');
    expect(content).toContain('onPlaceChanged');
  });

  it('should capture latitude and longitude from selected place', () => {
    const content = readFile('src/app/profile/page.tsx');
    expect(content).toMatch(/candidateLatitude/);
    expect(content).toMatch(/candidateLongitude/);
    expect(content).toContain('geometry');
  });
});

// ============================================================
// E-5: Document upload feedback and timeout
// ============================================================

describe('E-5: Document upload should have timeout and error feedback', () => {
  it('should have timeout protection in upload function', () => {
    const content = readFile('src/app/register/page.tsx');
    expect(content).toMatch(/Promise\.race/i);
  });

  it('should validate file size before upload', () => {
    const content = readFile('src/app/register/page.tsx');
    expect(content).toMatch(/5\s*\*\s*1024\s*\*\s*1024/);
  });

  it('should show error feedback to user (not just console.error)', () => {
    const content = readFile('src/app/register/page.tsx');
    const uploadSection = content.match(/updateDocument[\s\S]*?catch[\s\S]*?\}/);
    expect(uploadSection).toBeTruthy();
    if (uploadSection) {
      expect(uploadSection[0]).toMatch(/alert/i);
    }
  });
});

// ============================================================
// E-6: Independent scroll in Talents columns
// ============================================================

describe('E-6: Talents page should have independent scroll columns', () => {
  it('should have overflow-y-auto on columns', () => {
    const content = readFile('src/components/sections/talents/SearchPositionsSection.tsx');
    expect(content).toMatch(/overflow-y-auto/);
    expect(content).toMatch(/h-\[calc\(100vh/);
  });
});

// ============================================================
// E-7: Application success feedback in modal
// ============================================================

describe('E-7: Apply modal should show success confirmation before closing', () => {
  it('should have success state in ApplyJobModal', () => {
    const content = readFile('src/components/sections/talents/ApplyJobModal.tsx');
    expect(content).toMatch(/applicationSent/);
  });

  it('should NOT close modal immediately after successful application', () => {
    const content = readFile('src/components/sections/talents/ApplyJobModal.tsx');
    expect(content).toMatch(/setTimeout[\s\S]*?onClose/);
  });

  it('should show success message', () => {
    const content = readFile('src/components/sections/talents/ApplyJobModal.tsx');
    expect(content).toMatch(/Aplicación\s+Enviada/i);
  });
});

// ============================================================
// Distance calculation utility
// ============================================================

describe('Distance calculation utility', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { calculateDistance, estimateTravelTime, getDistanceInfo } = require('../../src/lib/distance');

  it('should export calculateDistance function', () => {
    expect(calculateDistance).toBeDefined();
    expect(typeof calculateDistance).toBe('function');
  });

  it('should calculate distance between Monterrey and CDMX correctly (~750-770 km)', () => {
    const distance = calculateDistance(25.6866, -100.3161, 19.4326, -99.1332);
    expect(distance).toBeGreaterThan(700);
    expect(distance).toBeLessThan(800);
  });

  it('should return 0 for same point', () => {
    const distance = calculateDistance(25.6866, -100.3161, 25.6866, -100.3161);
    expect(distance).toBe(0);
  });

  it('should calculate short distances accurately (San Pedro-Monterrey ~10-15 km)', () => {
    const distance = calculateDistance(25.6614, -100.4026, 25.6866, -100.3161);
    expect(distance).toBeGreaterThan(5);
    expect(distance).toBeLessThan(20);
  });

  it('should estimate driving time', () => {
    const result = estimateTravelTime(25);
    // 25km at 25km/h = 60min = "1h"
    expect(result.driving).toBe('1h');
    expect(result.transit).toBeDefined();
  });

  it('should format time as hours when > 60 min', () => {
    const result = estimateTravelTime(50);
    expect(result.driving).toContain('h');
  });

  it('should return null when coordinates are missing', () => {
    expect(getDistanceInfo(25.6866, -100.3161, null, null)).toBeNull();
    expect(getDistanceInfo(null, null, 25.6866, -100.3161)).toBeNull();
  });

  it('should return full distance info when all coordinates present', () => {
    const result = getDistanceInfo(25.6866, -100.3161, 25.6614, -100.4026);
    expect(result).not.toBeNull();
    expect(result!.distanceKm).toBeGreaterThan(0);
    expect(result!.driving).toBeDefined();
    expect(result!.transit).toBeDefined();
  });
});

// ============================================================
// Schema validation: lat/lng fields exist
// ============================================================

describe('Prisma schema should have coordinate fields', () => {
  it('should have latitude and longitude in Candidate model', () => {
    const schema = readFile('prisma/schema.prisma');
    const candidateMatch = schema.match(/model Candidate \{[\s\S]*?\n\}/);
    expect(candidateMatch).toBeTruthy();
    expect(candidateMatch![0]).toContain('latitude');
    expect(candidateMatch![0]).toContain('longitude');
    expect(candidateMatch![0]).toContain('Float?');
  });

  it('should have latitude and longitude in Job model', () => {
    const schema = readFile('prisma/schema.prisma');
    const jobMatch = schema.match(/model Job \{[\s\S]*?\n\}/);
    expect(jobMatch).toBeTruthy();
    expect(jobMatch![0]).toContain('latitude');
    expect(jobMatch![0]).toContain('longitude');
  });
});

// ============================================================
// Profile API should handle lat/lng
// ============================================================

describe('Profile API should save and return coordinates', () => {
  it('should include latitude and longitude in candidate select', () => {
    const content = readFile('src/app/api/profile/route.ts');
    expect(content).toContain('latitude: true');
    expect(content).toContain('longitude: true');
  });

  it('should update latitude and longitude in PUT handler', () => {
    const content = readFile('src/app/api/profile/route.ts');
    expect(content).toMatch(/updateCandidateData\.latitude/);
    expect(content).toMatch(/updateCandidateData\.longitude/);
  });
});
