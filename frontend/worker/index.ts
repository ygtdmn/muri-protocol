// The Worker in front of the static site: /api/relay/* goes to the Relay proxy, everything else
// is served from the built assets (cloudflare.config.ts).
import { handleRelay } from "../api/relay.ts";

export default {
	async fetch(request, env) {
		const { pathname } = new URL(request.url);
		if (pathname === "/api/relay" || pathname.startsWith("/api/relay/")) {
			return handleRelay(request, { apiKey: env.RELAY_API_KEY });
		}
		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;
