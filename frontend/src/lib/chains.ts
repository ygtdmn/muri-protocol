import { getConnection, switchChain } from "wagmi/actions";
import { chains, wagmiConfig } from "./wagmi";

export type AppChainId = (typeof chains)[number]["id"];

export const isAppChain = (id: number | undefined): id is AppChainId => chains.some((c) => c.id === id);

/** "Ethereum", "Base", "Sepolia". */
export const chainName = (id: number) => chains.find((c) => c.id === id)?.name ?? `chain ${id}`;

/** Put the wallet on `chainId` before a write, asking it to switch if it's elsewhere. */
export async function ensureWalletChain(chainId: AppChainId) {
	if (getConnection(wagmiConfig).chainId === chainId) return;
	try {
		await switchChain(wagmiConfig, { chainId });
	} catch {
		throw new Error(`Switch your wallet to ${chainName(chainId)} to continue.`);
	}
}
