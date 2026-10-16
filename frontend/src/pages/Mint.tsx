import { useEffect, useMemo, useState } from "react";
import { useConnection } from "wagmi";
import { Link, useSearchParams } from "react-router-dom";
import { decodeEventLog, isAddress } from "viem";
import type { Address } from "viem";
import { muriExtensionAbi } from "../abis/muri-manifold-extension-abi";
import Layout from "../components/Layout";
import ConnectWallet from "../components/ConnectWallet";
import FilePreview from "../components/FilePreview";
import StorageUploader from "../components/StorageUploader";
import MintedView from "../components/MintedView";
import NetworkNotice from "../components/NetworkNotice";
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
	Notice,
	PageTitle,
	Rule,
	Section,
	StatusLabel,
	Textarea,
} from "../components/ui";
import { useMuriTransaction } from "../hooks/useMuriTransaction";
import { usePageChain } from "../hooks/usePageChain";
import { uriProblem } from "../lib/uri";
import { chainName } from "../lib/chains";
import {
	ARTIST_PERMISSIONS,
	COLLECTOR_PERMISSIONS,
	DISPLAY_MODES,
	MURI_EXTENSION_ADDRESS,
	PERMISSION,
	PERMISSION_PRESETS,
	buildMetadataFields,
	formatBytes,
	hashFile,
	prepareHtmlTemplate,
	prepareOnChainThumbnail,
	shortAddress,
} from "../lib/muri";
import type {
	Attribute,
	PermissionPreset,
	PreparedTemplate,
	PreparedThumbnail,
} from "../lib/muri";
import type { StoredFile } from "../lib/storage";
import {
	getAcceptAttribute,
	getFileInfo,
	getThumbnailAcceptAttribute,
	getUnsupportedFileMessage,
	getUnsupportedThumbnailMessage,
	isFileSupported,
	isThumbnailSupported,
	resolveMimeType,
} from "../utils/fileValidation";

const PRESETS: { id: PermissionPreset; name: string; description: string }[] = [
	{
		id: "collaborative",
		name: "Collaborative",
		description: "You and the token's owner can both add backups and choose what displays. Recommended for preservation.",
	},
	{
		id: "artist",
		name: "Artist only",
		description: "Only collection admins can change anything. Owners can't add backups.",
	},
	{
		id: "frozen",
		name: "Immutable",
		description: "Nobody can change anything. If every link dies, nobody can add a new one.",
	},
];

interface Artwork {
	file: File;
	hash: `0x${string}`;
	mimeType: string;
	isAnimation: boolean;
	/** Images can double as their own marketplace thumbnail; video, audio, HTML and 3D can't. */
	isImage: boolean;
}

/** "Not a valid link: …" for the first bad line in a list, or undefined. */
function listProblem(lines: string[]) {
	const bad = lines.map((uri) => ({ uri, problem: uriProblem(uri) })).filter((l) => l.problem);
	if (bad.length === 0) return undefined;
	return `${bad[0].uri}: ${bad[0].problem}${bad.length > 1 ? ` (+${bad.length - 1} more)` : ""}`;
}

export default function Mint() {
	const [params] = useSearchParams();
	const creator = (params.get("creator") ?? "") as Address;
	const type = params.get("type") === "ERC1155" ? "ERC1155" : "ERC721";
	const validCreator = isAddress(creator);

	const { address: connected, isConnected } = useConnection();
	const chainId = usePageChain();

	const [artwork, setArtwork] = useState<Artwork | null>(null);
	const [artworkError, setArtworkError] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [attributes, setAttributes] = useState<Attribute[]>([]);
	const [stored, setStored] = useState<StoredFile[]>([]);
	const [manualUris, setManualUris] = useState("");
	const [preset, setPreset] = useState<PermissionPreset>("collaborative");
	const [customize, setCustomize] = useState(false);
	const [customFlags, setCustomFlags] = useState<number>(PERMISSION_PRESETS.collaborative);
	const [recipient, setRecipient] = useState("");
	const [amount, setAmount] = useState("1");
	const [displayMode, setDisplayMode] = useState(1);
	const [onChainThumb, setOnChainThumb] = useState(false);
	const [thumbnailUris, setThumbnailUris] = useState("");
	const [thumbnail, setThumbnail] = useState<PreparedThumbnail | null>(null);
	const [thumbnailError, setThumbnailError] = useState<string | null>(null);
	const [template, setTemplate] = useState<PreparedTemplate | null>(null);
	const [templateError, setTemplateError] = useState<string | null>(null);
	const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);
	// The network the mint was sent on, so links stay right if the wallet switches afterwards.
	const [mintChainId, setMintChainId] = useState<number | null>(null);
	// Who the token went to, as sent, so switching accounts afterwards doesn't change the record.
	const [mintedRecipient, setMintedRecipient] = useState<Address | undefined>(undefined);
	// An upload is running: hold back minting and replacing the artwork until it settles.
	const [uploading, setUploading] = useState(false);

	const tx = useMuriTransaction(undefined, chainId);

	const pickArtwork = async (file: File) => {
		setArtworkError(null);
		if (!isFileSupported(file)) {
			setArtworkError(getUnsupportedFileMessage(file));
			return;
		}
		const mimeType = resolveMimeType(file);
		const hash = await hashFile(file);
		const isImage = getFileInfo(file).category === "image";
		const isStaticImage = isImage && !mimeType.includes("gif");
		setArtwork({ file, hash, mimeType, isAnimation: !isStaticImage, isImage });
		// Uploads belong to the previous file.
		setStored([]);
	};

	const manualList = useMemo(
		() => manualUris.split("\n").map((s) => s.trim()).filter(Boolean),
		[manualUris]
	);
	const manualProblem = listProblem(manualList);
	const uris = useMemo(() => [...stored.map((s) => s.uri), ...manualList], [stored, manualList]);
	const thumbnailList = thumbnailUris.split("\n").map((s) => s.trim()).filter(Boolean);
	const thumbnailProblem = listProblem(thumbnailList);
	// With no thumbnail of its own, the token's marketplace image is the artwork's own links, which
	// only works when the artwork is an image.
	const needsThumbnail = Boolean(artwork && !artwork.isImage && !onChainThumb && thumbnailList.length === 0);
	const flags = customize ? customFlags : PERMISSION_PRESETS[preset];
	const recipientAddress = (recipient.trim() || connected) as Address | undefined;
	const recipientError = recipient.trim() && !isAddress(recipient.trim()) ? "Not a valid address." : null;
	const amountValue = Number(amount);
	const amountError = type === "ERC1155" && (!Number.isInteger(amountValue) || amountValue < 1) ? "Enter a whole number, 1 or more." : null;

	const checklist = [
		{ label: "Artwork", ok: Boolean(artwork), value: artwork ? formatBytes(artwork.file.size) : "Missing" },
		{ label: "Title", ok: Boolean(name.trim()), value: name.trim() ? "Set" : "Missing" },
		{
			label: "URIs",
			ok: uris.length > 0 && !manualProblem,
			value: manualProblem ? "Invalid line" : `${uris.length}`,
		},
		{ label: "Recipient", ok: Boolean(recipientAddress) && !recipientError, value: recipientAddress ? shortAddress(recipientAddress) : "Missing" },
		{
			label: "Thumbnail",
			ok: onChainThumb ? Boolean(thumbnail) : !thumbnailProblem && !needsThumbnail,
			value: onChainThumb
				? thumbnail
					? "On-chain"
					: "Missing"
				: thumbnailProblem
					? "Invalid line"
					: needsThumbnail
						? "Needed"
						: "Off-chain",
		},
	];
	const canMint = checklist.every((c) => c.ok) && !amountError && isConnected && validCreator && !uploading;

	const mint = () => {
		if (!artwork || !recipientAddress || uploading) return;
		setMintChainId(chainId);
		setMintedRecipient(recipientAddress);
		const config = {
			metadata: buildMetadataFields(name, description, attributes),
			artwork: {
				artistUris: uris,
				collectorUris: [],
				mimeType: artwork.mimeType,
				fileHash: artwork.hash,
				isAnimationUri: artwork.isAnimation,
				selectedArtistUriIndex: 0n,
			},
			thumbnail: {
				kind: onChainThumb ? 0 : 1,
				onChain: {
					mimeType: onChainThumb && thumbnail ? thumbnail.mimeType : "",
					chunks: [],
					zipped: onChainThumb,
				},
				offChain: {
					uris: onChainThumb ? [] : thumbnailList.length > 0 ? thumbnailList : uris,
					selectedUriIndex: 0n,
				},
			},
			displayMode,
			permissions: { flags },
			// Leave pointers empty: the contract writes the template from the separate chunk argument.
			htmlTemplate: { chunks: [], zipped: false },
		} as const;
		const thumbnailChunks = onChainThumb && thumbnail ? thumbnail.chunks : [];
		const templateChunks = template?.chunks ?? [];

		if (type === "ERC721") {
			void tx.run("mint", {
				abi: muriExtensionAbi,
				address: MURI_EXTENSION_ADDRESS,
				functionName: "mintERC721",
				args: [creator, recipientAddress, config, thumbnailChunks, templateChunks],
			});
		} else {
			void tx.run("mint", {
				abi: muriExtensionAbi,
				address: MURI_EXTENSION_ADDRESS,
				functionName: "mintERC1155",
				args: [creator, [recipientAddress], [BigInt(amountValue)], config, thumbnailChunks, templateChunks],
			});
		}
	};

	useEffect(() => {
		if (!tx.receipt || mintedTokenId) return;
		for (const log of tx.receipt.logs) {
			try {
				const decoded = decodeEventLog({ abi: muriExtensionAbi, data: log.data, topics: log.topics });
				if (decoded.eventName === "TokenMintedERC721" || decoded.eventName === "TokenMintedERC1155") {
					setMintedTokenId((decoded.args as { tokenId: bigint }).tokenId.toString());
					return;
				}
			} catch {
				// Not one of ours.
			}
		}
	}, [tx.receipt, mintedTokenId]);

	if (!validCreator) {
		return (
			<Layout>
				<PageTitle title="Pick a collection first">
					<ButtonLink to="/collections?role=creator">Choose a collection →</ButtonLink>
				</PageTitle>
			</Layout>
		);
	}

	if (tx.state.phase === "confirmed" && artwork) {
		return (
			<Layout>
				<MintedView
					file={artwork.file}
					fileHash={artwork.hash}
					mimeType={artwork.mimeType}
					name={name}
					description={description}
					attributes={attributes}
					uris={uris}
					creator={creator}
					type={type}
					chainId={mintChainId ?? chainId}
					tokenId={mintedTokenId}
					txHash={tx.state.hash}
					displayMode={displayMode}
					permissions={customize ? "Custom" : (PRESETS.find((p) => p.id === preset)?.name ?? "")}
					recipient={mintedRecipient}
					editions={type === "ERC1155" ? amountValue : undefined}
				/>
			</Layout>
		);
	}

	return (
		<Layout>
			<div className="flex flex-col gap-14">
				<PageTitle
					back={
						<Link to="/collections?role=creator" className="hover:text-foreground transition-colors">
							← {type} · {shortAddress(creator)} · {chainName(chainId)}
						</Link>
					}
					title="Mint an artwork"
				>
					Add the file, store it in a few places, and mint. Everything except the file itself ends up
					on-chain.
				</PageTitle>

				<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10 items-start">
					<div className="flex flex-col gap-6 md:gap-8 min-w-0">
						<Section stacked title="Artwork" description="Hashed in your browser. Nothing is uploaded until you choose to.">
							<Dropzone
								accept={getAcceptAttribute()}
								onFile={(f) => void pickArtwork(f)}
								title="Drop the artwork or click to browse"
								hint="Images, video, audio, HTML, 3D models."
								error={artworkError}
								disabled={uploading}
							>
								{artwork ? (
									<div className="flex flex-col gap-4">
										<FilePreview file={artwork.file} />
										<p className="font-mono text-[11px] text-muted break-all">sha256 {artwork.hash}</p>
										<span className="micro text-faint">
											{uploading ? "Uploading; replace it once that's done" : "Click or drop to replace"}
										</span>
									</div>
								) : undefined}
							</Dropzone>
						</Section>

						<Section stacked title="Details">
							<div className="flex flex-col gap-6">
								<Field label="Title" htmlFor="mint-name">
									<Input id="mint-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Untitled" />
								</Field>
								<Field label="Description" htmlFor="mint-description" optional>
									<Textarea
										id="mint-description"
										rows={4}
										value={description}
										onChange={(e) => setDescription(e.target.value)}
									/>
								</Field>
								<AttributesEditor attributes={attributes} onChange={setAttributes} />
							</div>
						</Section>

						<Section
							stacked
							title="Storage"
							description="Every copy becomes a URI on the token, tried top to bottom. Upload here or paste your own links; MURI takes no fee."
						>
							<div className="flex flex-col gap-8">
								<StorageUploader
									file={artwork?.file ?? null}
									stored={stored}
									onStored={(s) => setStored((prev) => [...prev, s])}
									onBusyChange={setUploading}
								/>
								<Field
									label="Links you already host"
									htmlFor="mint-uris"
									optional={stored.length > 0}
									hint="One per line. https://, ar:// and ipfs:// all work."
									error={manualProblem}
								>
									<Textarea
										id="mint-uris"
										rows={3}
										className="font-mono text-[12px]"
										placeholder={"https://your-server.com/artwork.png\nhttps://archive.org/download/…"}
										value={manualUris}
										onChange={(e) => setManualUris(e.target.value)}
										spellCheck={false}
									/>
								</Field>
								{uris.length > 0 && (
									<div className="flex flex-col gap-3">
										<Rule label={`On-chain order · ${uris.length}`} />
										<ol className="flex flex-col gap-2">
											{uris.map((uri, i) => {
												const storedIndex = i < stored.length ? i : -1;
												return (
													<li key={`${i}-${uri}`} className="flex items-start gap-3">
														<span className="micro text-faint tabular-nums pt-[3px]">{String(i).padStart(2, "0")}</span>
														<span className="flex-1 min-w-0 font-mono text-[12px] break-all">{uri}</span>
														{storedIndex >= 0 && (
															<button
																type="button"
																onClick={() => setStored((prev) => prev.filter((_, j) => j !== storedIndex))}
																className="micro text-muted hover:text-signal transition-colors"
															>
																Remove
															</button>
														)}
													</li>
												);
											})}
										</ol>
									</div>
								)}
							</div>
						</Section>

						<Section
							stacked
							title="Permissions"
							description="You can revoke the artist's permissions after minting, but not grant them back. The owner's permissions are permanent once minted."
						>
							<div className="flex flex-col gap-3" role="radiogroup" aria-label="Permission preset">
								{PRESETS.map((p) => (
									<Choice
										key={p.id}
										type="radio"
										name="preset"
										checked={!customize && preset === p.id}
										onChange={() => {
											setCustomize(false);
											setPreset(p.id);
										}}
										title={p.name}
										description={p.description}
									/>
								))}
								<Choice
									type="radio"
									name="preset"
									checked={customize}
									onChange={() => {
										setCustomFlags(PERMISSION_PRESETS[preset]);
										setCustomize(true);
									}}
									title="Custom"
									description="Pick individual permissions for the artist and the owner."
								/>
								{customize && (
									<div className="grid gap-6 md:grid-cols-2 pt-3 animate-fade-in">
										{[
											{ label: "Artist", list: ARTIST_PERMISSIONS },
											{ label: "Owner", list: COLLECTOR_PERMISSIONS },
										].map((group) => (
											<fieldset key={group.label} className="flex flex-col gap-2">
												<legend className="micro text-muted mb-2">{group.label}</legend>
												{group.list.map((perm) => (
													<Choice
														key={perm.key}
														compact
														type="checkbox"
														checked={(customFlags & PERMISSION[perm.key]) !== 0}
														onChange={(on) =>
															setCustomFlags((f) => (on ? f | PERMISSION[perm.key] : f & ~PERMISSION[perm.key]))
														}
														title={perm.label}
													/>
												))}
											</fieldset>
										))}
									</div>
								)}
							</div>
						</Section>

						<Section stacked title="Recipient">
							<div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_9rem]">
								<Field
									label="Mint to"
									htmlFor="mint-recipient"
									error={recipientError}
									hint={!recipient.trim() && connected ? "Leave empty to mint to your wallet." : undefined}
									className={type === "ERC1155" ? "" : "sm:col-span-2"}
								>
									<Input
										id="mint-recipient"
										className="font-mono text-[13px]"
										placeholder={connected ?? "0x…"}
										value={recipient}
										onChange={(e) => setRecipient(e.target.value)}
										spellCheck={false}
										autoComplete="off"
									/>
								</Field>
								{type === "ERC1155" && (
									<Field label="Editions" htmlFor="mint-amount" error={amountError}>
										<Input
											id="mint-amount"
											type="number"
											min={1}
											inputMode="numeric"
											value={amount}
											onChange={(e) => setAmount(e.target.value)}
										/>
									</Field>
								)}
							</div>
						</Section>

						<Section stacked title="Display" description="Sensible defaults. Change only if you need to.">
							<div className="flex flex-col gap-10">
								<div className="flex flex-col gap-3" role="radiogroup" aria-label="Display mode">
									<span className="micro text-muted">Display mode</span>
									{DISPLAY_MODES.map((m) => (
										<Choice
											key={m.value}
											type="radio"
											name="display-mode"
											checked={displayMode === m.value}
											onChange={() => setDisplayMode(m.value)}
											title={m.name}
											description={m.description}
											meta={m.value === 1 ? "Default" : undefined}
										/>
									))}
								</div>

								<div className="flex flex-col gap-3">
									<span className="micro text-muted">Thumbnail</span>
									<div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Thumbnail storage">
										<Choice
											type="radio"
											name="thumb"
											checked={!onChainThumb}
											onChange={() => setOnChainThumb(false)}
											title="Off-chain"
											description={
												artwork && !artwork.isImage
													? "List an image link below: marketplaces can't show this file type as a thumbnail."
													: "Uses the artwork URIs unless you list thumbnail URIs."
											}
										/>
										<Choice
											type="radio"
											name="thumb"
											checked={onChainThumb}
											onChange={() => setOnChainThumb(true)}
											title="On-chain"
											description="Stored in contract storage. Up to 60 KB, costs more gas."
										/>
									</div>
									{onChainThumb ? (
										<Dropzone
											compact
											accept={getThumbnailAcceptAttribute()}
											title={thumbnail ? thumbnail.file.name : "Drop a thumbnail image"}
											hint={
												thumbnail
													? `${formatBytes(thumbnail.storedBytes)} after compression · ${thumbnail.chunks.length} chunk${thumbnail.chunks.length === 1 ? "" : "s"}`
													: "PNG, JPG, GIF, WebP or SVG. 60 KB max."
											}
											error={thumbnailError}
											onFile={async (f) => {
												setThumbnailError(null);
												if (!isThumbnailSupported(f)) {
													setThumbnailError(getUnsupportedThumbnailMessage(f));
													return;
												}
												try {
													setThumbnail(await prepareOnChainThumbnail(f));
												} catch (e) {
													setThumbnailError(e instanceof Error ? e.message : "Couldn't read the image.");
												}
											}}
										/>
									) : (
										<Field
											label="Thumbnail URIs"
											htmlFor="mint-thumbs"
											optional={!needsThumbnail && !(artwork && !artwork.isImage)}
											hint={
												artwork && !artwork.isImage
													? "One per line. An image marketplaces show as the preview."
													: "One per line. Leave empty to reuse the artwork URIs."
											}
											error={
												thumbnailProblem ??
												(needsThumbnail ? "Add an image link, or store a thumbnail on-chain." : undefined)
											}
										>
											<Textarea
												id="mint-thumbs"
												rows={2}
												className="font-mono text-[12px]"
												value={thumbnailUris}
												onChange={(e) => setThumbnailUris(e.target.value)}
												spellCheck={false}
											/>
										</Field>
									)}
								</div>

							</div>
						</Section>

						<Disclosure
							title="Advanced"
							summary={template ? `Custom HTML template: ${template.file.name}` : "Custom HTML template for Smart HTML mode"}
						>
								<div className="flex flex-col gap-3">
									<p className="text-[13px] text-muted leading-relaxed max-w-[60ch]">
										Smart HTML mode renders the artwork through an on-chain page that tries each URI and checks the
										file hash. Every token uses the shared default page unless you upload your own here. Most
										artworks never need this.
									</p>
									<Dropzone
										compact
										accept=".html,.htm"
										title={template ? template.file.name : "Use the default template"}
										hint={
											template
												? `${template.characters.toLocaleString()} characters · ${template.chunks.length} chunk${template.chunks.length === 1 ? "" : "s"}`
												: "Optional. Drop an .html file with {{FILE_URIS}} and {{FILE_HASH}} placeholders to replace it."
										}
										error={templateError}
										onFile={async (f) => {
											setTemplateError(null);
											try {
												setTemplate(await prepareHtmlTemplate(f));
											} catch (e) {
												setTemplateError(e instanceof Error ? e.message : "Couldn't read the template.");
											}
										}}
									/>
									{template && (
										<div>
											<Button size="sm" variant="ghost" onClick={() => setTemplate(null)}>
												Use the default template instead
											</Button>
										</div>
									)}
								</div>
						</Disclosure>
					</div>

					<aside className="lg:sticky lg:top-20 flex flex-col gap-6 bg-surface p-6 md:p-8">
						<div className="flex items-center justify-between">
							<span className="micro text-muted">Summary</span>
							<span className="micro text-faint">{type}</span>
						</div>
						<dl className="flex flex-col border-t border-line">
							{checklist.map((c) => (
								<div key={c.label} className="flex items-center justify-between gap-4 py-2.5 border-b border-line">
									<dt className="text-[14px]">{c.label}</dt>
									<dd>
										<StatusLabel tone={c.ok ? "up" : "neutral"}>{c.value}</StatusLabel>
									</dd>
								</div>
							))}
							<div className="flex items-center justify-between gap-4 py-2.5 border-b border-line">
								<dt className="text-[14px]">Permissions</dt>
								<dd className="micro text-muted">
									{customize ? "Custom" : PRESETS.find((p) => p.id === preset)?.name}
								</dd>
							</div>
						</dl>
						{!isConnected ? (
							<ConnectWallet label="Connect to mint" />
						) : (
							<Button fullWidth disabled={!canMint || tx.busy} loading={tx.busy} onClick={mint}>
								Mint
							</Button>
						)}
						{uploading && <p className="text-[13px] text-muted">Waiting for the upload to finish.</p>}
						<NetworkNotice chainId={chainId} />
						<TxFeedback state={tx.state} action="mint" />
						{uris.length === 1 && artwork && (
							<Notice tone="caution">
								One URI means one point of failure. Add at least one more copy.
							</Notice>
						)}
					</aside>
				</div>
			</div>
		</Layout>
	);
}
