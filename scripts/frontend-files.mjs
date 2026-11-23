// The only files a browser may fetch. Config, tests, server code and data never appear here.
export const FRONTEND_FILES=new Set([
  '/index.html','/sw.js','/manifest.webmanifest',
  '/src/app.js','/src/management.js','/src/model.js','/src/business.js','/src/backup.js','/src/access.js','/src/admin.js',
  '/src/ownership.js','/src/catalog.js','/src/inventory-entry.js','/src/intake.js','/src/reminders.js','/src/commands.js','/src/api.js',
  '/src/style.css','/src/themes.js','/src/themes.css','/src/responsive.js','/src/responsive.css',
]);
export const ICON_PATTERN=/^\/icons\/[a-z0-9-]+\.(png|svg)$/;
export const CONTENT_TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
export const isFrontendPath=pathname=>FRONTEND_FILES.has(pathname)||ICON_PATTERN.test(pathname);
