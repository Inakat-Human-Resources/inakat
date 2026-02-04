// RUTA: __tests__/api/evaluations/evaluation-notes-schema.test.ts

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('EvaluationNote - Schema relations', () => {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  it('should have @relation on authorId referencing User', () => {
    expect(schema).toContain('author');
    expect(schema).toContain('EvaluationNoteAuthor');
    expect(schema).toMatch(/author\s+User\s+@relation/);
  });

  it('should have @relation on applicationId referencing Application', () => {
    expect(schema).toMatch(/application\s+Application\s+@relation/);
  });

  it('should have onDelete: Cascade on both relations', () => {
    // Dentro del modelo EvaluationNote deben existir ambos Cascade
    const evalNoteBlock = schema.split('model EvaluationNote')[1]?.split('model ')[0] || '';
    const cascadeCount = (evalNoteBlock.match(/onDelete: Cascade/g) || []).length;
    expect(cascadeCount).toBe(2);
  });

  it('User model should have evaluationNotes relation', () => {
    const userBlock = schema.split('model User')[1]?.split('model ')[0] || '';
    expect(userBlock).toContain('evaluationNotes');
    expect(userBlock).toContain('EvaluationNoteAuthor');
  });

  it('Application model should have evaluationNotes relation', () => {
    const appBlock = schema.split('model Application')[1]?.split('model ')[0] || '';
    expect(appBlock).toContain('evaluationNotes');
  });
});
