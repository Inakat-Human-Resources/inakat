// RUTA: __tests__/qa/lalo-marzo2026-distance.test.ts

/**
 * Tests de regresión — Batch 4: DistanceBadge integration (Marzo 2026)
 *
 * Verify DistanceBadge is integrated in:
 * A: Recruiter dashboard (sent applications)
 * B: Specialist job detail (candidate cards)
 * C: Company candidates page (candidate list)
 * D: APIs return coordinate data
 */

import * as fs from 'fs';
import * as path from 'path';

const readFile = (filePath: string) =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

// ============================================================
// DistanceBadge component exists and is functional
// ============================================================

describe('Batch 4: DistanceBadge component', () => {
  it('DistanceBadge component should exist', () => {
    expect(
      fs.existsSync(path.join(process.cwd(), 'src/components/shared/DistanceBadge.tsx'))
    ).toBe(true);
  });

  it('should accept candidateLat, candidateLng, jobLat, jobLng props', () => {
    const content = readFile('src/components/shared/DistanceBadge.tsx');
    expect(content).toContain('candidateLat');
    expect(content).toContain('candidateLng');
    expect(content).toContain('jobLat');
    expect(content).toContain('jobLng');
  });

  it('should support compact mode', () => {
    const content = readFile('src/components/shared/DistanceBadge.tsx');
    expect(content).toContain('compact');
  });
});

// ============================================================
// A: Recruiter dashboard integration
// ============================================================

describe('Batch 4A: Recruiter dashboard has DistanceBadge', () => {
  const content = readFile('src/app/recruiter/dashboard/page.tsx');

  it('should import DistanceBadge', () => {
    expect(content).toMatch(/import\s+DistanceBadge\s+from/);
  });

  it('should render <DistanceBadge in sent applications', () => {
    expect(content).toMatch(/<DistanceBadge/);
  });

  it('should pass candidateLat from candidateProfile', () => {
    expect(content).toMatch(/candidateLat=\{.*candidateProfile.*latitude/);
  });

  it('should pass jobLatitude/jobLongitude', () => {
    expect(content).toMatch(/jobLat=\{.*jobLatitude/);
  });

  it('SentApplication interface should have jobLatitude/jobLongitude', () => {
    expect(content).toMatch(/jobLatitude/);
    expect(content).toMatch(/jobLongitude/);
  });
});

describe('Batch 4A: Recruiter API returns job coordinates', () => {
  const content = readFile('src/app/api/recruiter/dashboard/route.ts');

  it('sentApplications should include jobLatitude', () => {
    expect(content).toContain('jobLatitude');
  });

  it('sentApplications should include jobLongitude', () => {
    expect(content).toContain('jobLongitude');
  });
});

// ============================================================
// B: Specialist job detail integration
// ============================================================

describe('Batch 4B: Specialist job detail has DistanceBadge', () => {
  const content = readFile('src/app/specialist/jobs/[jobId]/page.tsx');

  it('should import DistanceBadge', () => {
    expect(content).toMatch(/import\s+DistanceBadge\s+from/);
  });

  it('should render <DistanceBadge in candidate cards', () => {
    expect(content).toMatch(/<DistanceBadge/);
  });

  it('CandidateProfile should have latitude/longitude', () => {
    expect(content).toMatch(/latitude\?:\s*number/);
    expect(content).toMatch(/longitude\?:\s*number/);
  });
});

describe('Batch 4B: Specialist API returns candidate coordinates', () => {
  const content = readFile('src/app/api/specialist/dashboard/route.ts');

  it('should select latitude from candidates', () => {
    expect(content).toContain('latitude: true');
  });

  it('should select longitude from candidates', () => {
    expect(content).toContain('longitude: true');
  });
});

// ============================================================
// C: Company candidates page integration
// ============================================================

describe('Batch 4C: Company candidates page has DistanceBadge', () => {
  const content = readFile('src/app/company/jobs/[jobId]/candidates/page.tsx');

  it('should import DistanceBadge', () => {
    expect(content).toMatch(/import\s+DistanceBadge\s+from/);
  });

  it('should render <DistanceBadge', () => {
    expect(content).toMatch(/<DistanceBadge/);
  });

  it('Job interface should have latitude/longitude', () => {
    expect(content).toMatch(/latitude\?:\s*number/);
    expect(content).toMatch(/longitude\?:\s*number/);
  });

  it('Application candidateProfile should have latitude/longitude', () => {
    // Check candidateProfile has the fields
    expect(content).toMatch(/candidateProfile.*latitude/s);
  });
});

describe('Batch 4C: Company candidates API returns coordinates', () => {
  const content = readFile('src/app/api/company/jobs/[jobId]/candidates/route.ts');

  it('job select should include latitude', () => {
    expect(content).toContain('latitude: true');
  });

  it('job select should include longitude', () => {
    expect(content).toContain('longitude: true');
  });

  it('candidateProfile enrichment should include latitude', () => {
    expect(content).toMatch(/latitude:\s*candidate\.latitude/);
  });

  it('candidateProfile enrichment should include longitude', () => {
    expect(content).toMatch(/longitude:\s*candidate\.longitude/);
  });
});

describe('Batch 4C: Company dashboard API returns coordinates', () => {
  const content = readFile('src/app/api/company/dashboard/route.ts');

  it('job select should include latitude', () => {
    expect(content).toContain('latitude: true');
  });

  it('candidateProfile should include latitude/longitude', () => {
    expect(content).toMatch(/latitude:\s*candidate\.latitude/);
    expect(content).toMatch(/longitude:\s*candidate\.longitude/);
  });
});
