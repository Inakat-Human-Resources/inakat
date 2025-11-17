# 🚀 INAKAT - Plataforma de Reclutamiento

**INAKAT** es una plataforma moderna de reclutamiento que conecta empresas con talento calificado en México. Combina evaluación humana (psicólogos y especialistas técnicos) con soporte de IA para ofrecer procesos de selección de alta calidad.

---

## ✨ Características Principales

### 👥 Para Candidatos

- ✅ Búsqueda avanzada de vacantes
- ✅ Filtros por ubicación, tipo de trabajo y más
- ✅ Aplicación rápida con CV y carta de presentación
- ✅ Seguimiento del estado de aplicaciones
- ✅ Sistema de favoritos (próximamente)

### 🏢 Para Empresas

- ✅ Registro y aprobación de empresas
- ✅ Publicación de vacantes
- ✅ Gestión de aplicaciones
- ✅ Panel de control con métricas
- ✅ Upload de documentos legales

### 👨‍💼 Para Administradores

- ✅ Gestión de solicitudes de empresas
- ✅ Aprobación/rechazo de empresas
- ✅ Vista completa de todas las aplicaciones
- ✅ Dashboard con estadísticas en tiempo real
- ✅ Gestión de vacantes

---

## 🛠️ Stack Tecnológico

### Frontend

- **Next.js 14** - Framework React con App Router
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos utility-first
- **React Hooks** - Gestión de estado

### Backend

- **Next.js API Routes** - Endpoints RESTful
- **Prisma ORM** - Base de datos
- **PostgreSQL** - Base de datos (Supabase)
- **JWT** - Autenticación con jose
- **bcryptjs** - Hash de contraseñas

### Infraestructura

- **Vercel** - Hosting y deployment
- **Vercel Blob** - Almacenamiento de archivos
- **Supabase** - Base de datos PostgreSQL
- **GitHub** - Control de versiones

---

## 📁 Estructura del Proyecto

```
inakat/
├── src/
│   ├── app/                          # App Router de Next.js
│   │   ├── api/                      # API Routes
│   │   │   ├── applications/         # Endpoints de aplicaciones
│   │   │   ├── auth/                 # Autenticación
│   │   │   ├── companies/            # Gestión de empresas
│   │   │   ├── jobs/                 # Gestión de vacantes
│   │   │   └── upload/               # Upload de archivos
│   │   ├── admin/                    # Panel de administración
│   │   ├── applications/             # Vista de aplicaciones
│   │   ├── companies/                # Registro de empresas
│   │   ├── create-job/               # Crear vacantes
│   │   ├── login/                    # Login
│   │   └── talents/                  # Búsqueda de vacantes
│   │
│   ├── components/                   # Componentes React
│   │   ├── common/                   # Componentes reutilizables
│   │   └── sections/                 # Secciones por página
│   │       ├── admin/                # Componentes admin
│   │       ├── applications/         # Componentes de aplicaciones
│   │       ├── companies/            # Componentes de empresas
│   │       ├── jobs/                 # Componentes de vacantes
│   │       └── talents/              # Componentes de búsqueda
│   │
│   ├── lib/                          # Utilidades y configuración
│   │   ├── prisma.ts                 # Cliente de Prisma
│   │   └── auth.ts                   # Utilidades de autenticación
│   │
│   └── middleware.ts                 # Middleware de Next.js
│
├── prisma/                           # Configuración de base de datos
│   ├── schema.prisma                 # Esquema de la BD
│   ├── migrations/                   # Migraciones
│   └── seed.ts                       # Datos de ejemplo
│
├── public/                           # Archivos estáticos
│   └── images/                       # Imágenes
│
├── .env.local                        # Variables de entorno
├── next.config.js                    # Configuración de Next.js
├── tailwind.config.ts                # Configuración de Tailwind
├── tsconfig.json                     # Configuración de TypeScript
└── package.json                      # Dependencias
```

---

## 🚀 Inicio Rápido

### Prerequisitos

- Node.js 18+
- npm o yarn
- Cuenta de Supabase (base de datos)
- Cuenta de Vercel (deployment)

### Instalación

1. **Clonar el repositorio**

```bash
git clone https://github.com/tu-usuario/inakat.git
cd inakat
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar variables de entorno**

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales (ver [Variables de Entorno](#variables-de-entorno))

4. **Configurar base de datos**

```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

5. **Ejecutar en desarrollo**

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## 🔐 Variables de Entorno

Crea un archivo `.env.local` con las siguientes variables:

```env
# Base de datos (Supabase)
DATABASE_URL="postgresql://..."          # Connection pooling
DIRECT_URL="postgresql://..."           # Direct connection

# Autenticación
JWT_SECRET="tu-secret-key-super-seguro-y-largo"

# Upload de archivos (Vercel Blob)
BLOB_READ_WRITE_TOKEN="vercel_blob_..."

# Admin por defecto
ADMIN_EMAIL="admin@inakat.com"
ADMIN_PASSWORD="AdminInakat2024!"
ADMIN_NOMBRE="Administrador"

# Next.js
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Ver [Guía de Variables de Entorno](./docs/ENVIRONMENT_VARIABLES.md) para más detalles.

---

## 📖 Documentación

- 📘 [Guía de Instalación](./docs/INSTALLATION.md)
- 👥 [Guía de Usuario](./docs/USER_GUIDE.md)
- 🔌 [Documentación de API](./docs/API.md)
- 🐛 [Troubleshooting](./docs/TROUBLESHOOTING.md)
- 🚀 [Guía de Deploy](./docs/DEPLOYMENT.md)

---

## 🗄️ Modelo de Datos

### Entidades Principales

**User** - Usuarios del sistema (admin, empresas, talentos)
**CompanyRequest** - Solicitudes de registro de empresas
**Job** - Vacantes publicadas
**Application** - Aplicaciones de candidatos a vacantes
**ContactMessage** - Mensajes de contacto

Ver [schema.prisma](./prisma/schema.prisma) para detalles completos.

---

## 🔒 Seguridad

- ✅ Contraseñas hasheadas con bcrypt (10 rounds)
- ✅ Autenticación JWT con tokens seguros
- ✅ Middleware de protección de rutas
- ✅ Validación de inputs con Zod
- ✅ Sanitización de archivos subidos
- ✅ CORS configurado
- ✅ Rate limiting (en progreso)

---

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Tests con coverage
npm run test:coverage

# Tests E2E
npm run test:e2e
```

---

## 📦 Scripts Disponibles

```bash
npm run dev          # Desarrollo
npm run build        # Build de producción
npm run start        # Servidor de producción
npm run lint         # Linter
npm run type-check   # Verificar tipos
npm run db:push      # Push schema a BD
npm run db:seed      # Poblar BD con datos
npm run db:studio    # Abrir Prisma Studio
```

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea tu rama (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto está bajo la Licencia MIT - ver [LICENSE](LICENSE) para detalles.

---

## 👥 Equipo

- **Guillermo Sánchez** - Desarrollo Full Stack
- **INAKAT Team** - Product & Design

---

## 📧 Contacto

- Website: [www.inakat.com](https://www.inakat.com)
- Email: contacto@inakat.com
- LinkedIn: [INAKAT](https://linkedin.com/company/inakat)

---

## 🙏 Agradecimientos

- Next.js team por el excelente framework
- Vercel por el hosting
- Supabase por la base de datos
- Comunidad open source

---

## 📊 Estado del Proyecto

- ✅ Sistema de autenticación
- ✅ Gestión de empresas
- ✅ Publicación de vacantes
- ✅ Sistema de aplicaciones
- ✅ Panel de administración
- 🚧 Notificaciones por email (en progreso)
- 🚧 Panel para empresas (en progreso)
- 📋 Sistema de mensajería (planificado)
- 📋 Calendario de entrevistas (planificado)

---

## 🎯 Roadmap 2025

### Q1 2025

- [ ] Sistema completo de notificaciones
- [ ] Panel avanzado para empresas
- [ ] Chat en tiempo real
- [ ] Mobile app (React Native)

### Q2 2025

- [ ] IA para matching de candidatos
- [ ] Video entrevistas integradas
- [ ] Sistema de referidos
- [ ] Integraciones con LinkedIn

---

## 📈 Métricas

- **Líneas de código:** ~15,000
- **Componentes:** 50+
- **API Endpoints:** 25+
- **Modelos de datos:** 5
- **Tests:** En desarrollo

---

**Made with ❤️ in México**

🏢 USUARIOS EMPRESARIALES EN TU SEED

1. TechSolutions México

Email: contact@techsolutions.mx
Password: Company123!
Role: company
Tiene: 6 vacantes tech

2. Creative Digital Studio

Email: rh@creativedigital.mx
Password: Company123!
Role: company
Tiene: 6 vacantes diseño/marketing

3. Grupo Financiero Nacional

Email: hr@grupofinanciero.mx
Password: Company123!
Role: company
Tiene: 6 vacantes negocios/finanzas
