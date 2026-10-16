import { useEffect, useState } from "react";
import { useConnection, useReadContract } from "wagmi";
import { Link, useSearchParams } from "react-router-dom";
import { isAddress } from "viem";
import type { Address } from "viem";
import NetworkNotice from "../components/NetworkNotice";
import { muriAbi } from "../abis/muri-abi";
import Layout from "../components/Layout";
import ConnectWallet from "../components/ConnectWallet";
import TokenBrowser from "../components/TokenBrowser";
import UriList from "../components/UriList";
import StorageUploader from "../components/StorageUploader";
import { TxFeedback } from "../components/TxFeedback";
import {
	Button,
	ButtonLink,
	Choice,
	Field,
	Input,
	LoadingLine,
	Notice,
	PageTitle,
	Rule,
	Section,
	StatusLabel,
} from "../components/ui";
import { useMuriToken } from "../hooks/useMuriToken";
import { useMuriTransaction } from "../hooks/useMuriTransaction";
import { usePageChain } from "../hooks/usePageChain";
import { useIsCollectionAdmin } from "../hooks/useIsCollectionAdmin";
import { uriProblem } from "../lib/uri";
import { chainName } from "../lib/chains";
import type { AppChainId } from "../lib/chains";
import type { StoredFile } from "../lib/storage";
import {
	COLLECTOR_PERMISSIONS,
	DISPLAY_MODES,
	MURI_ADDRESS,
	hasPermission,
	parseMetadataFields,
	shortAddress,
} from "../lib/muri";

const ownershipAbi = [
	{
		type: "function",
		name: "ownerOf",
		inputs: [{ name: "tokenId", type: "uint256" }],
		outputs: [{ name: "", type: "address" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "balanceOf",
		inputs: [
			{ name: "account", type: "address" },
			{ name: "id", type: "uint256" },
		],
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
	},
] as const;

function useOwnership(creator: Address | undefined, type: string, tokenId: bigint | undefined, chainId: AppChainId) {
	const { address } = useConnection();
	const enabled = Boolean(creator && tokenId !== undefined && address);
	const owner721 = useReadContract({
		abi: ownershipAbi,
		address: creator,
		functionName: "ownerOf",
		args: tokenId !== undefined ? [tokenId] : undefined,
		chainId,
		query: { enabled: enabled && type === "ERC721" },
	});
	const balance1155 = useReadContract({
		abi: ownershipAbi,
		address: creator,
		functionName: "balanceOf",
		args: address && tokenId !== undefined ? [address, tokenId] : undefined,
		chainId,
		query: { enabled: enabled && type === "ERC1155" },
	});
	if (!enabled) return undefined;
	if (type === "ERC721") {
		return owner721.data ? owner721.data.toLowerCase() === address!.toLowerCase() : undefined;
	}
	return balance1155.data !== undefined ? balance1155.data > 0n : undefined;
}

export default function CollectorZone() {
	const [params, setParams] = useSearchParams();
	const creator = (params.get("creator") ?? "") as Address;
	const type = params.get("type") ?? "";
	const [tokenInput, setTokenInput] = useState(params.get("token") ?? "");
	const [browsing, setBrowsing] = useState(false);
	const [showAllTokens, setShowAllTokens] = useState(false);
	const collectionType = type === "ERC721" || type === "ERC1155" ? type : undefined;
	const [newUri, setNewUri] = useState("");
	const [mode, setMode] = useState(1);
	// Copies uploaded here, kept until they're on the token so a failed add never loses a paid upload.
	const [uploaded, setUploaded] = useState<StoredFile[]>([]);
	const { address, isConnected } = useConnection();
	const validCreator = isAddress(creator);
	const chainId = usePageChain();

	const { tokenId, isValidId, token, notFound, isLoading, error, refetch } = useMuriToken(
		validCreator ? creator : undefined,
		tokenInput,
		chainId
	);
	const owns = useOwnership(validCreator ? creator : undefined, type, tokenId, chainId);
	const isAdmin = useIsCollectionAdmin(validCreator ? creator : undefined, chainId);
	const tx = useMuriTransaction(() => void refetch(), chainId);

	useEffect(() => {
		if (token) setMode(token.displayMode);
	}, [token]);

	// Uploads and drafts belong to one token; start fresh when switching.
	const tokenKey = `${chainId}:${tokenId ?? ""}`;
	useEffect(() => {
		setUploaded([]);
		setNewUri("");
	}, [tokenKey]);

	useEffect(() => {
		if (tx.state.action === "add-uri" && tx.state.phase === "confirmed") setNewUri("");
	}, [tx.state.action, tx.state.phase]);

	useEffect(() => {
		const next = new URLSearchParams(params);
		if (isValidId) next.set("token", tokenInput.trim());
		else next.delete("token");
		if (next.toString() !== params.toString()) setParams(next, { replace: true });
	}, [tokenInput, isValidId, params, setParams]);

	if (!validCreator) {
		return (
			<Layout>
				<PageTitle title="Pick a collection first">
					<ButtonLink to="/collections?role=collector">Find a token →</ButtonLink>
				</PageTitle>
			</Layout>
		);
	}

	const meta = token ? parseMetadataFields(token.metadata) : undefined;
	// The contract treats an admin as the artist, so "owner" actions from an admin wallet would
	// change the artist's links instead. Admins manage the token from Update.
	const actsAsArtist = isConnected && isAdmin === true;
	const can = token && !actsAsArtist
		? {
				add: hasPermission(token.flags, "collectorAddRemove"),
				choose: hasPermission(token.flags, "collectorChooseUris") && token.displayMode === 0,
				mode: hasPermission(token.flags, "collectorUpdateMode"),
				thumb: hasPermission(token.flags, "collectorChooseThumb") && !token.isOnChainThumbnail && token.thumbnailUris.length > 0,
			}
		: undefined;
	const nothingAllowed = can && !can.add && !can.choose && !can.mode && !can.thumb;
	const id = tokenId ?? 0n;

	const add = (uri: string) =>
		tx.run("add-uri", {
			abi: muriAbi,
			address: MURI_ADDRESS,
			functionName: "addArtworkUris",
			args: [creator, id, [uri]],
		});

	const sections: { key: string; title: string; description?: string; body: React.ReactNode }[] = [];

	if (token && can?.add) {
		const invalid = newUri.trim() ? uriProblem(newUri.trim()) : null;
		const pending = uploaded.filter((u) => !token.collectorUris.includes(u.uri));
		sections.push({
			key: "backups",
			title: "Your backups",
			description:
				token.displayMode === 1
					? "Smart HTML tries these after the artist's links."
					: "Only used in Smart HTML mode. In direct mode the token shows one of the artist's links.",
			body: (
				<div className="flex flex-col gap-8">
					<UriList
						uris={token.collectorUris}
						busy={tx.busy}
						emptyLabel="You haven't added any backups yet."
						onRemove={(i) =>
							void tx.run("remove-uri", {
								abi: muriAbi,
								address: MURI_ADDRESS,
								functionName: "removeArtworkUris",
								args: [creator, id, [BigInt(i)]],
							})
						}
					/>
					<TxFeedback state={tx.state} action="remove-uri" />
					<Rule label="Add a link" />
					<form
						className="flex flex-col gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							if (!invalid && newUri.trim()) void add(newUri.trim());
						}}
					>
						<div className="flex flex-col sm:flex-row gap-3">
							<Input
								aria-label="Backup URI"
								className="font-mono text-[13px] flex-1"
								placeholder="https://…, ar://… or ipfs://…"
								value={newUri}
								onChange={(e) => setNewUri(e.target.value)}
								spellCheck={false}
							/>
							<Button type="submit" variant="secondary" disabled={!newUri.trim() || Boolean(invalid) || tx.busy}>
								Add
							</Button>
						</div>
						{invalid && <p className="text-[13px] text-signal">{invalid}</p>}
					</form>
					<Rule label="Or upload your own copy" />
					<StorageUploader
						expectedHash={token.fileHash}
						stored={uploaded}
						disabled={tx.busy}
						onStored={(s) => {
							setUploaded((prev) => [...prev, s]);
							void add(s.uri);
						}}
					/>
					{pending.length > 0 && (
						<Notice tone="caution" title="Uploaded, not on the token yet">
							<span className="flex flex-col gap-3">
								<span>These copies are stored and paid for. Add them to the token:</span>
								{pending.map((u) => (
									<span key={u.uri} className="flex flex-wrap items-center gap-3">
										<span className="font-mono text-[12px] break-all">{u.uri}</span>
										<Button size="sm" variant="secondary" disabled={tx.busy} onClick={() => void add(u.uri)}>
											Add to token
										</Button>
									</span>
								))}
							</span>
						</Notice>
					)}
					<TxFeedback state={tx.state} action="add-uri" successMessage="Backup added." />
				</div>
			),
		});
	}

	if (token && can?.mode) {
		sections.push({
			key: "mode",
			title: "Display mode",
			body: (
				<div className="flex flex-col gap-3" role="radiogroup" aria-label="Display mode">
					{DISPLAY_MODES.map((m) => (
						<Choice
							key={m.value}
							type="radio"
							name="display"
							checked={mode === m.value}
							onChange={() => setMode(m.value)}
							title={m.name}
							description={m.description}
							meta={token.displayMode === m.value ? "Current" : undefined}
						/>
					))}
					<div className="pt-3">
						<Button
							variant="secondary"
							disabled={mode === token.displayMode || tx.busy}
							onClick={() =>
								void tx.run("display-mode", {
									abi: muriAbi,
									address: MURI_ADDRESS,
									functionName: "setDisplayMode",
									args: [creator, id, mode],
								})
							}
						>
							Save display mode
						</Button>
					</div>
					<TxFeedback state={tx.state} action="display-mode" />
				</div>
			),
		});
	}

	if (token && can?.choose) {
		sections.push({
			key: "choose",
			title: "Displayed link",
			description: "Pick which of the artist's links marketplaces load.",
			body: (
				<div className="flex flex-col gap-4">
					<UriList
						uris={token.artistUris}
						selectedIndex={token.selectedArtistUriIndex}
						showSelection
						busy={tx.busy}
						onSelect={(i) =>
							void tx.run("select-uri", {
								abi: muriAbi,
								address: MURI_ADDRESS,
								functionName: "setSelectedUri",
								args: [creator, id, BigInt(i)],
							})
						}
					/>
					<TxFeedback state={tx.state} action="select-uri" />
				</div>
			),
		});
	}

	if (token && can?.thumb) {
		sections.push({
			key: "thumb",
			title: "Thumbnail",
			body: (
				<div className="flex flex-col gap-4">
					<UriList
						uris={token.thumbnailUris}
						selectedIndex={token.selectedThumbnailIndex}
						showSelection
						busy={tx.busy}
						onSelect={(i) =>
							void tx.run("select-thumb", {
								abi: muriAbi,
								address: MURI_ADDRESS,
								functionName: "setSelectedThumbnailUri",
								args: [creator, id, BigInt(i)],
							})
						}
					/>
					<TxFeedback state={tx.state} action="select-thumb" />
				</div>
			),
		});
	}

	return (
		<Layout>
			<div className="flex flex-col gap-14">
				<PageTitle
					back={
						<Link to="/collections?role=collector" className="hover:text-foreground transition-colors">
							← {type || "Collection"} · {shortAddress(creator)} · {chainName(chainId)}
						</Link>
					}
					title={meta?.name || "Preserve a token"}
				>
					Check the artwork's links and add your own copies, so the piece outlives any single host.
				</PageTitle>

				<div className="flex flex-col gap-6 md:gap-8">
					<Section title="Token">
						<div className="flex flex-col gap-5">
							<div className="grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-end">
								<Field label="Token ID" htmlFor="collector-token">
									<Input
										id="collector-token"
										inputMode="numeric"
										placeholder="1"
										value={tokenInput}
										onChange={(e) => setTokenInput(e.target.value.replace(/[^\d]/g, ""))}
										autoFocus={!tokenInput}
									/>
								</Field>
								<div className="sm:pb-3 flex flex-wrap gap-x-6 gap-y-2">
									{isLoading ? (
										<LoadingLine label="Reading token" />
									) : notFound ? (
										<StatusLabel tone="signal">Not a MURI token in this collection</StatusLabel>
									) : token ? (
										<>
											<StatusLabel tone="up">{token.displayMode === 1 ? "Smart HTML" : "Direct file"}</StatusLabel>
											{owns === true && <StatusLabel tone="up">You own this</StatusLabel>}
											{owns === false && <StatusLabel tone="caution">Not owned by this wallet</StatusLabel>}
										</>
									) : null}
								</div>
							</div>
							{error && (
								<Notice
									tone="signal"
									title="Couldn't read the token"
									action={
										<Button size="sm" variant="ghost" onClick={() => void refetch()}>
											Retry →
										</Button>
									}
								>
									{error.message.split("\n")[0]}
								</Notice>
							)}
							{collectionType && (!token || browsing ? (
								<div className="flex flex-col gap-4 border-t border-line pt-5">
									<div className="flex flex-wrap items-baseline justify-between gap-3">
										<span className="micro text-muted">
											{address && !showAllTokens ? "Your tokens in this collection" : "MURI tokens in this collection"}
										</span>
										{address && (
											<Button size="sm" variant="ghost" onClick={() => setShowAllTokens((v) => !v)}>
												{showAllTokens ? "Only mine" : "Show all"}
											</Button>
										)}
									</div>
									<TokenBrowser
										creator={creator}
										type={collectionType}
										chainId={chainId}
										owner={address && !showAllTokens ? address : undefined}
										selectedId={isValidId ? tokenInput.trim() : undefined}
										onSelect={(id) => {
											setTokenInput(id);
											setBrowsing(false);
										}}
										emptyLabel={
											address && !showAllTokens
												? "This wallet doesn't hold any MURI tokens from this collection on this network."
												: "No MURI tokens in this collection on this network yet."
										}
									/>
									{!address && (
										<div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
											<p className="text-[13px] text-muted">Connect to see only the tokens you own.</p>
											<ConnectWallet />
										</div>
									)}
								</div>
							) : (
								<div>
									<Button size="sm" variant="ghost" onClick={() => setBrowsing(true)}>
										Choose another token →
									</Button>
								</div>
							))}
							{token && !isConnected && (
								<div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between border-t border-line pt-5">
									<p className="text-[13px] text-muted">Connect the wallet that owns this token to make changes.</p>
									<ConnectWallet />
								</div>
							)}
							{token && actsAsArtist && (
								<Notice
									tone="caution"
									title="This wallet is an admin of the collection"
									action={
										<ButtonLink size="sm" variant="ghost" to={`/update?${params}`}>
											Open in Update →
										</ButtonLink>
									}
								>
									The contract treats it as the artist, so owner actions from it would change the artist's
									links instead. Manage this token from Update, or connect the owner's wallet.
								</Notice>
							)}
							<NetworkNotice chainId={chainId} />
							{token && (
								<dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2 border-t border-line pt-5">
									{COLLECTOR_PERMISSIONS.map((p) => (
										<div key={p.key} className="flex items-center justify-between gap-4">
											<dt className="text-[13px]">{p.label}</dt>
											<dd>
												<StatusLabel tone={hasPermission(token.flags, p.key) ? "up" : "neutral"}>
													{hasPermission(token.flags, p.key) ? "Allowed" : "Off"}
												</StatusLabel>
											</dd>
										</div>
									))}
								</dl>
							)}
						</div>
					</Section>

					{token && (
						<Section title="Artist's links" description="Checked from your browser just now.">
							<UriList uris={token.artistUris} selectedIndex={token.selectedArtistUriIndex} showSelection={token.displayMode === 0} />
						</Section>
					)}

					{sections.map((s) => (
						<Section key={s.key} title={s.title} description={s.description}>
							{s.body}
						</Section>
					))}

					{nothingAllowed && (
						<Notice tone="neutral" title="No owner permissions">
							The artist hasn't allowed owners to change this token. Everything is controlled from the
							artist's side.
						</Notice>
					)}
				</div>
			</div>
		</Layout>
	);
}
