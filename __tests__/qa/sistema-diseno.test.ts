/**
 * RUTA: __tests__/qa/sistema-diseno.test.ts
 *
 * Contrato del sistema de diseño (septiembre 2026). Lo que NO se puede romper
 * mientras 13 agentes rehacen las páginas con él:
 *  - la paleta es una sola (tokens.ts ↔ site.css ↔ tailwind.config.ts) y los
 *    nombres viejos siguen vivos hasta que cada página se rehaga;
 *  - la serif se carga una vez, en el layout raíz;
 *  - la navegación por rol conserva TODOS los enlaces del Navbar antiguo;
 *  - el layout raíz sólo pinta la barra pública en rutas públicas y cada
 *    sección de la aplicación monta el AppShell;
 *  - el banco de pruebas (/diseno) no llega a producción ni al buscador, y
 *    tiene un envoltorio por cada página de la aplicación.
 */
import fs from 'fs';
import path from 'path';

import { marca, colores } from '@/components/ui/tokens';
import { NAV_POR_ROL, ROLES_APP, RUTAS_APP, esRutaApp, iniciales, inicioDeRol, itemActivo } from '@/lib/nav-app';
import { ESTADOS, etiquetaEstado, tonoEstado } from '@/components/ui/Badge';
import { APPLICATION_STATUSES } from '@/lib/application-status';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { patronARegExp } from '@/app/diseno/_banco/simulador';
import { FIXTURES } from '@/app/diseno/fixtures';
import { USUARIOS } from '@/app/diseno/fixtures/base';

const raiz = process.cwd();
const leer = (rel: string) => fs.readFileSync(path.join(raiz, rel), 'utf-8');
const existe = (rel: string) => fs.existsSync(path.join(raiz, rel));

// ============================================================
// Tokens
// ============================================================
describe('Tokens: una sola paleta', () => {
  it('site.css declara en :root los mismos seis colores que tokens.ts', () => {
    const css = leer('src/app/site.css');
    const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
    const nombres: Record<keyof typeof marca, string> = {
      ink: '--ink',
      teal: '--teal',
      lime: '--lime',
      orange: '--orange',
      sand: '--sand',
      paper: '--paper',
    };
    (Object.keys(nombres) as Array<keyof typeof marca>).forEach((k) => {
      expect(root).toContain(`${nombres[k]}: ${marca[k]};`);
    });
  });

  it('tailwind.config.ts expone los nombres semánticos y conserva los heredados', () => {
    const tw = leer('tailwind.config.ts');
    expect(tw).toContain("from \"./src/components/ui/tokens\"");
    expect(tw).toContain('...colores');
    // Heredados: las páginas los usan hasta que se rehagan.
    ['"button-orange"', '"title-dark"', '"custom-beige"', '"button-green"', '"soft-green"', '"text-black"'].forEach(
      (nombre) => expect(tw).toContain(nombre)
    );
    expect(tw).toMatch(/serif:\s*\['var\(--font-serif\)'/);
  });

  it('los derivados semánticos existen (texto atenuado, líneas, tintes)', () => {
    expect(colores.ink.muted).toBe('#5b6769');
    expect(colores.line.DEFAULT).toBe('#e4e2d6');
    expect(colores.line.strong).toBe('#7c8482');
    expect(colores.orange.DEFAULT).toBe(marca.orange);
  });

  it('ningún componente del sistema pone texto blanco sobre naranja (2.54:1)', () => {
    const dir = path.join(raiz, 'src/components/ui');
    fs.readdirSync(dir)
      .filter((f) => f.endsWith('.tsx'))
      .forEach((f) => {
        const c = fs.readFileSync(path.join(dir, f), 'utf-8');
        expect(c).not.toMatch(/bg-orange(?!-(tint|hover|dark))[^"'`]*text-white/);
        expect(c).not.toMatch(/text-white[^"'`]*bg-orange(?!-(tint|hover|dark))/);
      });
  });
});

// ============================================================
// Tipografía y layout raíz
// ============================================================
describe('Layout raíz', () => {
  const layout = leer('src/app/layout.tsx');

  it('carga Instrument Serif como --font-serif una sola vez (no en la portada)', () => {
    expect(layout).toContain('Instrument_Serif');
    expect(layout).toMatch(/variable:\s*"--font-serif"/);
    expect(layout).toContain('serif.variable');
    expect(leer('src/app/page.tsx')).not.toContain('Instrument_Serif');
  });

  it('importa site.css y app.css', () => {
    expect(layout).toContain('./site.css');
    expect(layout).toContain('./app.css');
  });

  it('pinta PublicNav y el body ya no reserva pt-14 para todas las rutas', () => {
    expect(layout).toContain('<PublicNav />');
    expect(layout).not.toMatch(/<body className="[^"]*pt-14/);
    expect(existe('src/components/commons/Navbar.tsx')).toBe(false);
  });

  it('--nav mide lo mismo en todos los anchos (56 px): la portada no lo corrige por ancho', () => {
    expect(leer('src/app/site.css')).toMatch(/--nav:\s*56px;/);
    expect(leer('src/app/home.css')).not.toMatch(/--nav:\s*\d+px/);
  });
});

// ============================================================
// Registro público: barra y pie compartidos
// ============================================================
describe('Registro público (site.css): barra y pie', () => {
  const css = leer('src/app/site.css');
  /** Cuerpo de la primera regla cuyo selector es exactamente `selector`. */
  const regla = (selector: string) => {
    const i = css.indexOf(`\n${selector} {`);
    return i < 0 ? '' : css.slice(i, css.indexOf('}', i));
  };

  it('el cristal de la barra vive en el pseudo-elemento, nunca en la barra (su cajón es fixed)', () => {
    expect(regla('.hm-nav')).not.toMatch(/backdrop-filter/);
    expect(regla('.hm-nav[data-scroll]::before')).toMatch(/backdrop-filter/);
  });

  it('las primitivas de texto no declaran margen (site.css va después de Tailwind y anularía mt-*)', () => {
    ['.hm-h2', '.hm-display', '.hm-lead'].forEach((sel) => {
      expect(regla(sel)).not.toBe('');
      expect(regla(sel)).not.toMatch(/margin/);
    });
  });

  it('la palabra del pie está quieta en reposo: el corte es un margen, no un transform', () => {
    // Sin JS / con movimiento reducido, un transform en reposo la haría pasar
    // por «sin revelar» en la sonda de cada página pública.
    const palabra = regla('.hm-pie__palabra');
    expect(palabra).toMatch(/margin:[^;]*-0\.19em/);
    expect(palabra).not.toMatch(/transform/);
    // Su subida sólo existe ligada al scroll y con movimiento permitido.
    const soporte = css.slice(css.indexOf('@supports (animation-timeline: view())'));
    expect(soporte).toContain('prefers-reduced-motion: no-preference');
    expect(soporte).toMatch(/\.hm-pie__palabra \{[^}]*animation: hm-pie-palabra/);
  });
});

// ============================================================
// Navegación por rol
// ============================================================
describe('Navegación por rol (src/lib/nav-app.ts)', () => {
  const hrefs = (rol: keyof typeof NAV_POR_ROL) => NAV_POR_ROL[rol].flatMap((g) => g.items.map((i) => i.href));

  // La lista de enlaces que tenía el menú del Navbar antiguo (escritorio + móvil).
  const ANTES: Record<string, string[]> = {
    admin: [
      '/admin', '/admin/assignments', '/admin/assign-candidates', '/admin/interviews', '/admin/direct-applications',
      '/admin/requests', '/admin/vendors', '/admin/credit-packages', '/admin/pricing',
      '/admin/candidates', '/admin/users', '/admin/specialties', '/admin/contact-messages',
      '/vendor/dashboard', '/profile', '/notifications',
    ],
    company: ['/company/dashboard', '/company/profile', '/company/interviews', '/company/integrations', '/credits/purchase', '/profile', '/notifications'],
    candidate: ['/candidate/applications', '/profile', '/notifications'],
    user: ['/my-applications', '/profile', '/notifications'],
    recruiter: ['/recruiter/dashboard', '/profile', '/notifications'],
    specialist: ['/specialist/dashboard', '/profile', '/notifications'],
    vendor: ['/vendor/dashboard', '/profile', '/notifications'],
  };

  it.each(Object.entries(ANTES))('%s conserva todos los enlaces del menú antiguo', (rol, lista) => {
    const actuales = hrefs(rol as keyof typeof NAV_POR_ROL);
    lista.forEach((href) => expect(actuales).toContain(href));
  });

  it('incluye «Mensajes de contacto» para el admin', () => {
    const item = NAV_POR_ROL.admin.flatMap((g) => g.items).find((i) => i.href === '/admin/contact-messages');
    expect(item?.etiqueta).toBe('Mensajes de contacto');
  });

  it('cada rol tiene su panel como destino de «Ir a mi panel», y está en su navegación', () => {
    ROLES_APP.forEach((rol) => {
      expect(hrefs(rol)).toContain(inicioDeRol(rol));
    });
  });

  it('el ítem activo es el prefijo más largo', () => {
    expect(itemActivo(NAV_POR_ROL.admin, '/admin/users')?.item.etiqueta).toBe('Usuarios');
    expect(itemActivo(NAV_POR_ROL.admin, '/admin')?.item.etiqueta).toBe('Vista general');
    // /applications no tiene enlace propio: marca la vista general, de la que cuelga.
    expect(itemActivo(NAV_POR_ROL.admin, '/applications')?.item.href).toBe('/admin');
    expect(itemActivo(NAV_POR_ROL.company, '/company/jobs/7/candidates')?.item.href).toBe('/company/dashboard');
    expect(itemActivo(NAV_POR_ROL.recruiter, '/recruiter/jobs/7')?.item.href).toBe('/recruiter/dashboard');
  });

  it('distingue rutas de aplicación de rutas públicas', () => {
    ['/admin', '/admin/users', '/company/dashboard', '/create-job', '/credits/purchase', '/profile', '/notifications', '/applications', '/diseno/vista/admin'].forEach(
      (r) => expect(esRutaApp(r)).toBe(true)
    );
    ['/', '/about', '/companies', '/talents', '/contact', '/login', '/register', '/unauthorized', '/profileX', '/administrar'].forEach(
      (r) => expect(esRutaApp(r)).toBe(false)
    );
  });

  it('las iniciales toleran nombres mal formados (UI-005)', () => {
    expect(iniciales('Ana ', 'ana@x.com')).toBe('AN');
    expect(iniciales('Juan  Carlos', null)).toBe('JC');
    expect(iniciales('   ', 'zoe@x.com')).toBe('ZO');
    expect(iniciales(null, null)).toBe('U');
  });
});

// ============================================================
// Layouts de sección
// ============================================================
describe('Layouts de sección', () => {
  const SECCIONES = RUTAS_APP.filter((r) => r !== '/diseno').map((r) => r.slice(1));

  it.each(SECCIONES)('src/app/%s/layout.tsx monta el AppShell', (seccion) => {
    const c = leer(`src/app/${seccion}/layout.tsx`);
    expect(c).toContain("from '@/components/ui/AppShell'");
    expect(c).toMatch(/<AppShell>\{children\}<\/AppShell>/);
  });

  it('el layout de /admin conserva force-dynamic', () => {
    expect(leer('src/app/admin/layout.tsx')).toMatch(/export const dynamic = 'force-dynamic'/);
  });

  it.each(['login', 'register', 'contact', 'forgot-password', 'reset-password', 'unauthorized'])(
    'el layout de /%s sigue siendo sólo de metadata (sin AppShell)',
    (seccion) => {
      expect(leer(`src/app/${seccion}/layout.tsx`)).not.toContain('AppShell');
    }
  );
});

// ============================================================
// Estados
// ============================================================
describe('StatusBadge cubre todos los estados de la aplicación', () => {
  it('cada estado de postulación tiene tono y etiqueta propios', () => {
    APPLICATION_STATUSES.forEach((s) => {
      expect(ESTADOS[s]).toBeDefined();
      expect(etiquetaEstado(s)).not.toBe(s);
    });
  });

  it.each([
    'active', 'paused', 'closed', 'draft', 'paid', 'failed', 'refunded', 'cancelled', 'confirmed', 'approved',
    'charged_back', 'in_process', 'available', 'hired', 'inactive',
  ])('%s está en el mapa', (s) => {
    expect(ESTADOS[s]).toBeDefined();
  });

  it('el contexto cambia la etiqueta y un estado desconocido cae a neutro', () => {
    expect(etiquetaEstado('active', 'vacante')).toBe('Activa');
    expect(etiquetaEstado('approved', 'solicitud')).toBe('Aprobada');
    expect(etiquetaEstado('pending', 'postulacion')).toBe('Por revisar');
    expect(tonoEstado('algo_raro')).toBe('neutro');
    expect(etiquetaEstado('algo_raro')).toBe('algo_raro');
  });
});

// ============================================================
// Banco de pruebas (/diseno)
// ============================================================
describe('Banco de pruebas /diseno', () => {
  it('responde notFound() en producción y no se indexa', () => {
    const c = leer('src/app/diseno/layout.tsx');
    expect(c).toMatch(/process\.env\.NODE_ENV === 'production'\) notFound\(\)/);
    expect(c).toMatch(/index:\s*false/);
  });

  it('robots lo excluye y el sitemap no lo anuncia', () => {
    const salida = robots();
    const regla = Array.isArray(salida.rules) ? salida.rules[0] : salida.rules;
    expect(([] as string[]).concat(regla?.disallow ?? [])).toContain('/diseno');
    expect(sitemap().some((e) => e.url.includes('/diseno'))).toBe(false);
  });

  /** Todas las páginas reales de la aplicación (fuera de /diseno). */
  function paginasDeApp(): string[] {
    const salida: string[] = [];
    const recorrer = (dir: string) => {
      fs.readdirSync(path.join(raiz, dir), { withFileTypes: true }).forEach((e) => {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) recorrer(rel);
        else if (e.name === 'page.tsx') salida.push(dir.replace('src/app', '') || '/');
      });
    };
    RUTAS_APP.filter((r) => r !== '/diseno').forEach((r) => recorrer(`src/app${r}`));
    return salida.sort();
  }

  it('hay un envoltorio en /diseno/vista por CADA página de la aplicación, con los mismos segmentos', () => {
    const paginas = paginasDeApp();
    expect(paginas.length).toBeGreaterThanOrEqual(28);
    paginas.forEach((ruta) => {
      const envoltorio = `src/app/diseno/vista${ruta}/page.tsx`;
      expect(existe(envoltorio)).toBe(true);
      if (ruta !== '/create-job') {
        // Pinta la página REAL (no una copia).
        expect(leer(envoltorio)).toContain(`from '@/app${ruta}/page'`);
      }
    });
  });

  it('el layout de /diseno/vista instala el simulador y el AppShell del rol', () => {
    const banco = leer('src/app/diseno/_banco/BancoVista.tsx');
    expect(banco).toContain('instalarSimulador()');
    expect(banco).toContain('<AppShell rolForzado={rol}');
    expect(leer('src/app/diseno/vista/layout.tsx')).toContain('<BancoVista>');
  });

  it('existen las nueve hojas de fixtures de bloque y el índice las junta', () => {
    const indice = leer('src/app/diseno/fixtures/index.ts');
    [
      'b1-admin-core', 'b2-admin-candidatos', 'b3-admin-operacion', 'b4-admin-catalogo', 'b5-empresa',
      'b6-vacante', 'b7-candidato', 'b8-staff', 'b9-modal-perfil',
    ].forEach((b) => {
      expect(existe(`src/app/diseno/fixtures/${b}.ts`)).toBe(true);
      expect(indice).toContain(`'./${b}'`);
    });
    // Los bloques van antes que las base: si repiten patrón, gana el bloque.
    expect(indice).toMatch(/\.\.\.b9, \.\.\.FIXTURES_BASE\]/);
  });

  it('el patrón con :param captura el tramo y no se sale de la ruta', () => {
    const re = patronARegExp('/api/admin/jobs/:id/pipeline');
    expect(re.exec('/api/admin/jobs/42/pipeline')?.groups?.id).toBe('42');
    expect(re.test('/api/admin/jobs/42/pipeline/extra')).toBe(false);
    expect(patronARegExp('/api/jobs').test('/api/jobs')).toBe(true);
    expect(patronARegExp('/api/jobs').test('/api/jobs/5')).toBe(false);
  });

  it('/api/auth/me responde con el rol del banco', () => {
    const me = FIXTURES.find((f) => f.patron === '/api/auth/me');
    expect(me).toBeDefined();
    const responder = me!.respuesta as (ctx: unknown) => { user: { role: string; nombre: string } };
    ROLES_APP.forEach((rol) => {
      const r = responder({ url: new URL('http://x/api/auth/me'), metodo: 'GET', cuerpo: undefined, rol, params: {} });
      expect(r.user.role).toBe(rol);
      expect(r.user.nombre).toBe(USUARIOS[rol].nombre);
    });
  });
});
