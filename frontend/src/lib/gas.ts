import { BaseError, ContractFunctionRevertedError, createPublicClient, http } from "viem";
import type { PublicClient } from "viem";
import { getPublicClient } from "wagmi/actions";
import { chains, RPC_URLS, wagmiConfig } from "./wagmi";
import { chainName } from "./chains";
import { describeContractError, isRpcTransportError } from "../utils/rpcErrors";

type ChainId = (typeof chains)[number]["id"];

/** EIP-7825's per-transaction gas cap, enforced on Ethereum, Sepolia and Base since Fusaka. */
const TX_GAS_CAP = 16_777_216n;

export interface GasRules {
	/** Glamsterdam is live: storing data is metered as state gas (EIP-8037). */
	glamsterdam: boolean;
	/** The most gas one transaction can set on this network right now. */
	maxGas: bigint;
}

/**
 * Which gas rules the network follows right now, read from its latest block. Before Glamsterdam,
 * EIP-7825 caps every transaction's gas. From Glamsterdam on, state gas sits outside that cap and a
 * transaction only has to fit in one block. Glamsterdam blocks carry a block access list (EIP-7928),
 * so its hash tells the two apart, and the switch is picked up the moment a network forks.
 */
export async function gasRules(chainId: ChainId): Promise<GasRules> {
	const block = await getPublicClient(wagmiConfig, { chainId }).getBlock();
	const glamsterdam = "blockAccessListHash" in block;
	const maxGas = glamsterdam || block.gasLimit < TX_GAS_CAP ? block.gasLimit : TX_GAS_CAP;
	return { glamsterdam, maxGas };
}

const clients = new Map<string, PublicClient>();

function rpcClient(chainId: ChainId, url: string) {
	let client = clients.get(url);
	if (!client) {
		const chain = chains.find((c) => c.id === chainId)!;
		client = createPublicClient({ chain, transport: http(url, { retryCount: 1, timeout: 15_000 }) }) as PublicClient;
		clients.set(url, client);
	}
	return client;
}

/**
 * A revert the contract explains (a MURI error, a require message, a panic) is the call's real
 * outcome, and every RPC will agree on it. Anything else may be the RPC: one that simulates with
 * less gas than the call needs reports a storage write that ran dry (SSTORE2's DeploymentFailed),
 * or garbled revert data, rather than "out of gas".
 */
export function isExplainedRevert(error: unknown) {
	if (!(error instanceof BaseError)) return false;
	const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
	return revert instanceof ContractFunctionRevertedError && Boolean(revert.data?.errorName);
}

/**
 * Estimate gas on each of the network's RPCs in turn, taking the first answer. Public RPCs cap
 * simulated gas at different levels (16.7M, 50M, the block limit), so a heavy call that one of them
 * can't simulate is handed to the next instead of failing.
 */
export async function estimateAcrossRpcs(
	chainId: ChainId,
	estimate: (client: PublicClient) => Promise<bigint>
): Promise<bigint> {
	let lastError: unknown;
	for (const url of RPC_URLS[chainId]) {
		try {
			return await estimate(rpcClient(chainId, url));
		} catch (error) {
			if (isExplainedRevert(error)) throw error;
			lastError = error;
		}
	}
	throw lastError;
}

const formatGas = (gas: bigint) => `${(Number(gas) / 1e6).toFixed(1)}M`;

export type GasPlan =
	/** Send with this gas limit. */
	| { gas: bigint }
	/** Don't send: the call reverts or can't fit in a transaction. */
	| { error: string }
	/** No RPC answered; send anyway and let the wallet estimate. */
	| { warning: string };

/**
 * The gas limit to send a call with, worked out by us rather than the wallet: wallets estimate
 * through RPCs that cap simulated gas and come back with a limit too low for heavy on-chain data.
 * Adds headroom for state that changes before inclusion, within what the network accepts.
 */
export async function planGas(
	chainId: ChainId,
	estimate: (client: PublicClient) => Promise<bigint>
): Promise<GasPlan> {
	try {
		// Estimating also simulates the call, so a revert surfaces here with its reason.
		const [needed, rules] = await Promise.all([estimateAcrossRpcs(chainId, estimate), gasRules(chainId)]);
		if (needed > rules.maxGas) {
			return {
				error: `This needs about ${formatGas(needed)} gas, more than the ${formatGas(rules.maxGas)} one transaction can use on ${chainName(chainId)}. On-chain data is what makes it heavy: use a smaller on-chain thumbnail, or a thumbnail link instead.`,
			};
		}
		const gas = needed + needed / 5n;
		return { gas: gas > rules.maxGas ? rules.maxGas : gas };
	} catch (error) {
		if (!isRpcTransportError(error)) return { error: describeContractError(error) };
		return {
			warning: "Couldn't reach the RPC to preview this transaction. Sending it anyway; your wallet will still show the details.",
		};
	}
}
