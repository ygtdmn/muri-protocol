import { useEffect, useMemo, useRef, useState } from "react";
import { useConnection } from "wagmi";
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
import AttributesEditor from "../components/AttributesEditor";
import { TxFeedback } from "../components/TxFeedback";
import {
	Button,
	ButtonLink,
	Choice,
	Disclosure,
	Dropzone,
	Field,
	Input,
	Loader,
	LoadingLine,
	Notice,
	PageTitle,
	Rule,
	Section,
	StatusLabel,
	Textarea,
} from "../components/ui";
import { useMuriToken } from "../hooks/useMuriToken";
import type { MuriToken } from "../hooks/useMuriToken";
import { useMuriTransaction } from "../hooks/useMuriTransaction";
import { usePageChain } from "../hooks/usePageChain";
import { useIsCollectionAdmin } from "../hooks/useIsCollectionAdmin";
import {
	ARTIST_PERMISSIONS,
	DISPLAY_MODES,
	MURI_ADDRESS,
	buildMetadataFields,
	formatBytes,
	hasPermission,
	parseMetadata,
	parseMetadataFields,
	prepareHtmlTemplate,
	prepareOnChainThumbnail,
	shortAddress,
} from "../lib/muri";
import { uriProblem } from "../lib/uri";
import { chainName } from "../lib/chains";
import type { AppChainId } from "../lib/chains";
import { deployPointer } from "../lib/sstore2";
import { requireTerms } from "../lib/terms";
import { describeContractError } from "../utils/rpcErrors";
import type { StoredFile } from "../lib/storage";
import type { Attribute, PermissionKey, PreparedTemplate, PreparedThumbnail } from "../lib/muri";
import {
	getThumbnailAcceptAttribute,
	getUnsupportedThumbnailMessage,
	isThumbnailSupported,
} from "../utils/fileValidation";

type Tx = ReturnType<typeof useMuriTransaction>;

interface EditorProps {
	creator: Address;
	tokenId: bigint;
	token: MuriToken;
	tx: Tx;
	chainId: AppChainId;
}

function ArtworkUris({ creator, tokenId, token, tx }: EditorProps) {
	const [newUri, setNewUri] = useState("");
	// Copies uploaded from this page, kept until they're on the token so a failed or rejected
	// add-transaction never loses a paid upload.
	const [uploaded, setUploaded] = useState<StoredFile[]>([]);
	// Direct mode: the link to display again after a removal shuffles the list.
	const reselect = useRef<{ uri: string; length: number } | undefined>(undefined);
	const canEdit = hasPermission(token.flags, "artistAddRemove");
	const canChoose = hasPermission(token.flags, "artistChooseUris");
	const invalid = newUri.trim() ? uriProblem(newUri.trim()) : null;
	const pending = uploaded.filter((u) => !token.artistUris.includes(u.uri));

	useEffect(() => {
		if (tx.state.action === "add-uri" && tx.state.phase === "confirmed") setNewUri("");
	}, [tx.state.action, tx.state.phase]);

	const add = (uri: string) =>
		tx.run("add-uri", {
			abi: muriAbi,
			address: MURI_ADDRESS,
			functionName: "addArtworkUris",
			args: [creator, tokenId, [uri]],
		});

	const select = (i: number) =>
		tx.run("select-uri", {
			abi: muriAbi,
			address: MURI_ADDRESS,
			functionName: "setSelectedUri",
			args: [creator, tokenId, BigInt(i)],
		});

	// The contract removes by moving the last link into the gap, then clamps the selection to the
	// new length. In direct mode that can change which link marketplaces load, so predict it.
	const removalShiftsDisplay = (i: number) => {
		const list = [...token.artistUris];
		const displayed = list[token.selectedArtistUriIndex];
		list[i] = list[list.length - 1];
		list.pop();
		const nextIndex = Math.min(token.selectedArtistUriIndex, Math.max(list.length - 1, 0));
		return token.displayMode === 0 && i !== token.selectedArtistUriIndex && list[nextIndex] !== displayed;
	};

	const remove = (i: number) => {
		reselect.current =
			removalShiftsDisplay(i) && canChoose
				? { uri: token.artistUris[token.selectedArtistUriIndex], length: token.artistUris.length - 1 }
				: undefined;
		void tx.run("remove-uri", {
			abi: muriAbi,
			address: MURI_ADDRESS,
			functionName: "removeArtworkUris",
			args: [creator, tokenId, [BigInt(i)]],
		});
	};

	// Once the removal is confirmed and the token re-read, put the displayed link back.
	useEffect(() => {
		const want = reselect.current;
		if (!want || tx.busy || tx.state.action !== "remove-uri") return;
		if (tx.state.phase === "failed") {
			reselect.current = undefined;
			return;
		}
		if (tx.state.phase !== "confirmed" || token.artistUris.length !== want.length) return;
		reselect.current = undefined;
		const j = token.artistUris.indexOf(want.uri);
		if (j >= 0 && j !== token.selectedArtistUriIndex) void select(j);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tx.state.action, tx.state.phase, tx.busy, token.artistUris, token.selectedArtistUriIndex]);

	return (
		<Section
			title="Artwork URIs"
			description={
				token.displayMode === 1
					? "Smart HTML tries these in order, then the owners' URIs."
					: "Direct mode serves the displayed URI only."
			}
		>
			<div className="flex flex-col gap-8">
				<UriList
					uris={token.artistUris}
					selectedIndex={token.selectedArtistUriIndex}
					showSelection={token.displayMode === 0 && canChoose}
					busy={tx.busy}
					onSelect={(i) => void select(i)}
					onRemove={canEdit && token.artistUris.length > 1 ? remove : undefined}
				/>
				{canEdit && token.artistUris.length > 1 && (
					<p className="text-[12px] text-faint -mt-5">
						Removing a URI moves the last one into its slot.
						{token.displayMode === 0 &&
							(canChoose
								? " If that changes the displayed link, you'll be asked to display it again in a second transaction."
								: " In direct mode that can change which link is displayed.")}
					</p>
				)}
				<TxFeedback state={tx.state} action="select-uri" />
				<TxFeedback state={tx.state} action="remove-uri" />

				{canEdit ? (
					<>
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
									aria-label="New artwork URI"
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
						<Rule label="Or upload another copy" />
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
						<TxFeedback state={tx.state} action="add-uri" successMessage="Link added." />
					</>
				) : (
					<StatusLabel tone="neutral">Adding and removing URIs is revoked</StatusLabel>
				)}

				{token.collectorUris.length > 0 && (
					<div className="flex flex-col gap-3">
						<Rule label={`Added by owners · ${token.collectorUris.length}`} />
						<UriList uris={token.collectorUris} />
					</div>
				)}
			</div>
		</Section>
	);
}

function DisplayMode({ creator, tokenId, token, tx }: EditorProps) {
	const [mode, setMode] = useState(token.displayMode);
	useEffect(() => setMode(token.displayMode), [token.displayMode]);

	return (
		<Section title="Display mode">
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
				<div className="pt-3 flex flex-col gap-3">
					<div>
						<Button
							variant="secondary"
							disabled={mode === token.displayMode || tx.busy}
							onClick={() =>
								void tx.run("display-mode", {
									abi: muriAbi,
									address: MURI_ADDRESS,
									functionName: "setDisplayMode",
									args: [creator, tokenId, mode],
								})
							}
						>
							Save display mode
						</Button>
					</div>
					<TxFeedback state={tx.state} action="display-mode" />
				</div>
			</div>
		</Section>
	);
}

function Metadata({ creator, tokenId, token, tx }: EditorProps) {
	const parsed = useMemo(() => parseMetadata(token.metadata), [token.metadata]);
	const [name, setName] = useState(parsed.name);
	const [description, setDescription] = useState(parsed.description);
	const [attributes, setAttributes] = useState<Attribute[]>(parsed.attributes);

	useEffect(() => {
		setName(parsed.name);
		setDescription(parsed.description);
		setAttributes(parsed.attributes);
	}, [parsed]);

	// Fields this form doesn't show (and attribute details like display_type) ride along unchanged.
	const original = useMemo(
		() => buildMetadataFields(parsed.name, parsed.description, parsed.attributes, parsed.rest),
		[parsed]
	);
	const fields = buildMetadataFields(name, description, attributes, parsed.rest);

	return (
		<Section title="Metadata" description="Anything else in the token's metadata that isn't shown here is kept as it is.">
			<form
				className="flex flex-col gap-6"
				onSubmit={(e) => {
					e.preventDefault();
					void tx.run("metadata", {
						abi: muriAbi,
						address: MURI_ADDRESS,
						functionName: "updateMetadata",
						args: [creator, tokenId, fields],
					});
				}}
			>
				<Field label="Title" htmlFor="update-name">
					<Input id="update-name" value={name} onChange={(e) => setName(e.target.value)} />
				</Field>
				<Field label="Description" htmlFor="update-description" optional>
					<Textarea id="update-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
				</Field>
				<AttributesEditor attributes={attributes} onChange={setAttributes} />
				<div>
					<Button type="submit" variant="secondary" disabled={!fields || fields === original || tx.busy}>
						Save metadata
					</Button>
				</div>
				<TxFeedback state={tx.state} action="metadata" />
			</form>
		</Section>
	);
}

function Thumbnail({ creator, tokenId, token, tx, chainId }: EditorProps) {
	const [prepared, setPrepared] = useState<PreparedThumbnail | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [uris, setUris] = useState<string[]>([...token.thumbnailUris]);
	const [selected, setSelected] = useState(token.selectedThumbnailIndex);
	const [newUri, setNewUri] = useState("");
	const newUriProblem = newUri.trim() ? uriProblem(newUri.trim()) : null;
	const [step, setStep] = useState<string | null>(null);
	const [stepError, setStepError] = useState<string | null>(null);
	// Data contracts already deployed, by network and chunk, so a retry doesn't pay for them twice.
	const deployed = useRef(new Map<string, Address>());

	// updateThumbnail overwrites the chunk list it writes with the one passed in, so passing the
	// chunks themselves leaves the token with no thumbnail. Store each chunk in its own data
	// contract first, then hand the contract their addresses (plus the 1-byte placeholder chunk
	// it insists on, which the same overwrite discards).
	const saveOnChain = async () => {
		if (!prepared || step) return;
		if (!(await requireTerms())) return;
		setStepError(null);
		try {
			const pointers: Address[] = [];
			for (const [i, chunk] of prepared.chunks.entries()) {
				const key = `${chainId}:${chunk}`;
				let pointer = deployed.current.get(key);
				if (!pointer) {
					setStep(`Storing part ${i + 1} of ${prepared.chunks.length}. Confirm in your wallet, then wait for it to land.`);
					pointer = await deployPointer(chainId, chunk);
					deployed.current.set(key, pointer);
				}
				pointers.push(pointer);
			}
			setStep(null);
			await tx.run("thumbnail", {
				abi: muriAbi,
				address: MURI_ADDRESS,
				functionName: "updateThumbnail",
				args: [
					creator,
					tokenId,
					{
						kind: 0,
						onChain: { mimeType: prepared.mimeType, chunks: pointers, zipped: true },
						offChain: { uris: [], selectedUriIndex: 0n },
					},
					["0x00"],
				],
			});
		} catch (e) {
			setStep(null);
			setStepError(describeContractError(e));
		}
	};

	useEffect(() => {
		setUris([...token.thumbnailUris]);
		setSelected(token.selectedThumbnailIndex);
	}, [token.thumbnailUris, token.selectedThumbnailIndex]);

	const changed =
		uris.join("\n") !== token.thumbnailUris.join("\n") || selected !== token.selectedThumbnailIndex;

	return (
		<Section
			title="Thumbnail"
			description={token.isOnChainThumbnail ? "Stored on-chain." : "Loaded from URIs."}
		>
			{token.isOnChainThumbnail ? (
				<div className="flex flex-col gap-4">
					<Dropzone
						compact
						accept={getThumbnailAcceptAttribute()}
						title={prepared ? prepared.file.name : "Drop a new thumbnail"}
						hint={
							prepared
								? `${formatBytes(prepared.storedBytes)} after compression · ${prepared.chunks.length} chunk(s)`
								: "Image, 60 KB max."
						}
						error={error}
						onFile={async (f) => {
							setError(null);
							if (!isThumbnailSupported(f)) return setError(getUnsupportedThumbnailMessage(f));
							try {
								setPrepared(await prepareOnChainThumbnail(f));
							} catch (e) {
								setError(e instanceof Error ? e.message : "Couldn't read the image.");
							}
						}}
					/>
					{prepared && (
						<p className="text-[13px] text-muted">
							Saving takes {prepared.chunks.length + 1} transactions: {prepared.chunks.length === 1 ? "one" : prepared.chunks.length} to
							store the image data, then one to point the token at it.
						</p>
					)}
					<div>
						<Button
							variant="secondary"
							disabled={!prepared || tx.busy || Boolean(step)}
							loading={Boolean(step)}
							onClick={() => void saveOnChain()}
						>
							Save thumbnail
						</Button>
					</div>
					{step && (
						<p className="flex items-center gap-3 text-[13px] text-muted" role="status">
							<Loader />
							{step}
						</p>
					)}
					{stepError && (
						<Notice tone="signal" title="Failed">
							{stepError} Parts already stored are kept, so trying again only sends what's missing.
						</Notice>
					)}
				</div>
			) : (
				<div className="flex flex-col gap-5">
					{uris.length > 0 ? (
						<ol className="flex flex-col border-t border-line">
							{uris.map((uri, i) => (
								<li key={`${i}-${uri}`} className="flex items-start gap-4 py-3 border-b border-line">
									<span className="micro text-faint tabular-nums pt-[3px]">{String(i).padStart(2, "0")}</span>
									<span className="flex-1 min-w-0 font-mono text-[12px] break-all">{uri}</span>
									{selected === i ? (
										<span className="micro text-foreground">Selected</span>
									) : (
										<button type="button" onClick={() => setSelected(i)} className="micro text-muted hover:text-foreground">
											Select
										</button>
									)}
									<button
										type="button"
										onClick={() => {
											setUris(uris.filter((_, j) => j !== i));
											setSelected((s) => (s >= i && s > 0 ? s - 1 : s));
										}}
										className="micro text-muted hover:text-signal"
									>
										Remove
									</button>
								</li>
							))}
						</ol>
					) : (
						<p className="text-[13px] text-muted">No thumbnail URIs.</p>
					)}
					<div className="flex flex-col sm:flex-row gap-3">
						<Input
							aria-label="New thumbnail URI"
							className="font-mono text-[13px] flex-1"
							placeholder="https://…"
							value={newUri}
							onChange={(e) => setNewUri(e.target.value)}
							spellCheck={false}
						/>
						<Button
							variant="ghost"
							disabled={!newUri.trim() || Boolean(newUriProblem)}
							onClick={() => {
								setUris([...uris, newUri.trim()]);
								setNewUri("");
							}}
						>
							+ Add to list
						</Button>
					</div>
					{newUriProblem && <p className="text-[13px] text-signal -mt-2">{newUriProblem}</p>}
					<div>
						<Button
							variant="secondary"
							disabled={!changed || uris.length === 0 || tx.busy}
							onClick={() =>
								void tx.run("thumbnail", {
									abi: muriAbi,
									address: MURI_ADDRESS,
									functionName: "updateThumbnail",
									args: [
										creator,
										tokenId,
										{
											kind: 1,
											onChain: { mimeType: "", chunks: [], zipped: false },
											offChain: { uris, selectedUriIndex: BigInt(Math.min(selected, uris.length - 1)) },
										},
										[],
									],
								})
							}
						>
							Save thumbnail URIs
						</Button>
					</div>
				</div>
			)}
			<div className="pt-4">
				<TxFeedback state={tx.state} action="thumbnail" />
			</div>
		</Section>
	);
}

function Template({ creator, tokenId, token, tx }: EditorProps) {
	const [prepared, setPrepared] = useState<PreparedTemplate | null>(null);
	const [error, setError] = useState<string | null>(null);

	return (
		<Section title="Advanced" panel={false}>
			<Disclosure
				title="HTML template"
				summary={
					token.hasCustomTemplate
						? "This token uses its own Smart HTML page."
						: "This token uses the shared default Smart HTML page."
				}
			>
			<div className="flex flex-col gap-4">
				<p className="text-[13px] text-muted leading-relaxed max-w-[60ch]">
					The page Smart HTML mode renders: it tries each URI and checks the file hash. Replace it only if
					you need custom behaviour.
				</p>
				<Dropzone
					compact
					accept=".html,.htm"
					title={prepared ? prepared.file.name : "Drop a new template"}
					hint={
						prepared
							? `${formatBytes(prepared.bytes)} · ${prepared.chunks.length} chunk(s)`
							: "Must contain {{FILE_URIS}} and {{FILE_HASH}}. Keep them out of <script>: the default template puts them in a closing <plaintext> element so no URI can break the page."
					}
					error={error}
					onFile={async (f) => {
						setError(null);
						try {
							setPrepared(await prepareHtmlTemplate(f));
						} catch (e) {
							setError(e instanceof Error ? e.message : "Couldn't read the template.");
						}
					}}
				/>
				<div>
					<Button
						variant="secondary"
						disabled={!prepared || tx.busy}
						onClick={() =>
							prepared &&
							void tx.run("template", {
								abi: muriAbi,
								address: MURI_ADDRESS,
								functionName: "updateHtmlTemplate",
								args: [creator, tokenId, prepared.chunks, false],
							})
						}
					>
						Save template
					</Button>
				</div>
				<TxFeedback state={tx.state} action="template" />
			</div>
			</Disclosure>
		</Section>
	);
}

function Permissions({ creator, tokenId, token, tx }: EditorProps) {
	const [revoke, setRevoke] = useState<Set<PermissionKey>>(new Set());
	const [confirmAll, setConfirmAll] = useState(false);
	const granted = ARTIST_PERMISSIONS.filter((p) => hasPermission(token.flags, p.key));

	useEffect(() => setRevoke(new Set()), [token.flags]);

	return (
		<Section
			title="Permissions"
			description="Revoking removes you as a point of failure. MURI has no way to grant a permission back. As a collection admin you keep low-level control of the collection itself; the Terms explain what that means."
		>
			<div className="flex flex-col gap-8">
				{granted.length === 0 ? (
					<p className="text-muted">All artist permissions are revoked. This token is fixed for the artist.</p>
				) : (
					<>
						<div className="flex flex-col gap-2">
							<span className="micro text-muted mb-1">Revoke selected</span>
							{ARTIST_PERMISSIONS.map((p) => {
								const has = hasPermission(token.flags, p.key);
								return (
									<Choice
										key={p.key}
										compact
										type="checkbox"
										disabled={!has}
										checked={revoke.has(p.key)}
										onChange={(on) =>
											setRevoke((prev) => {
												const next = new Set(prev);
												if (on) next.add(p.key);
												else next.delete(p.key);
												return next;
											})
										}
										title={p.label}
										meta={has ? undefined : "Revoked"}
									/>
								);
							})}
						</div>
						<div className="flex flex-col gap-3">
							<div>
								<Button
									variant="danger"
									disabled={revoke.size === 0 || tx.busy}
									onClick={() =>
										void tx.run("revoke", {
											abi: muriAbi,
											address: MURI_ADDRESS,
											functionName: "revokeArtistPermissions",
											args: [
												creator,
												tokenId,
												revoke.has("artistUpdateThumb"),
												revoke.has("artistUpdateMeta"),
												revoke.has("artistChooseUris"),
												revoke.has("artistAddRemove"),
												revoke.has("artistChooseThumb"),
												revoke.has("artistUpdateMode"),
												revoke.has("artistUpdateTemplate"),
											],
										})
									}
								>
									Revoke {revoke.size || ""} permanently
								</Button>
							</div>
							<TxFeedback state={tx.state} action="revoke" successMessage="Permissions revoked." />
						</div>

						<Rule label="Revoke everything" />
						<div className="flex flex-col gap-4">
							<p className="text-[13px] text-muted leading-relaxed max-w-[60ch]">
								Removes every artist permission at once. Owners keep whatever permissions they have, so
								they can still add backups if you allowed it.
							</p>
							<Choice
								compact
								type="checkbox"
								checked={confirmAll}
								onChange={setConfirmAll}
								title="I understand this is permanent."
							/>
							<div>
								<Button
									variant="danger"
									disabled={!confirmAll || tx.busy}
									onClick={() =>
										void tx.run("revoke-all", {
											abi: muriAbi,
											address: MURI_ADDRESS,
											functionName: "revokeAllArtistPermissions",
											args: [creator, tokenId],
										})
									}
								>
									Revoke all artist permissions
								</Button>
							</div>
							<TxFeedback state={tx.state} action="revoke-all" successMessage="All artist permissions revoked." />
						</div>
					</>
				)}
			</div>
		</Section>
	);
}

export default function Update() {
	const [params, setParams] = useSearchParams();
	const creator = (params.get("creator") ?? "") as Address;
	const type = params.get("type") ?? "";
	const [tokenInput, setTokenInput] = useState(params.get("token") ?? "");
	const [browsing, setBrowsing] = useState(false);
	const collectionType = type === "ERC721" || type === "ERC1155" ? type : undefined;
	const { isConnected } = useConnection();
	const chainId = usePageChain();
	const isAdmin = useIsCollectionAdmin(isAddress(creator) ? creator : undefined, chainId);
	const { tokenId, isValidId, token, notFound, isLoading, error, refetch } = useMuriToken(
		isAddress(creator) ? creator : undefined,
		tokenInput,
		chainId
	);
	const tx = useMuriTransaction(() => void refetch(), chainId);

	// Keep the token in the URL so the page can be shared and reloaded.
	useEffect(() => {
		const next = new URLSearchParams(params);
		if (isValidId) next.set("token", tokenInput.trim());
		else next.delete("token");
		if (next.toString() !== params.toString()) setParams(next, { replace: true });
	}, [tokenInput, isValidId, params, setParams]);

	if (!isAddress(creator)) {
		return (
			<Layout>
				<PageTitle title="Pick a collection first">
					<ButtonLink to="/collections?role=creator">Choose a collection →</ButtonLink>
				</PageTitle>
			</Layout>
		);
	}

	const meta = token ? parseMetadataFields(token.metadata) : undefined;
	// The contract treats a non-admin as the token's owner, so artist edits from that wallet would
	// land on the owners' side of the token. Only show the editors to admins (or before connecting).
	const notAdmin = isConnected && isAdmin === false;
	const editorProps =
		token && tokenId !== undefined && !notAdmin ? { creator, tokenId, token, tx, chainId } : undefined;
	const locked = token ? ARTIST_PERMISSIONS.filter((p) => !hasPermission(token.flags, p.key)) : [];

	return (
		<Layout>
			<div className="flex flex-col gap-14">
				<PageTitle
					back={
						<Link to="/collections?role=creator" className="hover:text-foreground transition-colors">
							← {type || "Collection"} · {shortAddress(creator)} · {chainName(chainId)}
						</Link>
					}
					title={meta?.name ? meta.name : "Manage a token"}
				>
					Change what the artwork points to, how it displays, and who can change it next.
				</PageTitle>

				<div className="flex flex-col gap-6 md:gap-8">
					<Section title="Token">
						<div className="flex flex-col gap-5">
							<div className="grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-end">
								<Field label="Token ID" htmlFor="update-token">
									<Input
										id="update-token"
										inputMode="numeric"
										placeholder="1"
										value={tokenInput}
										onChange={(e) => setTokenInput(e.target.value.replace(/[^\d]/g, ""))}
										autoFocus={!tokenInput}
									/>
								</Field>
								<div className="sm:pb-3">
									{isLoading ? (
										<LoadingLine label="Reading token" />
									) : notFound ? (
										<StatusLabel tone="signal">Not a MURI token in this collection</StatusLabel>
									) : token ? (
										<StatusLabel tone="up">
											{token.artistUris.length + token.collectorUris.length} URIs ·{" "}
											{token.displayMode === 1 ? "Smart HTML" : "Direct"}
										</StatusLabel>
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
									<span className="micro text-muted">In this collection</span>
									<TokenBrowser
										creator={creator}
										type={collectionType}
										chainId={chainId}
										selectedId={isValidId ? tokenInput.trim() : undefined}
										onSelect={(id) => {
											setTokenInput(id);
											setBrowsing(false);
										}}
									/>
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
									<p className="text-[13px] text-muted">Connect the collection admin wallet to make changes.</p>
									<ConnectWallet />
								</div>
							)}
							{token && notAdmin && (
								<Notice
									tone="caution"
									title="This wallet isn't an admin of the collection"
									action={
										<ButtonLink size="sm" variant="ghost" to={`/collector-zone?${params}`}>
											Open in Preserve →
										</ButtonLink>
									}
								>
									The contract treats it as an owner of the token, so changes from here would apply to the
									owners' side. Connect an admin wallet to manage the artist's side, or manage your own copies
									from Preserve.
								</Notice>
							)}
							<NetworkNotice chainId={chainId} />
							{token && locked.length > 0 && (
								<p className="text-[13px] text-muted border-t border-line pt-5">
									Revoked: {locked.map((p) => p.label.toLowerCase()).join(", ")}.
								</p>
							)}
						</div>
					</Section>

					{editorProps &&
						token &&
						[
							{ key: "uris", Editor: ArtworkUris, show: true },
							{ key: "mode", Editor: DisplayMode, show: hasPermission(token.flags, "artistUpdateMode") },
							{ key: "meta", Editor: Metadata, show: hasPermission(token.flags, "artistUpdateMeta") },
							{ key: "thumb", Editor: Thumbnail, show: hasPermission(token.flags, "artistUpdateThumb") },
							{ key: "perms", Editor: Permissions, show: true },
							{ key: "template", Editor: Template, show: hasPermission(token.flags, "artistUpdateTemplate") },
						]
							.filter((e) => e.show)
							// Keyed by token too, so nothing half-edited carries over to another token.
							.map(({ key, Editor }) => <Editor key={`${key}-${tokenId}`} {...editorProps} />)}
				</div>
			</div>
		</Layout>
	);
}
