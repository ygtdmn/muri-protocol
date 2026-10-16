import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { getConnection, getWalletClient, switchChain } from "wagmi/actions";
import { base } from "wagmi/chains";
import { wagmiConfig, chains } from "./wagmi";

type ChainId = (typeof chains)[number]["id"];

/** USDC on Base has 6 decimals. */
export const formatUsdc = (atomic: bigint) => {
	const dollars = Number(atomic) / 1e6;
	if (dollars === 0) return "$0";
	if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
	return `$${dollars.toFixed(2)}`;
};

/**
 * x402 payments are EIP-3009 USDC authorizations on Base. Most wallets refuse to sign
 * typed data for a chain they are not connected to, so hop to Base for the signature
 * and return to the original chain right after it: the upload itself needs no wallet,
 * and can take minutes for a large file.
 */
export async function withBasePayment<T>(
	maxUsdcAtomic: bigint,
	run: (pay: typeof fetch) => Promise<T>,
	/** Chain to return to afterwards. Defaults to the chain the wallet was on. */
	returnTo?: number
): Promise<T> {
	const { chainId: currentChainId } = getConnection(wagmiConfig);
	// Only return to chains this app is configured for; a Relay swap may have left the wallet elsewhere.
	const candidate = returnTo ?? currentChainId;
	const originalChainId = chains.some((c) => c.id === candidate) ? candidate : undefined;

	if (currentChainId !== base.id) {
		try {
			await switchChain(wagmiConfig, { chainId: base.id });
		} catch {
			throw new Error("Switch your wallet to Base to pay for storage with USDC.");
		}
	}

	let restoring: Promise<void> | undefined;
	// If switching back fails, the user can switch from the header; the payment is unaffected.
	const restore = () =>
		(restoring ??=
			originalChainId && originalChainId !== base.id
				? switchChain(wagmiConfig, { chainId: originalChainId as ChainId }).then(
						() => undefined,
						() => undefined
					)
				: Promise.resolve());

	try {
		const wallet = await getWalletClient(wagmiConfig, { chainId: base.id });
		const account = wallet.account;

		const client = new x402Client();
		registerExactEvmScheme(client, {
			// Pay on Base only, whatever network a 402 response asks for.
			networks: ["eip155:8453"],
			signer: {
				address: account.address,
				signTypedData: async (message) => {
					try {
						return await wallet.signTypedData({
							account,
							...message,
						} as Parameters<typeof wallet.signTypedData>[0]);
					} finally {
						void restore();
					}
				},
			},
		});
		// Cap every payment at what the user agreed to. The library default is $1.
		client.setSpendControls({
			maxAmountPerPayment: `$${(Number(maxUsdcAtomic) / 1e6).toFixed(6)}`,
		});

		return await run(wrapFetchWithPayment(fetch, client));
	} catch (error) {
		throw new Error(describePaymentError(error));
	} finally {
		await restore();
	}
}

export function describePaymentError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	const lower = message.toLowerCase();
	if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected the request")) {
		return "Payment cancelled in your wallet.";
	}
	if (lower.includes("spendcontrols") || lower.includes("maxamountperpayment")) {
		return "The price went above your quote. Refresh the quote and try again.";
	}
	if (lower.includes("insufficient")) {
		return "Not enough USDC on Base for this upload.";
	}
	return message.split("\n")[0];
}

/** Read the error a payment-gated endpoint returned, whichever x402 version it speaks. */
export async function readPaymentFailure(response: Response): Promise<string> {
	const header = response.headers.get("payment-required");
	if (header) {
		try {
			const decoded = JSON.parse(atob(header)) as { error?: string };
			if (decoded.error) return decodeX402Reason(decoded.error);
		} catch {
			// Fall through to the body.
		}
	}
	const text = await response.text().catch(() => "");
	try {
		const body = JSON.parse(text) as { error?: string; message?: string };
		if (body.error) return decodeX402Reason(body.error);
		if (body.message) return body.message;
	} catch {
		// Not JSON.
	}
	return text ? `${response.status}: ${text.slice(0, 200)}` : `Request failed (${response.status})`;
}

function decodeX402Reason(reason: string) {
	if (reason.includes("insufficient_funds")) return "Not enough USDC on Base for this upload.";
	if (reason === "Payment required") return "Payment was not accepted. Try again.";
	return reason.replace(/_/g, " ");
}
