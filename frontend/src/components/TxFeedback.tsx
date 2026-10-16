import { mainnet, sepolia, base } from "wagmi/chains";
import type { TxState } from "../hooks/useMuriTransaction";
import { phaseLabel } from "../hooks/useMuriTransaction";
import { Loader, Notice } from "./ui";

const explorers: Record<number, string> = {
	[mainnet.id]: "https://etherscan.io",
	[sepolia.id]: "https://sepolia.etherscan.io",
	[base.id]: "https://basescan.org",
};

export function TxLink({ hash, chainId }: { hash: string; chainId?: number }) {
	const explorer = chainId ? explorers[chainId] : undefined;
	if (!explorer) return <span className="font-mono text-[12px] break-all">{hash}</span>;
	return (
		<a
			href={`${explorer}/tx/${hash}`}
			target="_blank"
			rel="noopener noreferrer"
			className="link font-mono text-[12px] break-all"
		>
			View transaction ↗
		</a>
	);
}

/** Inline status for the action that owns this transaction. Renders nothing for other actions. */
export function TxFeedback({
	state,
	action,
	successMessage = "Saved on-chain.",
}: {
	state: TxState;
	action: string;
	successMessage?: string;
}) {
	if (state.action !== action || state.phase === "idle") return null;

	return (
		<div className="flex flex-col gap-3">
			{state.warning && <Notice tone="caution">{state.warning}</Notice>}
			{(state.phase === "checking" || state.phase === "signing" || state.phase === "confirming") && (
				<p className="flex items-center gap-3 text-muted" role="status">
					<Loader />
					<span className="micro">{phaseLabel[state.phase]}</span>
					{state.hash && <TxLink hash={state.hash} chainId={state.chainId} />}
				</p>
			)}
			{state.phase === "confirmed" && (
				<Notice tone="up" title="Confirmed">
					{successMessage} {state.hash && <TxLink hash={state.hash} chainId={state.chainId} />}
				</Notice>
			)}
			{state.phase === "failed" && state.error && (
				<Notice tone="signal" title="Failed">
					{state.error}
				</Notice>
			)}
		</div>
	);
}
