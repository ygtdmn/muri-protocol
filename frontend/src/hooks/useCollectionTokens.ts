import { useQuery } from "@tanstack/react-query";
import { useChainId } from "wagmi";
import { multicall } from "wagmi/actions";
import { parseAbi } from "viem";
import type { Address } from "viem";
import { wagmiConfig } from "../lib/wagmi";
import { muriAbi } from "../abis/muri-abi";
import { MURI_ADDRESS, MURI_EXTENSION_ADDRESS, parseMetadataFields } from "../lib/muri";

// Manifold Creator Core reads. Token IDs are issued sequentially, so a collection can be walked
// with batched calls: no indexer, no log scanning, any public RPC.
const coreAbi = parseAbi([
	"function ownerOf(uint256 tokenId) view returns (address)",
	"function totalSupply(uint256 tokenId) view returns (uint256)",
	"function balanceOf(address account, uint256 id) view returns (uint256)",
	"function tokenExtension(uint256 tokenId) view returns (address)",
]);

const BATCH = 250;
/** Stop after this many IDs in a row with no token (burns leave gaps; this covers them). */
const GAP = 100;
/** Hard ceiling per scan; collections larger than this are rare. */
const MAX_ID = 20_000;

export interface CollectionToken {
	id: bigint;
	name: string;
	copies: number;
	displayMode: number;
	/** ERC-721 owner. */
	owner?: Address;
	/** ERC-1155 balance of the wallet we filtered by. */
	balance?: bigint;
}

export interface CollectionScan {
	tokens: CollectionToken[];
	/** Highest token ID that exists in the collection. */
	lastId: number;
	/** How many token IDs exist in total (MURI or not). */
	existing: number;
}

type ChainId = (typeof wagmiConfig)["chains"][number]["id"];

async function scanCollection(
	chainId: ChainId,
	creator: Address,
	type: "ERC721" | "ERC1155",
	owner: Address | undefined
): Promise<CollectionScan> {
	const candidates: { id: bigint; owner?: Address; balance?: bigint }[] = [];
	let lastId = 0;
	let existing = 0;

	for (let start = 1; start <= MAX_ID; start += BATCH) {
		const ids = Array.from({ length: BATCH }, (_, i) => BigInt(start + i));
		const perId = type === "ERC1155" && owner ? 3 : 2;
		const results = await multicall(wagmiConfig, {
			chainId,
			allowFailure: true,
			// One eth_call per batch; viem would otherwise split it into ~1 KB chunks.
			batchSize: 0,
			contracts: ids.flatMap((id) => [
				type === "ERC721"
					? { address: creator, abi: coreAbi, functionName: "ownerOf" as const, args: [id] as const }
					: { address: creator, abi: coreAbi, functionName: "totalSupply" as const, args: [id] as const },
				{ address: creator, abi: coreAbi, functionName: "tokenExtension" as const, args: [id] as const },
				...(type === "ERC1155" && owner
					? [{ address: creator, abi: coreAbi, functionName: "balanceOf" as const, args: [owner, id] as const }]
					: []),
			]) as never[],
		});

		ids.forEach((id, i) => {
			const exists = results[i * perId];
			const extension = results[i * perId + 1];
			const found =
				exists.status === "success" && (type === "ERC721" ? true : (exists.result as bigint) > 0n);
			if (!found) return;
			existing += 1;
			lastId = Number(id);
			// Manifold records which extension minted each token. A collection that doesn't expose
			// it (a non-Manifold contract) is checked against MURI's own data below instead.
			const viaMuri =
				extension.status === "failure" ||
				(extension.result as Address).toLowerCase() === MURI_EXTENSION_ADDRESS.toLowerCase();
			if (!viaMuri) return;
			candidates.push({
				id,
				owner: type === "ERC721" ? (exists.result as Address) : undefined,
				balance: type === "ERC1155" && owner ? (results[i * perId + 2].result as bigint | undefined) : undefined,
			});
		});

		const scannedTo = start + BATCH - 1;
		if (scannedTo - lastId >= GAP) break;
	}

	// Read MURI's record for each candidate: a minted MURI token always carries a file hash.
	const tokens: CollectionToken[] = [];
	for (let i = 0; i < candidates.length; i += 100) {
		const chunk = candidates.slice(i, i + 100);
		const data = await multicall(wagmiConfig, {
			chainId,
			allowFailure: true,
			// One eth_call per batch; viem would otherwise split it into ~1 KB chunks.
			batchSize: 0,
			contracts: chunk.map((c) => ({
				address: MURI_ADDRESS,
				abi: muriAbi,
				functionName: "tokenData" as const,
				args: [creator, c.id] as const,
			})),
		});
		chunk.forEach((c, j) => {
			const entry = data[j];
			if (entry.status !== "success") return;
			const [metadata, , artwork, , displayMode] = entry.result;
			if (!artwork.fileHash) return;
			tokens.push({
				...c,
				name: parseMetadataFields(metadata).name,
				copies: artwork.artistUris.length + artwork.collectorUris.length,
				displayMode: Number(displayMode),
			});
		});
	}

	return { tokens, lastId, existing };
}

/**
 * The MURI tokens in a collection, found by walking its token IDs with batched calls.
 * With `owner`, also reports ownership so callers can filter to the wallet's tokens.
 */
export function useCollectionTokens(
	creator: Address | undefined,
	type: "ERC721" | "ERC1155" | undefined,
	owner?: Address,
	/** The page's network; the wallet's if not given. */
	pageChainId?: ChainId
) {
	const walletChainId = useChainId() as ChainId;
	const chainId = pageChainId ?? walletChainId;
	return useQuery({
		queryKey: ["collection-tokens", chainId, creator?.toLowerCase(), type, owner?.toLowerCase()],
		queryFn: () => scanCollection(chainId, creator!, type!, owner),
		enabled: Boolean(creator && type),
		staleTime: 60_000,
	});
}
