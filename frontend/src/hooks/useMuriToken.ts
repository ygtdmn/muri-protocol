import { useMemo } from "react";
import { useReadContract } from "wagmi";
import type { Address } from "viem";
import { muriAbi } from "../abis/muri-abi";
import { MURI_ADDRESS } from "../lib/muri";
import type { AppChainId } from "../lib/chains";

export interface MuriToken {
	metadata: string;
	displayMode: number;
	flags: number;
	artistUris: readonly string[];
	collectorUris: readonly string[];
	selectedArtistUriIndex: number;
	fileHash: string;
	mimeType: string;
	isOnChainThumbnail: boolean;
	thumbnailUris: readonly string[];
	selectedThumbnailIndex: number;
	hasCustomTemplate: boolean;
}

/** One `tokenData` read, on the page's network, returns everything the editors need. */
export function useMuriToken(creator: Address | undefined, tokenIdInput: string, chainId: AppChainId) {
	const trimmed = tokenIdInput.trim();
	const isValidId = /^\d+$/.test(trimmed);
	const tokenId = isValidId ? BigInt(trimmed) : undefined;

	const query = useReadContract({
		abi: muriAbi,
		address: MURI_ADDRESS,
		functionName: "tokenData",
		args: creator && tokenId !== undefined ? [creator, tokenId] : undefined,
		chainId,
		query: { enabled: Boolean(creator && tokenId !== undefined), staleTime: 30_000 },
	});

	const token = useMemo<MuriToken | undefined>(() => {
		if (!query.data) return undefined;
		const [metadata, thumbnail, artwork, permissions, displayMode, htmlTemplate] = query.data;
		return {
			metadata,
			displayMode: Number(displayMode),
			flags: Number(permissions.flags),
			artistUris: artwork.artistUris,
			collectorUris: artwork.collectorUris,
			selectedArtistUriIndex: Number(artwork.selectedArtistUriIndex),
			fileHash: artwork.fileHash,
			mimeType: artwork.mimeType,
			isOnChainThumbnail: Number(thumbnail.kind) === 0,
			thumbnailUris: thumbnail.offChain.uris,
			selectedThumbnailIndex: Number(thumbnail.offChain.selectedUriIndex),
			hasCustomTemplate: htmlTemplate.chunks.length > 0,
		};
	}, [query.data]);

	// A public mapping returns zero values for unknown keys; minted tokens always carry a file hash.
	const notFound = Boolean(query.data && token && !token.fileHash);

	return {
		tokenId,
		isValidId,
		token: notFound ? undefined : token,
		notFound,
		isLoading: query.isLoading,
		error: query.error,
		refetch: query.refetch,
	};
}
