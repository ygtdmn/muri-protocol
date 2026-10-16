import { useQueries } from "@tanstack/react-query";
import { isFetchableUri } from "../lib/uri";

export type LinkHealth = "checking" | "live" | "dead" | "unreachable" | "unverified";

export interface LinkProbe {
	health: LinkHealth;
	/** HTTP status when the host allowed us to read it. */
	status?: number;
	/** The URL that answered: for ar:// and ipfs://, the first gateway that worked. */
	url?: string;
}

// Same gateways, in the same order, as the on-chain HTML template
// (contract/html-template/template.html). Checked against public-gateway-checker, Oct 2026.
export const IPFS_GATEWAYS = [
	"https://ipfs.filebase.io/ipfs/",
	"https://gateway.pinata.cloud/ipfs/",
	"https://4everland.io/ipfs/",
	"https://dweb.link/ipfs/",
	"https://ipfs.io/ipfs/",
];
export const ARWEAVE_GATEWAYS = ["https://arweave.net/", "https://turbo-gateway.com/"];

/**
 * Every URL a URI can be fetched from, in the order to try them. Empty for anything that isn't an
 * absolute https://, ar:// or ipfs:// link: on-chain URIs are untrusted, and a relative or
 * javascript: one must never be fetched or linked.
 */
export function gatewayUrls(uri: string): string[] {
	if (!isFetchableUri(uri)) return [];
	if (uri.startsWith("ar://")) return ARWEAVE_GATEWAYS.map((g) => g + uri.slice(5));
	// Accept the legacy ipfs://ipfs/<cid> form too.
	if (uri.startsWith("ipfs://")) return IPFS_GATEWAYS.map((g) => g + uri.slice(7).replace(/^ipfs\//, ""));
	return [uri];
}

/** The first gateway URL, for linking before a probe has found a working one. */
export const toGatewayUrl = (uri: string): string | undefined => gatewayUrls(uri)[0];

async function probeUrl(url: string): Promise<LinkProbe> {
	try {
		// Ask for one byte so large media isn't downloaded just to check it.
		const res = await fetch(url, { headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(12_000) });
		return { health: res.ok ? "live" : "dead", status: res.status, url };
	} catch {
		// CORS blocks reading the response from many hosts. An opaque request still tells us
		// whether the server answers at all.
		try {
			await fetch(url, { mode: "no-cors", signal: AbortSignal.timeout(12_000) });
			return { health: "unverified", url };
		} catch {
			return { health: "unreachable", url };
		}
	}
}

// Rank results so that, when no gateway is live, we report the most useful failure.
const rank: Record<LinkHealth, number> = { live: 0, unverified: 1, dead: 2, unreachable: 3, checking: 4 };

/** Try each gateway in turn and stop at the first that serves the file. */
async function probe(uri: string): Promise<LinkProbe> {
	let best: LinkProbe | undefined;
	for (const url of gatewayUrls(uri)) {
		const result = await probeUrl(url);
		if (result.health === "live") return result;
		if (!best || rank[result.health] < rank[best.health]) best = result;
	}
	return best ?? { health: "unreachable" };
}

export function useLinkProbes(uris: readonly string[]): LinkProbe[] {
	const results = useQueries({
		queries: uris.map((uri) => ({
			queryKey: ["link-health", uri],
			queryFn: () => probe(uri),
			staleTime: 5 * 60_000,
		})),
	});
	return uris.map((_, i) => results[i]?.data ?? { health: "checking" });
}

export function useLinkHealth(uris: readonly string[]): LinkHealth[] {
	return useLinkProbes(uris).map((p) => p.health);
}
