# Migration Guide: CRA to Next.js 15.5.5

> ⚠️ **Documento histórico (migración de 2024).** No lo sigas para montar un
> entorno: usa `docs/INSTALLATION.md`. En particular, **no ejecutes
> `prisma migrate dev`** en este proyecto: sobre una base sincronizada con
> `db push` detecta *drift* y ofrece borrar el esquema (INFRA-013).

This guide will help you complete the migration from Create React App to Next.js with TypeScript.

## ✅ What's Already Done

### Project Setup
- ✅ Next.js 15.5.5 with App Router
- ✅ TypeScript configuration
- ✅ Tailwind CSS with custom colors
- ✅ All requested dependencies installed:
  - `@radix-ui/react-slot`
  - `class-variance-authority`
  - `clsx`
  - `framer-motion`
  - `lucide-react`
  - `tailwind-merge`

### Backend Setup (Prisma + PostgreSQL)
- ✅ Prisma initialized with PostgreSQL
- ✅ Database schema created (`CompanyRequest` and `ContactMessage` models)
- ✅ Database connection utility (`src/lib/prisma.ts`)
- ✅ API routes created:
  - `POST /api/contact` - Submit contact form
  - `POST /api/company-requests` - Submit company registration
  - `GET /api/company-requests` - Get all company requests (for admin)

### Migrated Components
- ✅ `Navbar.tsx` - Navigation with Next.js Link and usePathname
- ✅ `Footer.tsx` - Footer with lucide-react icons
- ✅ `SocialLinks.tsx` - Social media links
- ✅ `ContactForm.tsx` - Contact form with API integration
- ✅ `HeroHomeSection.tsx` - Home page hero section
- ✅ Main layout with Navbar

## 📋 Remaining Components to Migrate

You need to migrate the following components from `.js` to `.tsx`:

### Home Page Sections (`src/components/sections/home/`)
- `BusinessTalentSection.js` → `.tsx`
- `SpecialtiesSection.js` → `.tsx`
- `WhyInakatSection.js` → `.tsx`
- `MapContactSection.js` → `.tsx`
- `NewsletterSection.js` → `.tsx`

### About Page Sections (`src/components/sections/aboutus/`)
- `AboutUsSection.js` → `.tsx`
- `SpecialtiesSection.js` → `.tsx`
- `ExpertsSection.js` → `.tsx`
- `ContactInfoSection.js` → `.tsx`
- `OurCompromiseSection.js` → `.tsx`
- `LocationSection.js` → `.tsx`
- `SelectionProcessSection.js` → `.tsx`

### Companies Page Sections (`src/components/sections/companies/`)
- `FindProfessionalsSection.js` → `.tsx`
- `AreYouLookingNewTalentSection.js` → `.tsx`
- `RegisterForQuotationSection.js` → `.tsx`
- `SatisfiedCustomersSection.js` → `.tsx`
- `FormRegisterForQuotationSection.js` → `.tsx` (needs API integration)
- `AdvantagesSection.js` → `.tsx`

### Talents Page Sections (`src/components/sections/talents/`)
- `HeroTalentSection.js` → `.tsx`
- `SearchPositionsSection.js` → `.tsx`

### Admin Page
- `AdminCompanyRequests.js` → `.tsx` (needs API integration)
- `CompanyRequestTable.js` → `.tsx`

### Main Pages
- Update `src/app/about/page.tsx` to import About sections
- Update `src/app/companies/page.tsx` to import Companies sections
- Update `src/app/talents/page.tsx` to import Talents sections
- Update `src/app/contact/page.tsx` to import Contact sections
- Update `src/app/login/page.tsx`
- Update `src/app/admin/requests/page.tsx` to use API

## 🔄 Migration Pattern

Follow this pattern for each component:

### 1. File Structure
```typescript
"use client"; // Only if component uses hooks, interactivity, or browser APIs

import React from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { IconName } from "lucide-react";
```

### 2. Replace Imports

| Old (CRA) | New (Next.js) |
|-----------|---------------|
| `react-router-dom` | `next/navigation` |
| `useNavigate()` | `useRouter()` with `router.push()` |
| `useLocation()` | `usePathname()` |
| `<Link to="/path">` | `<Link href="/path">` from `next/link` |
| `<img src={}>` | `<Image src={} alt="" />` from `next/image` |
| `../../assets/` | `@/assets/` |
| `react-icons/fa` | `lucide-react` |

### 3. Icon Replacements

| react-icons | lucide-react |
|-------------|--------------|
| `FaFacebook` | `Facebook` |
| `FaLinkedin` | `Linkedin` |
| `FaInstagram` | `Instagram` |
| `FaWhatsapp` | `MessageCircle` |
| `FaArrowRight` | `ArrowRight` |
| `FaCheck` | `Check` |
| `FaTimes` | `X` |

### 4. Use the `cn()` Utility

```typescript
// Instead of:
className={`base-class ${condition ? 'active' : 'inactive'}`}

// Use:
className={cn("base-class", condition && "active", !condition && "inactive")}
```

### 5. Example Migration

**Before (CRA):**
```javascript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import image from '../../../assets/images/1-home/1.png';
import { FaArrowRight } from 'react-icons/fa';

const Component = () => {
    const navigate = useNavigate();

    return (
        <section>
            <img src={image} alt="Hero" />
            <button onClick={() => navigate('/about')}>
                Learn More <FaArrowRight />
            </button>
        </section>
    );
};

export default Component;
```

**After (Next.js):**
```typescript
"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import image from "@/assets/images/1-home/1.png";

const Component = () => {
  const router = useRouter();

  return (
    <section>
      <Image src={image} alt="Hero" />
      <button onClick={() => router.push("/about")}>
        Learn More <ArrowRight />
      </button>
    </section>
  );
};

export default Component;
```

## 🗄️ Database Setup

Before running the app with database features:

1. **Set up PostgreSQL database** (choose one):
   - Local PostgreSQL installation
   - [Supabase](https://supabase.com) (free tier available)
   - [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
   - [Neon](https://neon.tech) (free tier available)
   - [Railway](https://railway.app)

2. **Update `.env` file**:
   ```env
   DATABASE_URL="postgresql://username:password@host:5432/database_name"
   ```

3. **Run migrations**:
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

## 🔧 Forms with API Integration

### Contact Form Example
The `ContactForm.tsx` component shows how to integrate with the API:

```typescript
const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  const response = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  const data = await response.json();
  // Handle response
};
```

### Update `FormRegisterForQuotationSection`

Replace the placeholder endpoint:
```typescript
// Old:
const response = await fetch('TU_ENDPOINT_AQUI', {

// New:
const response = await fetch('/api/company-requests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nombre,
    apellidoPaterno,
    apellidoMaterno,
    nombreEmpresa,
    correoEmpresa,
    sitioWeb,
    razonSocial,
    rfc,
    direccionEmpresa,
    // Note: File uploads need separate handling (see below)
  }),
});
```

### File Upload Handling

For file uploads (identificacion, documentosConstitucion), you'll need to:
1. Set up file storage (e.g., AWS S3, Vercel Blob, Cloudinary)
2. Create upload API route
3. Update form to upload files first, then submit URLs

Example structure:
```typescript
// 1. Upload file
const formData = new FormData();
formData.append('file', file);

const uploadRes = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});

const { url } = await uploadRes.json();

// 2. Submit form with file URL
const response = await fetch('/api/company-requests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...otherData,
    identificacionUrl: url,
  }),
});
```

## 🚀 Running the Application

```bash
# Development
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint
```

Visit [http://localhost:3000](http://localhost:3000)

## 📝 Admin Panel Integration

Update `AdminCompanyRequests.tsx` to fetch from API:

```typescript
"use client";

import { useState, useEffect } from "react";
import CompanyRequestTable from "@/components/sections/admin/CompanyRequestTable";

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      const res = await fetch("/api/company-requests");
      const data = await res.json();
      setRequests(data.data);
      setLoading(false);
    };

    fetchRequests();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <main className="container mx-auto py-20">
      <h1 className="text-3xl font-bold mb-8">Company Requests</h1>
      <CompanyRequestTable requests={requests} />
    </main>
  );
}
```

## 🎨 Using Class Variance Authority (CVA)

For button variants and component styles:

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "rounded-full font-bold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-button-green text-white hover:bg-green-700",
        orange: "bg-button-orange text-white hover:bg-orange-700",
        dark: "bg-button-dark-green text-white hover:bg-green-900",
      },
      size: {
        default: "py-2 px-6",
        lg: "py-3 px-8",
        sm: "py-1 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// Usage:
<button className={buttonVariants({ variant: "orange", size: "lg" })}>
  Click me
</button>
```

## ✨ Using Framer Motion

For animations:

```typescript
"use client";

import { motion } from "framer-motion";

export default function AnimatedSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h1>Animated Content</h1>
    </motion.div>
  );
}
```

## 📦 Next Steps

1. Migrate remaining section components
2. Update all page files to import migrated components
3. Set up file upload handling for forms
4. Add authentication for admin panel (optional)
5. Set up environment variables for production
6. Deploy to Vercel or your preferred platform

## 🐛 Common Issues

### Images not loading
- Make sure to use `Image` from `next/image`
- Images in `src/assets` should be imported and used with the `src` prop

### "use client" directive
- Add `"use client"` at the top of files that use:
  - `useState`, `useEffect`, or other hooks
  - Event handlers
  - Browser APIs
  - `useRouter`, `usePathname`, `useSearchParams`

### TypeScript errors
- Run `npm run build` to see all TypeScript errors
- Add proper type annotations for props and state

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev)
- [Class Variance Authority](https://cva.style)
- [Framer Motion](https://www.framer.com/motion/)
