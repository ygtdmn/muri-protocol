import { useState } from "react";
import { useReadContract } from "wagmi";
import type { Address } from "viem";
import { muriAbi } from "../abis/muri-abi";
import { MURI_ADDRESS } from "../lib/muri";
import { toGatewayUrl } from "../hooks/useLinkHealth";
import { useCollectionTokens } from "../hooks/useCollectionTokens";
import type { CollectionToken } from "../hooks/useCollectionTokens";
import type { AppChainId } from "../lib/chains";
import { Button, LoadingLine, Notice } from "./ui";

const PAGE = 12;

/** The token's thumbnail as MURI serves it: on-chain data URI, or its selected thumbnail link. */
function Thumbnail({ creator, id, chainId }: { creator: Address; id: bigint; chainId: AppChainId }) {
	const [failed, setFailed] = useState(false);
	const image = useReadContract({
		abi: muriAbi,
		address: MURI_ADDRESS,
		functionName: "renderImage",
		args: [creator, id],
		chainId,
		query: { staleTime: 5 * 60_000 },
	});
	const src = image.data ? (image.data.startsWith("data:") ? image.data : toGatewayUrl(image.data)) : undefined;

	return (
		<div className="relative aspect-square overflow-hidden bg-background">
			{src && !failed ? (
				<img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 w-full h-full object-cover" />
			) : (
				<span className="absolute inset-0 grid place-items-center micro text-faint">
					{image.isLoading ? "…" : "No preview"}
				</span>
			)}
		</div>
	);
}

function Card({
	creator,
	chainId,
	token,
	selected,
	onSelect,
}: {
	creator: Address;
	chainId: AppChainId;
	token: CollectionToken;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			aria-pressed={selected}
			className={`flex flex-col text-left border transition-colors ${
				selected ? "border-foreground" : "border-line hover:border-muted"
			}`}
		>
			<Thumbnail creator={creator} id={token.id} chainId={chainId} />
			<span className="flex flex-col gap-1 px-3 py-2.5">
				<span className="text-[14px] truncate">{token.name || "Untitled"}</span>
				<span className="micro text-faint tabular-nums">
					#{token.id.toString()} · {token.copies} cop{token.copies === 1 ? "y" : "ies"}
					{token.balance !== undefined && token.balance > 1n ? ` · ×${token.balance}` : ""}
				</span>
			</span>
		</button>
	);
}

/**
 * The MURI tokens in a collection, as a grid to pick from. Found by walking the collection's token
 * IDs with batched reads from public RPCs. Pass `owner` to show only tokens that wallet holds.
 */
export default function TokenBrowser({
	creator,
	type,
	chainId,
	owner,
	selectedId,
	onSelect,
	emptyLabel = "No MURI tokens in this collection on this network yet.",
}: {
	creator: Address;
	type: "ERC721" | "ERC1155";
	chainId: AppChainId;
	owner?: Address;
	selectedId?: string;
	onSelect: (id: string) => void;
	emptyLabel?: string;
}) {
	const scan = useCollectionTokens(creator, type, owner, chainId);
	const [showAll, setShowAll] = useState(false);

	if (scan.isLoading) return <LoadingLine label="Looking through the collection" />;
	if (scan.error) {
		return (
			<Notice
				tone="caution"
				title="Couldn't list the collection"
				action={
					<Button size="sm" variant="ghost" onClick={() => void scan.refetch()}>
						Try again →
					</Button>
				}
			>
				The network didn't answer. You can still enter a token ID above.
			</Notice>
		);
	}
	if (!scan.data) return null;

	const tokens = owner
		? scan.data.tokens.filter((t) =>
				type === "ERC721" ? t.owner?.toLowerCase() === owner.toLowerCase() : (t.balance ?? 0n) > 0n
			)
		: scan.data.tokens;
	const shown = showAll ? tokens : tokens.slice(0, PAGE);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-baseline justify-between gap-4">
				<span className="text-[13px] text-muted">
					{tokens.length} MURI token{tokens.length === 1 ? "" : "s"}
					{owner ? " you own" : ""}
					<span className="text-faint">
						{" "}
						· {scan.data.existing} token{scan.data.existing === 1 ? "" : "s"} checked in this collection
					</span>
				</span>
				<Button size="sm" variant="ghost" loading={scan.isFetching} onClick={() => void scan.refetch()}>
					Rescan
				</Button>
			</div>
			{tokens.length === 0 ? (
				<p className="text-[13px] text-muted border-y border-line py-4">{emptyLabel}</p>
			) : (
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
					{shown.map((t) => (
						<Card
							key={t.id.toString()}
							creator={creator}
							chainId={chainId}
							token={t}
							selected={selectedId === t.id.toString()}
							onSelect={() => onSelect(t.id.toString())}
						/>
					))}
				</div>
			)}
			{tokens.length > PAGE && (
				<div>
					<Button size="sm" variant="ghost" onClick={() => setShowAll((s) => !s)}>
						{showAll ? "Show fewer" : `Show all ${tokens.length}`}
					</Button>
				</div>
			)}
		</div>
	);
}
