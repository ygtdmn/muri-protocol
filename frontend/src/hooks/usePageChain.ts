import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useChainId, useConnection } from "wagmi";
import { isAppChain } from "../lib/chains";
import type { AppChainId } from "../lib/chains";

/**
 * The network a page works on, kept in the URL as ?chain=. Links then open on the right network,
 * and the page stays put when the wallet changes network on its own, e.g. to pay for storage on
 * Base. Without the parameter the page takes the wallet's network and records it.
 */
export function usePageChain(): AppChainId {
	const [params, setParams] = useSearchParams();
	const walletChain = useChainId();
	const { status } = useConnection();
	const fromUrl = Number(params.get("chain"));
	const pinned = isAppChain(fromUrl) ? fromUrl : undefined;
	// Wait for a returning wallet to reconnect, so the page doesn't pin the default network first.
	const settled = status !== "reconnecting" && status !== "connecting";

	useEffect(() => {
		if (pinned || !settled) return;
		setParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.set("chain", String(walletChain));
				return next;
			},
			{ replace: true }
		);
	}, [pinned, settled, walletChain, setParams]);

	return pinned ?? (walletChain as AppChainId);
}
