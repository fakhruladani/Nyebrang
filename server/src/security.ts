import type { FastifyInstance } from "fastify";
import type { Config } from "./config.js";

/**
 * Game berbagi origin dengan Catatku (path /nyebrang). CSP membatasi connect-src HANYA ke path
 * API game, sehingga jika ada XSS di game, skrip tidak bisa fetch ke API Catatku.
 * (CSP mencocokkan path untuk request langsung; frame & object dimatikan.)
 */
export function registerSecurityHeaders(app: FastifyInstance, config: Config): void {
  const apiSrc = `${config.publicOrigin}${config.publicBase}api/`;
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${apiSrc}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");

  app.addHook("onSend", async (_req, reply) => {
    reply.header("Content-Security-Policy", csp);
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "same-origin");
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  });
}
