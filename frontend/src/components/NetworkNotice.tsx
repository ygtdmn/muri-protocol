import { useConnection, useSwitchChain } from "wagmi";
import { chainName } from "../lib/chains";
import type { AppChainId } from "../lib/chains";
import { Button, Notice } from "./ui";

/** Shown when the wallet sits on a different network from the page. Writes switch it anyway. */
export default function NetworkNotice({ chainId }: { chainId: AppChainId }) {
	const { isConnected, chainId: walletChain } = useConnection();
	const { mutate: switchChain, isPending } = useSwitchChain();
	if (!isConnected || !walletChain || walletChain === chainId) return null;
	return (
		<Notice
			tone="neutral"
			action={
				<Button size="sm" variant="ghost" loading={isPending} onClick={() => switchChain({ chainId })}>
					Switch to {chainName(chainId)} →
				</Button>
			}
		>
			This page is on {chainName(chainId)} and your wallet is on {chainName(walletChain)}. Your wallet
			will be asked to switch when you make a change.
		</Notice>
	);
}
