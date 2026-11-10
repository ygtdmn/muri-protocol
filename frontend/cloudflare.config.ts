import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
	worker: defineWorker({
		name: "muri-protocol",
		// Only the workers.dev URL for now. muri.yigitduman.com stays where it is until DNS moves.
		domains: [],
		workersDev: true,
		previewUrls: false,
		entrypoint: "./worker/index.ts",
		compatibilityDate: "2026-11-08",
		assets: {
			// /mint serves mint.html, /mint.html and /mint/ redirect to /mint (Vercel's cleanUrls).
			htmlHandling: "drop-trailing-slash",
			notFoundHandling: "404-page",
			runWorkerFirst: ["/api/*"],
		},
		observability: { enabled: true },
		env: {
			ASSETS: bindings.assets(),
			RELAY_API_KEY: bindings.secret(),
		},
	}),
});
