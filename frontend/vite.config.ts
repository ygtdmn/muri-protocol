import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { HEAD_END, HEAD_START, PAGES, SITE_URL, renderHead } from "./src/lib/seo.ts";
import type { PageMeta } from "./src/lib/seo.ts";
import { handleRelay } from "./api/relay.ts";

/**
 * Writes each page's title, description and share tags into its own HTML file (mint.html,
 * terms.html, 404.html…), because link preview crawlers read the HTML and never run the app.
 * Vercel serves them by clean URL (vercel.json). Also writes sitemap.xml and robots.txt.
 */
function pageMeta(): Plugin {
	const block = new RegExp(`${HEAD_START}[\\s\\S]*?${HEAD_END}`);
	return {
		name: "muri-page-meta",
		// After Vite has put index.html in the bundle.
		enforce: "post",
		transformIndexHtml: (html) => html.replace("<!--page-meta-->", renderHead(PAGES.home)),
		generateBundle(_, bundle) {
			const index = bundle["index.html"];
			if (index?.type !== "asset") return;
			const html = String(index.source);
			for (const page of Object.values(PAGES)) {
				if (page.path === "/") continue;
				this.emitFile({ type: "asset", fileName: `${page.path.slice(1)}.html`, source: html.replace(block, renderHead(page)) });
			}
			const urls = (Object.values(PAGES) as PageMeta[])
				.filter((p) => !p.hidden)
				.map((p) => `\t<url><loc>${SITE_URL}${p.path}</loc></url>`)
				.join("\n");
			this.emitFile({
				type: "asset",
				fileName: "sitemap.xml",
				source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
			});
			this.emitFile({
				type: "asset",
				fileName: "robots.txt",
				source: `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
			});
		},
	};
}

/**
 * Serves /api/relay/* in dev through the same handler Vercel runs in production (api/relay.ts),
 * so the allowlist, origin check and quote filtering behave identically.
 */
function relayProxy(apiKey: string | undefined): Plugin {
	return {
		name: "muri-relay-proxy",
		configureServer(server) {
			server.middlewares.use("/api/relay", async (req, res) => {
				try {
					// The handler reads the key from process.env, as on Vercel.
					if (apiKey) process.env.RELAY_API_KEY = apiKey;
					const chunks: Buffer[] = [];
					for await (const chunk of req) chunks.push(chunk as Buffer);
					const headers = new Headers();
					for (const [key, value] of Object.entries(req.headers)) {
						if (typeof value === "string") headers.set(key, value);
					}
					const host = req.headers.host ?? "localhost";
					const request = new Request(`http://${host}/api/relay${req.url ?? ""}`, {
						method: req.method,
						headers,
						body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
					});
					const response = await handleRelay(request);
					res.statusCode = response.status;
					response.headers.forEach((value, key) => res.setHeader(key, value));
					res.end(Buffer.from(await response.arrayBuffer()));
				} catch (error) {
					res.statusCode = 502;
					res.end(JSON.stringify({ message: error instanceof Error ? error.message : "Relay proxy failed" }));
				}
			});
		},
	};
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	// Not VITE_-prefixed, so it never reaches the client bundle.
	const relayApiKey = loadEnv(mode, process.cwd(), "").RELAY_API_KEY;

	return {
		plugins: [react(), tailwindcss(), pageMeta(), relayProxy(relayApiKey)],
	};
});
