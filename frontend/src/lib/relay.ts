import { createClient, getClient } from "@relayprotocol/relay-sdk";
import type { Execute, RelayChain } from "@relayprotocol/relay-sdk";
import { configureDynamicChains } from "@relayprotocol/relay-sdk/chain-utils";
import { createPublicClient, erc20Abi, formatUnits, http, zeroAddress } from "viem";
import type { Address } from "viem";

/** USDC on Base: the only asset Turbo and Pinata accept over x402. */
export const BASE_CHAIN_ID = 8453;
export const BASE_USDC: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Same-origin proxy that adds the Relay API key server-side (api/relay on Vercel, Vite proxy in dev).
const RELAY_API_PATH = (import.meta.env.VITE_RELAY_API_URL as string | undefined) ?? "/api/relay";
const relayApiUrl = () => new URL(RELAY_API_PATH, window.location.origin).toString().replace(/\/$/, "");

// Checked first when looking for something the user can pay with.
const SCAN_CHAIN_IDS = [8453, 1, 42161, 10, 137, 56, 43114, 324, 59144, 534352, 130, 7777777];

export interface RelayToken {
	chainId: number;
	address: Address;
	symbol: string;
	name: string;
	decimals: number;
	logoURI?: string;
}

export interface Holding {
	token: RelayToken;
	chain: RelayChain;
	balance: bigint;
}

let chainsPromise: Promise<RelayChain[]> | null = null;

/** Create the SDK client once and load Relay's live chain list. */
export function loadRelayChains(): Promise<RelayChain[]> {
	if (!chainsPromise) {
		createClient({ baseApiUrl: relayApiUrl() });
		chainsPromise = configureDynamicChains().catch((error) => {
			chainsPromise = null;
			throw error;
		});
	}
	return chainsPromise;
}

/**
 * Chains a connected EVM wallet can pay from. Relay also supports Solana, Bitcoin and other
 * non-EVM chains, but those need their own wallet.
 */
export const payableChains = (chains: RelayChain[]) =>
	chains
		.filter((c) => c.vmType === "evm" && c.depositEnabled !== false && c.viemChain)
		.sort((a, b) => {
			const ai = SCAN_CHAIN_IDS.indexOf(a.id);
			const bi = SCAN_CHAIN_IDS.indexOf(b.id);
			if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
			return a.displayName.localeCompare(b.displayName);
		});

const nativeToken = (chain: RelayChain): RelayToken => ({
	chainId: chain.id,
	address: zeroAddress,
	symbol: chain.currency?.symbol ?? "ETH",
	name: chain.currency?.name ?? "Native token",
	decimals: chain.currency?.decimals ?? 18,
	logoURI: chain.iconUrl ?? undefined,
});

const isBaseUsdc = (t: RelayToken) =>
	t.chainId === BASE_CHAIN_ID && t.address.toLowerCase() === BASE_USDC.toLowerCase();

/** Tokens Relay lists for a chain, optionally filtered by a search term (symbol, name or address). */
export async function searchTokens(chain: RelayChain, term = ""): Promise<RelayToken[]> {
	const body = term.trim()
		? { chainIds: [chain.id], term: term.trim(), limit: 20 }
		: { chainIds: [chain.id], defaultList: true, limit: 20 };
	const res = await fetch(`${relayApiUrl()}/currencies/v2`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`Token list failed (${res.status})`);
	const list = (await res.json()) as {
		chainId: number;
		address: string;
		symbol: string;
		name: string;
		decimals: number;
		metadata?: { logoURI?: string; verified?: boolean };
	}[];
	const tokens = list.map((t) => ({
		chainId: t.chainId,
		address: t.address as Address,
		symbol: t.symbol,
		name: t.name,
		decimals: t.decimals,
		logoURI: t.metadata?.logoURI,
	}));
	const withNative = term.trim() ? tokens : [nativeToken(chain), ...tokens.filter((t) => t.address !== zeroAddress)];
	return withNative.filter((t) => !isBaseUsdc(t));
}

const clientFor = (chain: RelayChain) =>
	createPublicClient({ chain: chain.viemChain, transport: http(chain.httpRpcUrl) });

export async function getTokenBalance(chain: RelayChain, token: RelayToken, owner: Address): Promise<bigint> {
	const client = clientFor(chain);
	if (token.address === zeroAddress) return client.getBalance({ address: owner });
	return client.readContract({ address: token.address, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
}

/** Native and featured tokens the wallet holds on the most common chains. */
export async function scanHoldings(chains: RelayChain[], owner: Address): Promise<Holding[]> {
	const targets = payableChains(chains).filter((c) => SCAN_CHAIN_IDS.includes(c.id));
	const perChain = await Promise.all(
		targets.map(async (chain): Promise<Holding[]> => {
			const featured = (chain.featuredTokens ?? [])
				.map(
					(t): RelayToken => ({
						chainId: chain.id,
						address: t.address as Address,
						symbol: t.symbol ?? "",
						name: t.name ?? "",
						decimals: t.decimals ?? 18,
						logoURI: t.metadata?.logoURI,
					})
				)
				.filter((t) => t.address && t.address !== zeroAddress);
			const tokens = [nativeToken(chain), ...featured].filter((t) => !isBaseUsdc(t));
			const results = await Promise.allSettled(tokens.map((t) => getTokenBalance(chain, t, owner)));
			return results.flatMap((r, i) =>
				r.status === "fulfilled" && r.value > 0n ? [{ token: tokens[i], chain, balance: r.value }] : []
			);
		})
	);
	return perChain.flat();
}

/** Quote exactly `usdcAmount` of USDC delivered to `user` on Base, paid with `token`. */
export async function quoteUsdcOnBase(token: RelayToken, usdcAmount: bigint, user: Address): Promise<Execute> {
	await loadRelayChains();
	return getClient().actions.getQuote({
		chainId: token.chainId,
		currency: token.address,
		toChainId: BASE_CHAIN_ID,
		toCurrency: BASE_USDC,
		amount: usdcAmount.toString(),
		tradeType: "EXACT_OUTPUT",
		user,
		recipient: user,
		// The SDK defaults `referrer` to the page hostname, but Relay only accepts a referrer on
		// requests with an API key. The server-side proxy adds it back when a key is configured.
		options: { referrer: undefined },
	});
}

export const formatToken = (amount: bigint, decimals: number, max = 6) => {
	const value = Number(formatUnits(amount, decimals));
	if (value === 0) return "0";
	if (value < 10 ** -max) return `<${(10 ** -max).toFixed(max)}`;
	return value.toLocaleString(undefined, { maximumFractionDigits: value < 1 ? max : 4 });
};

export function describeRelayError(error: unknown): string {
	const message =
		typeof error === "string"
			? error
			: error instanceof Error
				? error.message
				: (error as { message?: string })?.message ?? "Relay request failed";
	const lower = message.toLowerCase();
	if (lower.includes("user rejected") || lower.includes("user denied")) return "Cancelled in your wallet.";
	if (lower.includes("no routes") || lower.includes("no_swap_routes")) return "Relay has no route for this token right now. Pick another one.";
	if (lower.includes("insufficient")) return "Not enough balance for this route, including gas.";
	if (lower.includes("amount too low") || lower.includes("could not process")) return "This amount is too small for that route. Try a different token or chain.";
	return message.split("\n")[0];
}
