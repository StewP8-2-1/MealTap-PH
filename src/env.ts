import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Typed, validated environment variables. Import `env` from here instead of
 * reading `process.env` directly.
 *
 * Every key is optional until the stage that first needs it makes it required:
 *   Stage 2  DATABASE_URL, DATABASE_URL_UNPOOLED
 *   Stage 4  AI_GATEWAY_API_KEY
 *   Stage 5  BLOB_READ_WRITE_TOKEN, CRON_SECRET
 *   Stage 9  BETTER_AUTH_SECRET, BETTER_AUTH_URL,
 *            VERCEL_APP_CLIENT_ID, VERCEL_APP_CLIENT_SECRET
 * Keep `.env.example` in sync with this file.
 */
export const env = createEnv({
  server: {
    // Neon Postgres (set by the Vercel ↔ Neon integration)
    DATABASE_URL: z.url().optional(),
    DATABASE_URL_UNPOOLED: z.url().optional(),
    // Vercel AI Gateway
    AI_GATEWAY_API_KEY: z.string().min(1).optional(),
    // Vercel Blob
    BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
    // Shared secret that Vercel Cron sends as `Authorization: Bearer …`
    CRON_SECRET: z.string().min(16).optional(),
    // Better Auth + Sign in with Vercel
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    BETTER_AUTH_URL: z.url().optional(),
    VERCEL_APP_CLIENT_ID: z.string().min(1).optional(),
    VERCEL_APP_CLIENT_SECRET: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.url().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});
