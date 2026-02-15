import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		AUTH_SECRET: z.string(), // # Added by `npx auth secret`. Read more: https://cli.authjs.dev
		HMAC_SECRET_KEY: z.string().default("some-secret"),
		AUTH_URL: z.string(),
	},
	client: {
		NEXT_PUBLIC_APP_ID: z.string().optional(),
	},
	runtimeEnv: {
		NEXT_PUBLIC_APP_ID: process.env.NEXT_PUBLIC_APP_ID,
		AUTH_SECRET: process.env.AUTH_SECRET,
		HMAC_SECRET_KEY: process.env.HMAC_SECRET_KEY,
		AUTH_URL: process.env.AUTH_URL,
	},
});
