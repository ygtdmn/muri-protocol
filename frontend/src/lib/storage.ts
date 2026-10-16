import { readPaymentFailure, withBasePayment } from "./x402";
import { resolveMimeType } from "../utils/fileValidation";

export type StorageProvider = "arweave" | "ipfs";

export interface StorageQuote {
	provider: StorageProvider;
	/** Atomic USDC (6 decimals). */
	usdc: bigint;
	/** Arweave items this small go through Turbo's free tier, so no payment is expected. */
	likelyFree?: boolean;
}

export interface StoredFile {
	provider: StorageProvider;
	/** Protocol-native URI we write on-chain; the HTML template rewrites it to a gateway. */
	uri: string;
	/** Protocol-native identifier (Arweave tx id or IPFS CID). */
	id: string;
}

/** Turbo asked for payment on a file we quoted as free; the caller should show the price first. */
export class FreeTierUnavailable extends Error {
	constructor() {
		super("This file isn't covered by Arweave's free tier after all, so it needs a payment.");
	}
}

/**
 * The upload failed after the payment went through. `resume` retries the upload with what was
 * already paid for, without paying again.
 */
export class PaidUploadError extends Error {
	readonly resume: () => Promise<StoredFile>;
	constructor(message: string, resume: () => Promise<StoredFile>) {
		super(message);
		this.resume = resume;
	}
}

// Turbo's x402 routes live under /x402/upload/*. The ar.io docs still show
// /x402/data-item/unsigned, which the service no longer serves for unsigned data.
const TURBO_URL = "https://upload.ardrive.io/v1";
const TURBO_FREE_BYTES = 100 * 1024; // Free tier is 105 KiB per data item, including tag overhead.

const PINATA_X402_URL = "https://402.pinata.cloud/v1/pin/public";
// Pinata sizes the presigned upload by this value, so leave room for multipart overhead.
const PINATA_OVERHEAD = 1_000_000;
// The size goes in the URL: Pinata prices by it and rejects a paid request without it.
// (A JSON body is ignored; an unpaid request without it still quotes the $0.001 minimum.)
const pinataUrl = (bytes: number) => `${PINATA_X402_URL}?fileSize=${bytes + PINATA_OVERHEAD}`;

// Quotes are what the user approves; allow a little drift between quote and payment.
const withSlippage = (atomic: bigint) => (atomic * 110n) / 100n + 1000n;

const arweaveTags = (file: File) => [
	{ name: "Content-Type", value: resolveMimeType(file) || "application/octet-stream" },
	{ name: "App-Name", value: "MURI-Protocol" },
];

export async function quoteStorage(provider: StorageProvider, file: File): Promise<StorageQuote> {
	return quoteBySize(provider, file.size, resolveMimeType(file) || "application/octet-stream");
}

/** Price an upload of `bytes` without having the file, e.g. for showing example costs. */
export async function quoteBySize(
	provider: StorageProvider,
	bytes: number,
	contentType: string
): Promise<StorageQuote> {
	if (provider === "arweave") {
		const tagCount = 2; // Content-Type and App-Name, see arweaveTags.
		const params = new URLSearchParams({ tags: String(tagCount), contentType });
		const res = await fetch(`${TURBO_URL}/price/x402/data/usdc-base/${bytes}?${params}`);
		if (!res.ok) throw new Error(`Arweave quote failed (${res.status})`);
		const { usdcAmount } = (await res.json()) as { usdcAmount: string };
		return { provider, usdc: BigInt(usdcAmount), likelyFree: bytes <= TURBO_FREE_BYTES };
	}

	// Pinata has no quote endpoint, but an unpaid request returns the exact price in its 402.
	const res = await fetch(pinataUrl(bytes), { method: "POST" });
	const header = res.headers.get("payment-required");
	if (res.status !== 402 || !header) throw new Error(`IPFS quote failed (${res.status})`);
	const required = JSON.parse(atob(header)) as {
		accepts: { amount?: string; maxAmountRequired?: string }[];
	};
	const amount = required.accepts[0]?.amount ?? required.accepts[0]?.maxAmountRequired;
	if (!amount) throw new Error("IPFS quote missing a price");
	return { provider, usdc: BigInt(amount) };
}

export async function uploadToArweave(file: File, quote: StorageQuote, returnTo?: number): Promise<StoredFile> {
	const init = (): RequestInit => ({
		method: "POST",
		headers: {
			"Content-Type": "application/octet-stream",
			"x-data-item-tags": JSON.stringify(arweaveTags(file)),
		},
		body: file,
	});
	const endpoint = `${TURBO_URL}/x402/upload/unsigned`;

	let response: Response;
	if (quote.likelyFree) {
		// Small files are free, so the wallet isn't involved. If Turbo asks for payment anyway, stop
		// and let the user see the price before paying.
		response = await fetch(endpoint, init());
		if (response.status === 402) throw new FreeTierUnavailable();
	} else {
		response = await withBasePayment(withSlippage(quote.usdc), (pay) => pay(endpoint, init()), returnTo);
	}

	if (!response.ok) throw new Error(await readPaymentFailure(response));
	const body = (await response.json()) as { id?: string; receipt?: { id?: string } };
	const id = body.id ?? body.receipt?.id;
	if (!id) throw new Error("Arweave upload finished without a transaction id.");
	return { provider: "arweave", id, uri: `ar://${id}` };
}

export async function uploadToIpfs(file: File, quote: StorageQuote, returnTo?: number): Promise<StoredFile> {
	// The payment buys a presigned upload URL; the file goes to it in a second request.
	const presigned = await withBasePayment(withSlippage(quote.usdc), (pay) =>
		pay(pinataUrl(file.size), { method: "POST" }),
		returnTo
	);
	if (!presigned.ok) throw new Error(await readPaymentFailure(presigned));
	const { url } = (await presigned.json()) as { url: string };
	return uploadToPresignedUrl(file, url);
}

async function uploadToPresignedUrl(file: File, url: string): Promise<StoredFile> {
	const retry = () => uploadToPresignedUrl(file, url);
	const form = new FormData();
	form.append("file", file);
	form.append("name", file.name);
	let upload: Response;
	try {
		upload = await fetch(url, { method: "POST", body: form });
	} catch {
		throw new PaidUploadError("The upload to IPFS was interrupted. It's already paid for, so retrying is free.", retry);
	}
	if (!upload.ok) {
		const detail = (await upload.text().catch(() => "")).slice(0, 200);
		// An expired or used-up upload link can't be retried; anything else can.
		if (upload.status === 401 || upload.status === 403 || upload.status === 410) {
			throw new Error(`The paid IPFS upload link has expired (${upload.status}). Uploading again needs a new payment. ${detail}`);
		}
		throw new PaidUploadError(`IPFS upload failed after payment (${upload.status}). Retrying is free. ${detail}`, retry);
	}
	const { data } = (await upload.json()) as { data?: { cid?: string } };
	if (!data?.cid) throw new Error("IPFS upload finished without a CID.");
	return { provider: "ipfs", id: data.cid, uri: `ipfs://${data.cid}` };
}

export const uploadToStorage = (file: File, quote: StorageQuote, returnTo?: number) =>
	quote.provider === "arweave" ? uploadToArweave(file, quote, returnTo) : uploadToIpfs(file, quote, returnTo);

/** USDC the wallet should hold before paying: the quote plus room for small price moves. */
export const requiredUsdc = (quote: StorageQuote) => (quote.usdc * 102n) / 100n;
