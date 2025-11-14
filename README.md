# Inakat Landing Page

Professional talent solutions platform built with Next.js 15.5.5, TypeScript, Prisma, and PostgreSQL.

## 🚀 Tech Stack

### Frontend
- **Next.js 15.5.5** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **Lucide React** - Modern icon library
- **Class Variance Authority** - Component variants
- **clsx & tailwind-merge** - Utility for className management

### Backend
- **Prisma** - Next-generation ORM
- **PostgreSQL** - Relational database
- **Next.js API Routes** - Serverless API endpoints

## 📦 Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your PostgreSQL database URL:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/inakat_db"
   ```

3. **Set up the database**
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🗄️ Database Setup

You can use either a local PostgreSQL installation or a cloud database service:

### Cloud Database (Recommended for production)
- [Supabase](https://supabase.com) - Free tier available
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Neon](https://neon.tech) - Free tier available
- [Railway](https://railway.app)

After setting up, update the `DATABASE_URL` in your `.env` file.

## 🛠️ Available Scripts

```bash
# Development
npm run dev          # Start development server

# Production
npm run build        # Build for production
npm start            # Start production server

# Database
npx prisma studio    # Open Prisma Studio (database GUI)
npx prisma migrate dev    # Create and run migrations
npx prisma generate  # Generate Prisma Client

# Code Quality
npm run lint         # Run ESLint
```

## 📁 Project Structure

```
inakat/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── contact/       # Contact form endpoint
│   │   │   └── company-requests/ # Company registration endpoint
│   │   ├── (routes)/          # Page routes
│   │   └── layout.tsx         # Root layout
│   ├── components/
│   │   ├── commons/           # Shared components
│   │   └── sections/          # Page sections
│   ├── lib/
│   │   ├── utils.ts           # Utility functions
│   │   └── prisma.ts          # Prisma client
│   └── assets/                # Images and static files
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
└── tailwind.config.ts         # Tailwind configuration
```

## 🔌 API Endpoints

### Contact Form
```bash
POST /api/contact
Content-Type: application/json

{
  "nombre": "John Doe",
  "email": "john@example.com",
  "telefono": "+52 123 456 7890",
  "mensaje": "Message text"
}
```

### Company Registration
```bash
POST /api/company-requests
Content-Type: application/json

{
  "nombre": "John",
  "apellidoPaterno": "Doe",
  "apellidoMaterno": "Smith",
  "nombreEmpresa": "Tech Corp",
  "correoEmpresa": "contact@techcorp.com",
  "razonSocial": "Tech Corporation S.A. de C.V.",
  "rfc": "TEC123456ABC",
  "direccionEmpresa": "123 Main St, CDMX"
}
```

### Get Company Requests (Admin)
```bash
GET /api/company-requests
GET /api/company-requests?status=pending
```

## 📝 Migration Status

This project has been migrated from Create React App to Next.js 15.5.5.

### ✅ Completed
- Next.js 15.5.5 setup with App Router
- TypeScript configuration
- Prisma + PostgreSQL backend
- API routes (contact, company requests)
- Core components (Navbar, Footer, ContactForm)
- Example sections (HeroHomeSection)
- All requested dependencies installed

### 📋 Remaining
See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for:
- Components still to migrate
- Step-by-step migration patterns
- Icon replacement guide
- Form integration examples

## 🎨 Custom Tailwind Colors

Brand colors are configured in `tailwind.config.ts`:
- `button-green`: #9fbb2f
- `button-orange`: #f48602
- `button-dark-green`: #2b5d62
- `custom-beige`: #e8e7d4
- And more...

## 🚀 Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add `DATABASE_URL` environment variable
4. Deploy

### Environment Variables
```env
DATABASE_URL="your-postgresql-url"
NODE_ENV="production"
```

## 📚 Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Migration Guide](./MIGRATION_GUIDE.md)

## 🐛 Troubleshooting

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for common issues and solutions.

---

Built with ❤️ using Next.js, TypeScript, and Prisma
