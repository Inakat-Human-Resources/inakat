# 🤝 Guía de Contribución - INAKAT

¡Gracias por tu interés en contribuir a INAKAT! Esta guía te ayudará a empezar.

---

## 📋 Tabla de Contenidos

1. [Código de Conducta](#código-de-conducta)
2. [¿Cómo Puedo Contribuir?](#cómo-puedo-contribuir)
3. [Configuración del Entorno](#configuración-del-entorno)
4. [Flujo de Trabajo](#flujo-de-trabajo)
5. [Estándares de Código](#estándares-de-código)
6. [Commit Messages](#commit-messages)
7. [Pull Requests](#pull-requests)
8. [Reportar Bugs](#reportar-bugs)
9. [Sugerir Features](#sugerir-features)

---

## 📜 Código de Conducta

### Nuestro Compromiso

Nos comprometemos a hacer de INAKAT un proyecto acogedor para todos, independientemente de:
- Edad
- Discapacidad
- Etnicidad
- Identidad de género
- Nivel de experiencia
- Nacionalidad
- Apariencia personal
- Religión
- Orientación sexual

### Comportamiento Esperado

**✅ SÍ:**
- Ser respetuoso con diferentes puntos de vista
- Aceptar críticas constructivas
- Enfocarse en lo mejor para la comunidad
- Mostrar empatía con otros miembros

**❌ NO:**
- Usar lenguaje sexualizado o inapropiado
- Hacer comentarios insultantes o despectivos
- Acosar públicamente o privadamente
- Publicar información privada sin permiso

### Reporte de Conducta

Si observas comportamiento inaceptable:
- 📧 Email: conduct@inakat.com
- Tiempo de respuesta: 24 horas
- Confidencialidad garantizada

---

## 🎯 ¿Cómo Puedo Contribuir?

### Tipos de Contribución

**💻 Código**
- Implementar nuevas features
- Corregir bugs
- Mejorar performance
- Refactorizar código

**📚 Documentación**
- Mejorar README
- Escribir tutoriales
- Traducir documentos
- Corregir typos

**🎨 Diseño**
- Mejorar UI/UX
- Crear mockups
- Diseñar iconos
- Optimizar CSS

**🐛 Testing**
- Escribir tests
- Reportar bugs
- Probar pull requests
- QA manual

**💬 Comunidad**
- Responder preguntas
- Ayudar a nuevos usuarios
- Organizar eventos
- Escribir blog posts

---

## ⚙️ Configuración del Entorno

### 1. Fork el Repositorio

```bash
# Ve a GitHub y haz click en "Fork"
https://github.com/inakat/inakat
```

### 2. Clonar tu Fork

```bash
git clone https://github.com/TU-USUARIO/inakat.git
cd inakat
```

### 3. Agregar Upstream

```bash
git remote add upstream https://github.com/inakat/inakat.git
git fetch upstream
```

### 4. Instalar Dependencias

```bash
npm install
```

### 5. Configurar Variables de Entorno

```bash
cp .env.example .env
# Editar .env con tus valores (el CLI de Prisma no lee .env.local)
```

### 6. Configurar Base de Datos

```bash
npx prisma generate
npx prisma db push   # NO migrate dev: el historial aún no tiene baseline
npx prisma db seed   # exige las 8 variables SEED_*_PASSWORD
```

### 7. Ejecutar en Desarrollo

```bash
npm run dev
```

---

## 🔄 Flujo de Trabajo

### 1. Mantener tu Fork Actualizado

```bash
# Fetch cambios de upstream
git fetch upstream

# Merge a tu main
git checkout main
git merge upstream/main

# Push a tu fork
git push origin main
```

### 2. Crear Branch para tu Feature

```bash
# Nombre descriptivo del branch
git checkout -b feature/nombre-descriptivo

# Ejemplos:
git checkout -b feature/add-email-notifications
git checkout -b fix/application-modal-bug
git checkout -b docs/improve-api-documentation
```

**Convención de Nombres:**
- `feature/` - Nueva funcionalidad
- `fix/` - Corrección de bugs
- `docs/` - Cambios en documentación
- `refactor/` - Refactorización de código
- `test/` - Agregar o modificar tests
- `style/` - Cambios de formato (no afectan funcionalidad)
- `perf/` - Mejoras de performance

### 3. Hacer tus Cambios

```bash
# Hacer commits frecuentes y atómicos.
# Revisa SIEMPRE qué estás agregando antes de commitear: si probaste subidas en
# local sin token de Blob, los archivos se guardaron en public/uploads (CV, INE,
# actas). Esa carpeta está ignorada, pero no uses `git add .` a ciegas.
git status
git add <archivos concretos>
git commit -m "feat: add email notification system"

# Push a tu fork
git push origin feature/nombre-descriptivo
```

### 4. Crear Pull Request

1. Ve a tu fork en GitHub
2. Click "Compare & pull request"
3. Completa el template
4. Espera review

---

## 📝 Estándares de Código

### TypeScript

```typescript
// ✅ BIEN: Tipos explícitos
interface JobData {
  title: string;
  salary: string;
  location: string;
}

const createJob = (data: JobData): Promise<Job> => {
  return prisma.job.create({ data });
};

// ❌ MAL: Any types
const createJob = (data: any): any => {
  return prisma.job.create({ data });
};
```

### React Components

```typescript
// ✅ BIEN: Functional components con tipos
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  label, 
  onClick, 
  disabled = false 
}) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};

// ❌ MAL: Sin tipos
export const Button = ({ label, onClick, disabled }) => {
  return <button>{label}</button>;
};
```

### Naming Conventions

**Archivos:**
```
PascalCase  → Components (Button.tsx, JobCard.tsx)
camelCase   → Utils (formatDate.ts, validateEmail.ts)
kebab-case  → CSS/Styles (button-styles.css)
```

**Variables:**
```typescript
// Constants: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Variables: camelCase
const userId = 123;
const isActive = true;

// Components: PascalCase
const JobList = () => { ... };

// Functions: camelCase
const fetchJobs = async () => { ... };
```

### Comentarios

```typescript
// ✅ BIEN: Comentarios útiles
// Calculate total salary including benefits and bonuses
const totalCompensation = baseSalary + benefits + bonus;

// ❌ MAL: Comentarios obvios
// Set x to 5
const x = 5;
```

### Imports

```typescript
// ✅ BIEN: Imports ordenados
import React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/common/Button';
import { formatDate } from '@/lib/utils';
import type { Job } from '@prisma/client';

// ❌ MAL: Imports desordenados
import { formatDate } from '@/lib/utils';
import React from 'react';
import type { Job } from '@prisma/client';
import { Button } from '@/components/common/Button';
```

---

## 💬 Commit Messages

Seguimos [Conventional Commits](https://www.conventionalcommits.org/).

### Formato

```
<tipo>[scope opcional]: <descripción>

[cuerpo opcional]

[footer(s) opcional(es)]
```

### Tipos

- `feat` - Nueva funcionalidad
- `fix` - Corrección de bug
- `docs` - Cambios en documentación
- `style` - Formato, sin cambios de código
- `refactor` - Refactorización
- `perf` - Mejoras de performance
- `test` - Agregar o corregir tests
- `build` - Cambios en build system
- `ci` - Cambios en CI
- `chore` - Otros cambios que no modifican src

### Ejemplos

**✅ Buenos Commits:**

```bash
feat: add email notification system

Implemented email notifications for job applications using SendGrid API.
Includes welcome emails, application confirmations, and status updates.

Closes #123

---

fix: resolve application modal not closing

Modal was not closing after successful submission due to state not updating.
Fixed by properly handling the success callback.

Fixes #456

---

docs: update API documentation

Added examples for all endpoints and improved error response documentation.

---

refactor: simplify job filtering logic

Extracted filtering logic into reusable hook for better maintainability.
```

**❌ Malos Commits:**

```bash
# Muy vago
fix: bug fix

# Sin tipo
added new feature

# Todo en mayúsculas
FIX: FIXED BUG IN LOGIN

# Muy largo en primera línea
feat: add a really complex email notification system with multiple templates and scheduled sending
```

---

## 🔍 Pull Requests

### Antes de Crear PR

**Checklist:**
- [ ] Código sigue los estándares del proyecto
- [ ] Tests agregados/actualizados
- [ ] Build pasa sin errores (`npm run build`)
- [ ] Lint pasa sin errores (`npm run lint`)
- [ ] Documentación actualizada si es necesario
- [ ] Commits siguen convención
- [ ] Branch actualizado con main

### Template de PR

```markdown
## Descripción

Breve descripción de los cambios.

## Tipo de Cambio

- [ ] Bug fix
- [ ] Nueva feature
- [ ] Breaking change
- [ ] Documentación

## ¿Cómo se probó?

Describe las pruebas que realizaste.

## Screenshots (si aplica)

Agrega screenshots de cambios de UI.

## Checklist

- [ ] Mi código sigue los estándares del proyecto
- [ ] Realicé self-review de mi código
- [ ] Agregué comentarios donde necesario
- [ ] Actualicé documentación
- [ ] Mis cambios no generan warnings
- [ ] Agregué tests
- [ ] Tests existentes pasan

## Issues Relacionados

Closes #123
Fixes #456
```

### Proceso de Review

1. **Asignación automática** de reviewers
2. **Review inicial** (1-3 días)
3. **Cambios solicitados** (si necesario)
4. **Aprobación** (2 reviewers requeridos)
5. **Merge** (squash and merge)

### Después del Merge

```bash
# Actualizar tu main local
git checkout main
git pull upstream main

# Borrar branch
git branch -d feature/nombre-descriptivo
git push origin --delete feature/nombre-descriptivo
```

---

## 🐛 Reportar Bugs

### Antes de Reportar

1. **Busca** en issues existentes
2. **Actualiza** a la última versión
3. **Verifica** que no sea configuración local

### Template de Bug Report

```markdown
## Descripción del Bug

Descripción clara y concisa del bug.

## Pasos para Reproducir

1. Ve a '...'
2. Click en '...'
3. Scroll hasta '...'
4. Ver error

## Comportamiento Esperado

Qué esperabas que sucediera.

## Comportamiento Actual

Qué sucedió en realidad.

## Screenshots

Si aplica, agrega screenshots.

## Ambiente

- OS: [e.g. Windows 11, macOS 13]
- Browser: [e.g. Chrome 120, Safari 17]
- Node: [e.g. 18.17.0]
- npm: [e.g. 9.8.1]

## Información Adicional

Cualquier otra información relevante.

## Logs

```
Pega logs relevantes aquí
```
```

---

## ✨ Sugerir Features

### Template de Feature Request

```markdown
## Problema que Resuelve

Descripción clara del problema.

## Solución Propuesta

Cómo resolverías el problema.

## Alternativas Consideradas

Otras soluciones que consideraste.

## Información Adicional

Contexto adicional o screenshots.
```

---

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests específicos
npm test -- JobCard.test.tsx

# Con coverage
npm run test:coverage

# Watch mode
npm test -- --watch
```

### Escribir Tests

```typescript
// JobCard.test.tsx
import { render, screen } from '@testing-library/react';
import { JobCard } from './JobCard';

describe('JobCard', () => {
  it('renders job title', () => {
    const job = {
      id: 1,
      title: 'Software Engineer',
      company: 'Tech Corp',
      location: 'Remote'
    };

    render(<JobCard job={job} />);
    
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
  });
});
```

---

## 📚 Recursos

### Documentación
- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [Prisma Docs](https://www.prisma.io/docs)
- [TypeScript Docs](https://www.typescriptlang.org/docs)

### Guías
- [Conventional Commits](https://www.conventionalcommits.org/)
- [How to Write a Git Commit Message](https://chris.beams.io/posts/git-commit/)
- [Semantic Versioning](https://semver.org/)

---

## 💬 Comunicación

### Canales

**GitHub:**
- 🐛 Issues: Bugs y feature requests
- 💬 Discussions: Preguntas generales
- 📋 Projects: Planificación

**Discord:**
- 💬 General chat
- 🆘 Help channel
- 👨‍💻 Dev chat
- Join: https://discord.gg/inakat

**Email:**
- 📧 General: info@inakat.com
- 📧 Security: security@inakat.com
- 📧 Conduct: conduct@inakat.com

---

## 🎉 Primeras Contribuciones

### Good First Issues

Busca issues con label `good first issue`:
```
https://github.com/inakat/inakat/labels/good%20first%20issue
```

### Mentorship

¿Primera vez contribuyendo a open source? ¡No hay problema!

- Pide ayuda en Discord
- Pregunta en el issue
- Menciona que es tu primera contribución

---

## 🏆 Reconocimiento

Todos los contribuidores aparecen en:
- [CONTRIBUTORS.md](./CONTRIBUTORS.md)
- Release notes
- README (top contributors)

---

## ❓ Preguntas

¿Tienes preguntas? Pregunta en:
- 💬 Discord: https://discord.gg/inakat
- 📧 Email: dev@inakat.com
- 💬 GitHub Discussions

---

## 📄 Licencia

Al contribuir, aceptas que tus contribuciones serán licenciadas bajo la misma licencia que el proyecto (MIT).

---

**¡Gracias por contribuir a INAKAT!** 🎉

Cada contribución, sin importar el tamaño, hace que INAKAT sea mejor para todos.
