import type { NextConfig } from "next";

/**
 * CABECERAS DE SEGURIDAD
 * ======================
 * La CSP está construida sobre los recursos que esta aplicación usa de
 * verdad, no copiada de una plantilla. Si agregas un origen externo (un CDN,
 * analítica, un embed), hay que declararlo aquí o el navegador lo bloqueará
 * en silencio.
 *
 * Inventario real de recursos (verificado en el build):
 *   · scripts  → solo los bundles de Next, mismo origen
 *   · estilos  → Tailwind compilado, mismo origen + estilos inline de Next
 *   · fuentes  → Inter auto-hospedada por `next/font` (no pega a Google)
 *   · imágenes → favicon y SVGs locales
 *   · red      → la API de Supabase (auth + REST) y el propio /api
 */
const isDev = process.env.NODE_ENV === "development";

/**
 * Origen de Supabase para `connect-src`. Se toma de la variable de entorno en
 * tiempo de build en vez de hardcodear el proyecto: así dev, preview y
 * producción declaran cada uno el suyo.
 */
function supabaseOrigin(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  try {
    const { origin, host } = new URL(url);
    // wss: lo necesita Supabase Realtime. No se usa hoy; se declara para que
    // activarlo no obligue a tocar la CSP y caer en la tentación de aflojarla.
    return `${origin} wss://${host}`;
  } catch {
    return "";
  }
}

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' es necesario para los scripts de arranque e hidratación
  // que Next inyecta. La alternativa es una CSP con nonce, que obliga a
  // renderizado dinámico en todas las rutas — ver SECURITY-AUDIT.md #18 para
  // el camino de mejora. 'unsafe-eval' SOLO en desarrollo (React Refresh).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Tailwind emite una hoja de estilos, pero Next inserta CSS crítico inline.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  // next/font auto-hospeda Inter: no hace falta fonts.gstatic.com.
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin()}`.trim(),
  // La app no embebe nada de terceros ni usa Flash/applets.
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Anti-clickjacking. Sustituye a X-Frame-Options, que es el equivalente viejo.
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  // En desarrollo rompería http://localhost.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Impide que el navegador adivine el tipo MIME (defensa contra XSS por
  // contenido subido que se sirve con el tipo equivocado).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No filtrar la ruta interna (que puede llevar IDs) a sitios externos.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Denegar por defecto las APIs del navegador que la app no usa.
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "usb=()",
      "xr-spatial-tracking=()",
    ].join(", "),
  },
  // Redundante con frame-ancestors, pero cubre navegadores viejos.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Aísla el origen de recursos de otros sitios.
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

/**
 * HSTS solo en producción. Vercel ya sirve HTTPS y redirige HTTP→HTTPS, así
 * que activarlo es seguro. NO se incluye `preload`: entrar a la lista de
 * precarga de los navegadores es prácticamente irreversible y debe ser una
 * decisión explícita, no un efecto secundario de esta configuración.
 */
const hsts = {
  key: "Strict-Transport-Security",
  value: "max-age=63072000; includeSubDomains",
};

const nextConfig: NextConfig = {
  // `X-Powered-By: Next.js` revela el framework y su presencia sin ninguna
  // ventaja. Divulgación de información innecesaria.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: isDev ? securityHeaders : [...securityHeaders, hsts],
      },
      {
        // Las respuestas de la API nunca deben quedar en caché de navegador
        // ni de CDN: llevan datos por usuario.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
