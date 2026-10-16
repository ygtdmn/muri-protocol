import { useConnection, useReadContracts } from "wagmi";
import { parseAbi } from "viem";
import type { Address } from "viem";
import type { AppChainId } from "../lib/chains";

const adminAbi = parseAbi([
	"function isAdmin(address account) view returns (bool)",
	"function owner() view returns (address)",
]);

/**
 * Whether the connected wallet is an admin of the collection, decided exactly as MURIProtocol's
 * _isContractAdmin does: isAdmin(wallet) if the contract has it, otherwise owner() == wallet.
 * The contract uses this to pick the artist or the owner side of every call, so a page must know
 * which side a wallet will land on. Undefined while unknown or when no wallet is connected.
 */
export function useIsCollectionAdmin(creator: Address | undefined, chainId: AppChainId): boolean | undefined {
	const { address } = useConnection();
	const reads = useReadContracts({
		allowFailure: true,
		contracts:
			creator && address
				? [
						{ address: creator, abi: adminAbi, functionName: "isAdmin", args: [address], chainId },
						{ address: creator, abi: adminAbi, functionName: "owner", chainId },
					]
				: undefined,
		query: { enabled: Boolean(creator && address), staleTime: 60_000 },
	});
	if (!address || !reads.data) return undefined;
	const [isAdmin, owner] = reads.data;
	if (isAdmin.status === "success") return isAdmin.result;
	if (owner.status === "success") return owner.result.toLowerCase() === address.toLowerCase();
	return false;
}
