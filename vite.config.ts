import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Injeta uma Content-Security-Policy restritiva apenas no build de produção.
 * (No modo dev o Vite precisa de scripts inline para o HMR.)
 */
function securityHeaders(): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'"
  ].join('; ');
  return {
    name: 'gdg-security-headers',
    apply: 'build',
    transformIndexHtml(html: string): string {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />\n    <meta name="referrer" content="no-referrer" />`
      );
    }
  };
}

export default defineConfig({
  // Caminhos relativos permitem publicar tanto em / quanto em
  // https://<usuario>.github.io/<repositorio>/.
  base: './',
  plugins: [react(), securityHeaders()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    assetsInlineLimit: 8192,
    cssCodeSplit: false,
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Empacotamento em módulo único: todo o JS em um só bundle.
        inlineDynamicImports: true,
        entryFileNames: 'assets/general-da-guerra.[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]'
      }
    }
  },
  server: { port: 5173, strictPort: false },
  preview: { port: 4173 }
});
