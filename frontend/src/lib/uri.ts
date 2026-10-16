// The contract writes each URI between double quotes, unescaped, into the token's metadata JSON and
// into the Smart HTML page. A quote, backslash or angle bracket in a URI would break out of that
// string, so they're refused here along with whitespace and control characters. Percent-encode
// such characters instead (%22 for a quote).
const UNSAFE = /["\\<>`\s\p{Cc}]/u;

// Arweave transaction ids are 43 base64url characters.
const ARWEAVE = /^ar:\/\/[A-Za-z0-9_-]{43}(\/[^?#]*)?([?#].*)?$/;
// CIDv0 (Qm…, base58) or CIDv1 (b…, base32), optionally after a legacy "ipfs/" and before a path.
const IPFS = /^ipfs:\/\/(ipfs\/)?(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})(\/[^?#]*)?([?#].*)?$/;

/** Why `uri` can't go on-chain, or null when it can. */
export function uriProblem(uri: string): string | null {
	if (!uri) return "Enter a link.";
	if (uri.length > 2048) return "That link is too long.";
	if (UNSAFE.test(uri)) {
		return "Links can't contain spaces, quotes, backslashes or angle brackets. Percent-encode them (for example %20).";
	}
	if (uri.startsWith("ar://")) return ARWEAVE.test(uri) ? null : "That isn't a valid ar:// link (ar:// plus a 43-character id).";
	if (uri.startsWith("ipfs://")) return IPFS.test(uri) ? null : "That isn't a valid ipfs:// link (ipfs:// plus a CID).";
	if (/^https?:\/\//i.test(uri)) {
		try {
			const url = new URL(uri);
			return url.hostname.includes(".") || url.hostname === "localhost" ? null : "That link has no valid host.";
		} catch {
			return "That isn't a valid link.";
		}
	}
	return "Use an https://, ar:// or ipfs:// link.";
}

export const isValidUri = (uri: string) => uriProblem(uri) === null;

/** Whether a URI read from the chain is one we can link to and fetch (anyone can write anything there). */
export const isFetchableUri = (uri: string) => /^(https?:\/\/[^/]|ar:\/\/|ipfs:\/\/)/i.test(uri) && !UNSAFE.test(uri);

/** The host of a URL, or undefined if it can't be parsed. */
export function hostOf(url: string | undefined): string | undefined {
	if (!url) return undefined;
	try {
		return new URL(url).host;
	} catch {
		return undefined;
	}
}
