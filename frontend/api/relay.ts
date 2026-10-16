// Vercel function: forwards Relay API calls from the browser and adds the API key server-side.
// Relay asks integrators to keep the key out of client bundles and proxy browser traffic instead.
// https://docs.relay.link/references/api/api-keys#proxy-api
//
// Reached as /api/relay/<path> through the rewrite in vercel.json (a [...path] filename only
// catches nested paths in Next.js). The Vite dev server calls the same handler (vite.config.ts).

declare const process: { env: Record<string, string | undefined> };

const RELAY_API = "https://api.relay.link";
const SITE_HOST = "muri.yigitduman.com";

// Only what the SDK's swap-and-bridge flow calls, so the key can't be spent on anything else
// (notably not /execute, Relay's sponsored gasless endpoint).
const ALLOWED = /^\/(chains|currencies\/v2|quote\/v2|intents\/status(\/v[0-9]+)?|execute\/permits|transactions\/(index|single))$/;

// Quote fields that would spend the key's sponsorship or route fees elsewhere. Users pay their own way.
const STRIPPED_QUOTE_FIELDS = [
	"appFees",
	"subsidizeFees",
	"subsidizeRent",
	"maxSubsidizationAmount",
	"sponsoredFeeComponents",
	"depositFeePayer",
];

/** This site, its Vercel previews, and local dev. */
function allowedOrigin(origin: string) {
	try {
		const { hostname } = new URL(origin);
		return (
			hostname === SITE_HOST ||
			hostname === "localhost" ||
			hostname === "127.0.0.1" ||
			hostname === process.env.VERCEL_URL ||
			hostname === process.env.VERCEL_BRANCH_URL ||
			hostname === process.env.VERCEL_PROJECT_PRODUCTION_URL
		);
	} catch {
		return false;
	}
}

/**
 * A browser on this site: its requests carry an Origin we know, or are marked same-origin.
 * Anything can forge these headers, so this only keeps casual reuse of the key away.
 */
function fromThisSite(request: Request) {
	const origin = request.headers.get("origin");
	if (origin) return allowedOrigin(origin);
	return request.headers.get("sec-fetch-site") === "same-origin";
}

/** The Relay path: from the URL itself, or from the rewrite's ?path= if that's what arrives. */
function relayPath(url: URL) {
	const fromPathname = url.pathname.replace(/^\/api\/relay/, "");
	if (fromPathname && fromPathname !== "/") return fromPathname;
	const fromQuery = url.searchParams.get("path");
	return fromQuery ? `/${fromQuery.replace(/^\/+/, "")}` : "/";
}

export async function handleRelay(request: Request): Promise<Response> {
	if (!fromThisSite(request)) return Response.json({ message: "Forbidden" }, { status: 403 });

	const url = new URL(request.url);
	const path = relayPath(url);
	if (!ALLOWED.test(path)) return Response.json({ message: "Not allowed" }, { status: 404 });
	const search = new URLSearchParams(url.search);
	search.delete("path");
	const query = search.toString();

	const headers = new Headers({ accept: "application/json" });
	const contentType = request.headers.get("content-type");
	if (contentType) headers.set("content-type", contentType);
	const sdkVersion = request.headers.get("relay-sdk-version");
	if (sdkVersion) headers.set("relay-sdk-version", sdkVersion);
	if (process.env.RELAY_API_KEY) headers.set("x-api-key", process.env.RELAY_API_KEY);

	let body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
	if (body && path.startsWith("/quote")) {
		try {
			const quote = JSON.parse(body) as Record<string, unknown>;
			for (const field of STRIPPED_QUOTE_FIELDS) delete quote[field];
			// Attribute quotes to this app. Relay only accepts a referrer on authenticated requests.
			if (process.env.RELAY_API_KEY) quote.referrer = SITE_HOST;
			else delete quote.referrer;
			body = JSON.stringify(quote);
		} catch {
			return Response.json({ message: "Invalid quote request" }, { status: 400 });
		}
	}

	const upstream = await fetch(`${RELAY_API}${path}${query ? `?${query}` : ""}`, {
		method: request.method,
		headers,
		body,
	});

	return new Response(upstream.body, {
		status: upstream.status,
		headers: {
			"content-type": upstream.headers.get("content-type") ?? "application/json",
			"cache-control": path === "/chains" ? "public, max-age=300" : "no-store",
		},
	});
}

export const GET = handleRelay;
export const POST = handleRelay;
