import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/**
 * Dev-only bridge so `/api/*` Vercel Serverless Functions work during `npm run dev`.
 */
function localVercelApiBridge() {
  return {
    name: 'local-vercel-api-bridge',
    configureServer(server) {
      const syncLocalEnv = () => {
        const env = loadEnv(server.config.mode, process.cwd(), '');
        for (const [k, v] of Object.entries(env)) {
          process.env[k] = v;
        }
      };
      syncLocalEnv();

      const devSessionCacheFile = path.resolve(
        process.cwd(),
        'node_modules',
        '.vite',
        'dev-auth-session.json'
      );
      let devSharedSession = null;
      let devSharedProStatus = null;
      try {
        if (fs.existsSync(devSessionCacheFile)) {
          const cached = JSON.parse(fs.readFileSync(devSessionCacheFile, 'utf8'));
          if (cached && typeof cached === 'object' && 'session' in cached) {
            devSharedSession = cached.session || null;
            devSharedProStatus = cached.proStatus || null;
          } else if (cached?.access_token) {
            devSharedSession = cached;
          }
        }
      } catch {
        devSharedSession = null;
        devSharedProStatus = null;
      }

      server.middlewares.use('/api', async (req, res, next) => {
        const cleanRoute = String(req.url || '').split('?')[0].replace(/^\/+/, '');
        if (cleanRoute === '__dev-session') {
          if (req.method === 'POST') {
            try {
              const chunks = [];
              for await (const chunk of req) chunks.push(chunk);
              const raw = Buffer.concat(chunks).toString('utf8');
              const body = raw ? JSON.parse(raw) : {};
              devSharedSession = body?.session || null;
              if ('proStatus' in body) {
                devSharedProStatus = body.proStatus || null;
              } else if (!devSharedSession) {
                devSharedProStatus = null;
              }
              try {
                fs.mkdirSync(path.dirname(devSessionCacheFile), { recursive: true });
                fs.writeFileSync(
                  devSessionCacheFile,
                  JSON.stringify({ session: devSharedSession, proStatus: devSharedProStatus })
                );
              } catch {
                // Ignore local cache write errors
              }
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  ok: true,
                  session: devSharedSession,
                  proStatus: devSharedProStatus,
                })
              );
              return;
            } catch (err) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'Invalid session payload' }));
              return;
            }
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ session: devSharedSession, proStatus: devSharedProStatus }));
          return;
        }
        if (!cleanRoute || cleanRoute.startsWith('_') || cleanRoute.includes('/')) {
          return next();
        }
        const targetFile = path.resolve(process.cwd(), 'api', `${cleanRoute}.js`);
        if (!fs.existsSync(targetFile)) {
          return next();
        }

        try {
          // Pick up edits made to .env.local without requiring a dev server restart
          syncLocalEnv();
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString('utf8');
          req.body = raw ? JSON.parse(raw) : {};

          if (!req.headers?.authorization && devSharedSession?.access_token) {
            req.headers = {
              ...(req.headers || {}),
              authorization: `Bearer ${devSharedSession.access_token}`,
            };
          }

          const handlerUrl = pathToFileURL(targetFile).href;
          const { default: handler } = await import(`${handlerUrl}?t=${Date.now()}`);
          const expressLikeRes = {
            setHeader: (k, v) => res.setHeader(k, v),
            status: (code) => {
              res.statusCode = code;
              return expressLikeRes;
            },
            json: (payload) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(payload));
              return expressLikeRes;
            },
          };
          await handler(req, expressLikeRes);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Local API bridge error' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localVercelApiBridge()],
});
