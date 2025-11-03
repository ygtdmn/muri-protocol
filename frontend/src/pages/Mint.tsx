import { useMemo, useState, useCallback, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useChainId, useWalletClient, useSwitchChain } from "wagmi";
import { useSearchParams, useNavigate } from "react-router-dom";
import type { Address } from "viem";
import { decodeEventLog } from "viem";
import { base } from "wagmi/chains";
import { muriExtensionAbi } from "../abis/muri-manifold-extension-abi";
import fastlz from "../lib/fastlz";
import { sha256 } from "js-sha256";
import { Upload, Link2, Sparkles, ChevronDown, User } from "lucide-react";
import {
	isFileSupported,
	getUnsupportedFileMessage,
	getFileInfo,
	isThumbnailSupported,
	getThumbnailAcceptAttribute,
	getUnsupportedThumbnailMessage,
	resolveMimeType
} from "../utils/fileValidation";
import { pinToIPFSWithX402, getIPFSUrl, estimatePinningCost } from "../utils/pinatax402";
import FilePreview from "../components/FilePreview";
import Header from "../components/Header";
import { useTheme } from "../hooks/useTheme";
import Footer from "../components/Footer";
import PageBackground from "../components/PageBackground";

type PermissionPreset = 'collaborative' | 'full' | 'frozen';

export default function Mint() {
	const [sp] = useSearchParams();
	const navigate = useNavigate();
	const { address: connectedAddress } = useAccount();
	const chainId = useChainId();
	const { data: walletClient } = useWalletClient();
	const { switchChainAsync } = useSwitchChain();
	const creator = (sp.get("creator") || "") as Address;
	const type = sp.get("type") || "Unknown";
	const { isDarkMode, toggleTheme } = useTheme();

	// === SIMPLE ESSENTIAL FIELDS ===
	const [artworkFile, setArtworkFile] = useState<File | null>(null);
	const [artworkPreview, setArtworkPreview] = useState<string>("");
	const [name, setName] = useState("");
	const [backupUrls, setBackupUrls] = useState("");
	const [recipient, setRecipient] = useState("");
	const [amount, setAmount] = useState("1");
	const [permissionPreset, setPermissionPreset] = useState<PermissionPreset>('collaborative');

	// === ADVANCED (HIDDEN) ===
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [description, setDescription] = useState("");
	const [attributes, setAttributes] = useState<{ trait_type: string; value: string }[]>([]);
	
	// Display & thumbnail options
	const [displayMode, setDisplayMode] = useState(1); // HTML by default
	const [useOffchainThumbnail, setUseOffchainThumbnail] = useState(true);
	const [thumbnailUrls, setThumbnailUrls] = useState("");
	
	// On-chain thumbnail
	const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
	const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
	const [thumbMime, setThumbMime] = useState("");
	const [thumbLength, setThumbLength] = useState<number>(0);
	const [thumbChunks, setThumbChunks] = useState<string[]>([]);
	
	// x402 IPFS Pinning
	const [enableX402Pinning, setEnableX402Pinning] = useState(false);
	const [isPinning, setIsPinning] = useState(false);
	const [pinnedCid, setPinnedCid] = useState<string>("");
	const [pinningError, setPinningError] = useState<string>("");
	
	// HTML Template
	const [htmlTemplateFile, setHtmlTemplateFile] = useState<File | null>(null);
	const [htmlTemplateContent, setHtmlTemplateContent] = useState<string>("");
	const [htmlTemplateChunks, setHtmlTemplateChunks] = useState<string[]>([]);
	
	// Fine-grained permissions (only visible in advanced)
	const [useCustomPermissions, setUseCustomPermissions] = useState(false);
	const [artistUpdateThumb, setArtistUpdateThumb] = useState(true);
	const [artistUpdateMeta, setArtistUpdateMeta] = useState(true);
	const [artistChooseUris, setArtistChooseUris] = useState(true);
	const [artistAddRemove, setArtistAddRemove] = useState(true);
	const [artistChooseThumb, setArtistChooseThumb] = useState(true);
	const [artistUpdateMode, setArtistUpdateMode] = useState(true);
	const [artistUpdateTemplate, setArtistUpdateTemplate] = useState(true);
	const [collectorChooseUris, setCollectorChooseUris] = useState(true);
	const [collectorAddRemove, setCollectorAddRemove] = useState(true);
	const [collectorChooseThumb, setCollectorChooseThumb] = useState(true);
	const [collectorUpdateMode, setCollectorUpdateMode] = useState(true);

	// === AUTO-CALCULATED ===
	const [imageHash, setImageHash] = useState("");
	const [imageMimeType, setImageMimeType] = useState("");
	const [isAnimationUri, setIsAnimationUri] = useState(false);

	// === TRANSACTION STATE ===
	const { data: hash, isPending, writeContract, error: writeError } = useWriteContract();
	const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
	const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);

	const getManifoldNetwork = (chainId: number): string => {
		const map: Record<number, string> = { 1: "ethereum", 11155111: "sepolia", 8453: "base", 10: "optimism", 137: "polygon", 42161: "arbitrum" };
		return map[chainId] || "ethereum";
	};

	// Extract minted token ID from receipt
	useEffect(() => {
		if (receipt && receipt.logs && !mintedTokenId) {
			try {
				for (const log of receipt.logs) {
					try {
						const decoded = decodeEventLog({ abi: muriExtensionAbi, data: log.data, topics: log.topics });
						if (decoded.eventName === "TokenMintedERC721" || decoded.eventName === "TokenMintedERC1155") {
							const tokenId = (decoded.args as { tokenId: bigint }).tokenId;
							if (tokenId) {
								setMintedTokenId(tokenId.toString());
								break;
							}
						}
					} catch {
						continue;
					}
				}
			} catch (error) {
				console.error("Error extracting token ID:", error);
			}
		}
	}, [receipt, mintedTokenId]);

	const handleArtworkFile = useCallback(async (file: File) => {
		setArtworkFile(file);
		const mimeType = resolveMimeType(file);
		setImageMimeType(mimeType);
		const reader = new FileReader();
		reader.onload = (e) => setArtworkPreview(e.target?.result as string);
		reader.readAsDataURL(file);
		const buffer = await file.arrayBuffer();
		const hash = sha256.hex(new Uint8Array(buffer));
		setImageHash(`0x${hash}`);
		const fileInfo = getFileInfo(file);
		const isStaticImage = fileInfo.category === "image" && !mimeType.includes("gif");
		setIsAnimationUri(!isStaticImage);
	}, []);

	const prepareThumbnail = useCallback(async (file: File) => {
		const fileSizeKB = file.size / 1024;
		const MAX_SIZE_KB = 60;

		if (fileSizeKB > MAX_SIZE_KB) {
			alert(
				`File too large for on-chain storage. Maximum size is ${MAX_SIZE_KB}KB, your file is ${fileSizeKB.toFixed(1)}KB. Please compress or resize your thumbnail.`
			);
			return;
		}

		setThumbnailFile(file);
		setThumbMime(resolveMimeType(file));

		// Create preview
		const reader = new FileReader();
		reader.onload = (e) => setThumbnailPreview(e.target?.result as string);
		reader.readAsDataURL(file);

		// Compress and chunk
		const buffer = await file.arrayBuffer();
		const compressed = fastlz.compress(new Uint8Array(buffer));
		setThumbLength(buffer.byteLength);

		const CHUNK_SIZE = 20 * 1024;
		const chunks: string[] = [];
		for (let i = 0; i < compressed.length; i += CHUNK_SIZE) {
			const chunk = compressed.slice(i, i + CHUNK_SIZE);
			chunks.push(
				`0x${Array.from(chunk)
					.map((b) => (b as number).toString(16).padStart(2, "0"))
					.join("")}`
			);
		}
		setThumbChunks(chunks);
	}, []);

	const prepareHtmlTemplate = useCallback(async (file: File) => {
		setHtmlTemplateFile(file);

		// Read file content
		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			setHtmlTemplateContent(content);

			// For HTML templates, we store them as string chunks (not compressed)
			const CHUNK_SIZE = 20 * 1024; // 20KB per chunk for text
			const chunks: string[] = [];
			for (let i = 0; i < content.length; i += CHUNK_SIZE) {
				chunks.push(content.slice(i, i + CHUNK_SIZE));
			}
			setHtmlTemplateChunks(chunks);
		};
		reader.readAsText(file);
	}, []);

	const handleX402Pinning = useCallback(async () => {
		if (!artworkFile || !walletClient || !switchChainAsync) {
			setPinningError("Missing artwork file or wallet connection");
			return;
		}

		setIsPinning(true);
		setPinningError("");
		setPinnedCid("");

		const originalChainId = chainId;

		try {
			// Switch to Base if not already on it (Pinata x402 only works on Base)
			if (chainId !== base.id) {
				try {
					await switchChainAsync({ chainId: base.id });
				} catch {
					throw new Error("Please switch to Base network to use x402 pinning");
				}
			}

			const result = await pinToIPFSWithX402({
				file: artworkFile,
				name: name || artworkFile.name,
				walletClient,
			});

			// Ensure we have a valid CID before proceeding
			if (!result?.cid) {
				throw new Error('No CID returned from pinning service');
			}

			setPinnedCid(result.cid);
			setIsPinning(false);

			// Switch back to original chain if it was different
			if (originalChainId !== base.id) {
				try {
					await switchChainAsync({ chainId: originalChainId });
				} catch {
					// Ignore errors when switching back
				}
			}
		} catch (error) {
			console.error("x402 pinning error:", error);
			setPinningError(error instanceof Error ? error.message : "Failed to pin to IPFS");
			setIsPinning(false);

			// Try to switch back on error too
			if (originalChainId !== base.id) {
				try {
					await switchChainAsync({ chainId: originalChainId });
				} catch {
					// Ignore errors when switching back
				}
			}
		}
	}, [artworkFile, walletClient, switchChainAsync, chainId, name]);

	const backupUrlsArray = useMemo(() => {
		const manualUrls = backupUrls.split("\n").map((s) => s.trim()).filter(Boolean);
		// If we have a pinned CID, add it as the first backup URL
		if (pinnedCid) {
			const ipfsUrl = getIPFSUrl(pinnedCid);
			return [ipfsUrl, ...manualUrls];
		}
		return manualUrls;
	}, [backupUrls, pinnedCid]);

	const permissionsFlags = useMemo(() => {
		if (useCustomPermissions) {
			// Use fine-grained permissions
			let flags = 0;
			if (artistUpdateThumb) flags |= 1 << 0;
			if (artistUpdateMeta) flags |= 1 << 1;
			if (artistChooseUris) flags |= 1 << 2;
			if (artistAddRemove) flags |= 1 << 3;
			if (artistChooseThumb) flags |= 1 << 4;
			if (artistUpdateMode) flags |= 1 << 5;
			if (artistUpdateTemplate) flags |= 1 << 6;
			if (collectorChooseUris) flags |= 1 << 7;
			if (collectorAddRemove) flags |= 1 << 8;
			if (collectorChooseThumb) flags |= 1 << 9;
			if (collectorUpdateMode) flags |= 1 << 10;
			return flags;
		}
		
		// Use preset
		const presets = {
			// Collaborative: All permissions for both artist and collectors
			collaborative: (1<<0)|(1<<1)|(1<<2)|(1<<3)|(1<<4)|(1<<5)|(1<<6)|(1<<7)|(1<<8)|(1<<9)|(1<<10), 
			// Artist Only: All artist permissions, no collector permissions
			full: (1<<0)|(1<<1)|(1<<2)|(1<<3)|(1<<4)|(1<<5)|(1<<6), 
			// Frozen: No permissions for anyone
			frozen: 0,
		};
		return presets[permissionPreset];
	}, [permissionPreset, useCustomPermissions, artistUpdateThumb, artistUpdateMeta, artistChooseUris, artistAddRemove, artistChooseThumb, artistUpdateMode, artistUpdateTemplate, collectorChooseUris, collectorAddRemove, collectorChooseThumb, collectorUpdateMode]);

	const thumbnailUrlsArray = useMemo(
		() => thumbnailUrls.split("\n").map((s) => s.trim()).filter(Boolean),
		[thumbnailUrls]
	);

	const metadataJson = useMemo(() => {
		const fields: string[] = [];
		if (name) fields.push(`"name":${JSON.stringify(name)}`);
		if (description) fields.push(`"description":${JSON.stringify(description)}`);
		if (attributes.length > 0) {
			const validAttrs = attributes
				.filter((a) => a.trait_type && a.value !== "")
				.map((attr) => `{"trait_type":${JSON.stringify(attr.trait_type)},"value":${JSON.stringify(attr.value)}}`);
			if (validAttrs.length > 0) {
				fields.push(`"attributes":[${validAttrs.join(",")}]`);
			}
		}
		return fields.join(",");
	}, [name, description, attributes]);

	const initConfig = useMemo(
		() => ({
			metadata: metadataJson,
			artwork: {
				artistUris: backupUrlsArray as readonly string[],
				collectorUris: [] as readonly string[],
				mimeType: imageMimeType,
				fileHash: imageHash,
				isAnimationUri,
				selectedArtistUriIndex: BigInt(0),
			},
			thumbnail: {
				kind: useOffchainThumbnail ? 1 : 0,
				onChain: {
					mimeType: useOffchainThumbnail ? "" : thumbMime,
					chunks: [] as readonly Address[],
					zipped: !useOffchainThumbnail 
				},
				offChain: {
					uris: (useOffchainThumbnail && thumbnailUrlsArray.length > 0 
						? thumbnailUrlsArray 
						: backupUrlsArray) as readonly string[], 
					selectedUriIndex: BigInt(0) 
				},
			},
			displayMode,
			permissions: { flags: permissionsFlags },
			htmlTemplate: { chunks: htmlTemplateChunks as readonly Address[], zipped: false },
		}),
		[metadataJson, backupUrlsArray, imageMimeType, imageHash, isAnimationUri, permissionsFlags, displayMode, useOffchainThumbnail, thumbnailUrlsArray, thumbMime, htmlTemplateChunks]
	);

	const onSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const recipientAddress = (recipient || connectedAddress) as Address;
		const thumbnailChunksToSend = useOffchainThumbnail ? [] : (thumbChunks as readonly `0x${string}`[]);

		if (type === "ERC721") {
				writeContract({
					abi: muriExtensionAbi,
					address: import.meta.env.VITE_MURI_EXTENSION_ADDRESS as Address,
				functionName: "mintERC721",
				args: [creator, recipientAddress, initConfig, thumbnailChunksToSend, htmlTemplateChunks],
					value: 0n,
				});
			} else {
				writeContract({
					abi: muriExtensionAbi,
					address: import.meta.env.VITE_MURI_EXTENSION_ADDRESS as Address,
				functionName: "mintERC1155",
				args: [creator, [recipientAddress], [BigInt(amount || 1)], initConfig, thumbnailChunksToSend, htmlTemplateChunks],
					value: 0n,
				});
			}
	};

	// === SUCCESS STATE ===
	if (isSuccess) {
		const network = getManifoldNetwork(chainId);
		const manifoldLink = mintedTokenId ? `https://gallery.manifold.xyz/${network}/${creator}/${mintedTokenId}` : null;

		return (
			<PageBackground 
				isDarkMode={isDarkMode}
				className={`min-h-screen flex items-center justify-center p-4 relative`}
			>
				<div className="max-w-2xl w-full text-center animate-scale-in">
					<div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-8 ${
						isDarkMode ? "bg-success-dark-subtle" : "bg-success-subtle"
					}`}>
						<Sparkles className={`w-14 h-14 ${isDarkMode ? "text-success-dark" : "text-success"}`} />
				</div>

					<h2 className={`text-4xl md:text-5xl font-bold mb-4 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
						Your Art is Protected!
				</h2>
					<p className={`text-xl mb-3 ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
						Minted with {backupUrlsArray.length} backup location{backupUrlsArray.length !== 1 ? 's' : ''}
					</p>
					<p className={`text-base mb-12 ${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}`}>
						If one link fails, your NFT will automatically use another. That's the magic.
				</p>
				
				{manifoldLink && (
						<a
							href={manifoldLink}
							target="_blank"
							rel="noopener noreferrer"
							className={`inline-block px-10 py-5 rounded-2xl text-white font-bold text-lg shadow-strong transition-all duration-200 mb-8 ${
								isDarkMode ? "bg-primary-dark hover:bg-primary-dark-hover" : "bg-primary hover:bg-primary-hover"
							}`}
						>
							View on Manifold Gallery →
						</a>
					)}

					<div className="flex flex-col sm:flex-row gap-4 justify-center">
					<button
						onClick={() => navigate("/collections")}
							className={`px-6 py-3 rounded-xl border-2 font-semibold transition-all ${
								isDarkMode
									? "border-border-dark hover:bg-surface-hover-dark text-text-primary-dark"
									: "border-border-light hover:bg-surface-hover-light text-text-primary-light"
							}`}
						>
							← Back
					</button>
					<button
						onClick={() => window.location.reload()}
							className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover dark:bg-primary-dark text-white font-semibold shadow-soft"
					>
							Mint Another
					</button>
					</div>
				</div>
			</PageBackground>
		);
	}

	// === MAIN FORM ===
	return (
		<PageBackground 
			isDarkMode={isDarkMode}
			className={`min-h-screen flex flex-col relative`}
		>
			<Header isDarkMode={isDarkMode} toggleTheme={toggleTheme} />

			<div className="flex-grow py-8 md:py-12">
				<form onSubmit={onSubmit} className="max-w-3xl mx-auto px-4 space-y-6">
					{/* Friendly Header */}
					<div className="text-center mb-8">
						<h1 className={`text-4xl md:text-5xl font-bold mb-4 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
							Let's Protect Your Art
						</h1>
						<p className={`text-lg md:text-xl ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
							Upload once, backup everywhere, sleep peacefully
						</p>
					</div>

					{/* STEP 1: Upload - BIG & FRIENDLY */}
					<div className={`p-8 md:p-10 rounded-3xl border-2 ${
						artworkFile
							? isDarkMode
								? "bg-primary-dark-subtle border-primary-dark"
								: "bg-primary-subtle border-primary"
							: isDarkMode
							? "bg-surface-dark border-border-dark hover:border-border-hover-dark"
							: "bg-surface-light border-border-light hover:border-border-hover-light shadow-soft hover:shadow-medium"
					} transition-all duration-300`}>
						<div className="flex items-center gap-4 mb-6">
							<div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
								isDarkMode ? "bg-primary-dark-subtle" : "bg-primary-subtle"
							}`}>
								<Upload className={`w-6 h-6 ${isDarkMode ? "text-primary-dark" : "text-primary"}`} />
							</div>
					<div>
								<h2 className={`text-2xl font-bold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									Your Artwork
						</h2>
								<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
									We'll calculate a unique hash to verify it
								</p>
							</div>
					</div>

						<div
							className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
								isDarkMode
									? "border-border-dark hover:border-primary-dark hover:bg-surface-hover-dark"
									: "border-border-light hover:border-primary hover:bg-surface-hover-light"
							}`}
							onClick={() => {
								const input = document.createElement("input");
								input.type = "file";
								input.onchange = () => {
									const file = input.files?.[0];
									if (file && isFileSupported(file)) {
										handleArtworkFile(file);
									} else if (file) {
										alert(getUnsupportedFileMessage(file));
									}
								};
								input.click();
							}}
						>
							{artworkPreview ? (
								<div className="space-y-4">
									<FilePreview file={artworkFile} previewUrl={artworkPreview} maxHeight="max-h-64" />
									<p className="text-lg font-bold text-success dark:text-success-dark">
										✓ Ready
									</p>
								</div>
							) : (
								<div>
									<Upload className={`w-20 h-20 mx-auto mb-4 ${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}`} />
									<p className={`text-xl font-bold mb-2 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
										Drop your artwork here
									</p>
									<p className={`text-base ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
										Or click to browse your files
									</p>
								</div>
							)}
						</div>
					</div>

					{/* STEP 2: Title & Backups - COMBINED FOR SIMPLICITY */}
					<div className={`p-8 md:p-10 rounded-3xl border-2 ${
						isDarkMode ? "bg-surface-dark border-border-dark" : "bg-surface-light border-border-light shadow-soft"
					}`}>
						<div className="flex items-center gap-4 mb-8">
							<div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
								isDarkMode ? "bg-primary-dark-subtle" : "bg-primary-subtle"
							}`}>
								<Link2 className={`w-6 h-6 ${isDarkMode ? "text-primary-dark" : "text-primary"}`} />
							</div>
							<div>
								<h2 className={`text-2xl font-bold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									Name It & Back It Up
								</h2>
								<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
									Give it a name and add where it lives
								</p>
							</div>
						</div>

						<div className="space-y-6">
							{/* Name */}
							<div>
								<label className={`block text-lg font-bold mb-3 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									Artwork Title
								</label>
								<input
									className={`w-full px-5 py-4 rounded-xl text-lg border-2 transition-all ${
										isDarkMode
											? "bg-surface-hover-dark border-border-dark text-text-primary-dark placeholder:text-text-tertiary-dark focus:border-primary-dark focus:bg-surface-dark"
											: "bg-white border-border-light text-text-primary-light placeholder:text-text-tertiary-light focus:border-primary"
									} focus:outline-none focus:ring-4 focus:ring-primary/10`}
									placeholder="My Amazing Artwork"
									value={name}
									onChange={(e) => setName(e.target.value)}
									required
								/>
							</div>

							{/* Description - Optional */}
							<div>
								<label className={`block text-sm font-semibold mb-2 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									Description (optional)
								</label>
								<textarea
									rows={3}
									className={`w-full px-4 py-3 rounded-lg border ${isDarkMode ? "bg-surface-hover-dark border-border-dark text-text-primary-dark placeholder:text-text-tertiary-dark" : "bg-white border-border-light text-text-primary-light placeholder:text-text-tertiary-light"} focus:outline-none focus:ring-2 focus:ring-primary`}
									placeholder="Tell the story behind your artwork..."
									value={description}
									onChange={(e) => setDescription(e.target.value)}
								/>
							</div>

							{/* Backup URLs */}
						<div>
								<label className={`block text-lg font-bold mb-2 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									Backup Locations
								</label>
								<p className={`text-sm mb-4 leading-relaxed ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
									Upload your file to multiple places. <strong>More backups = better protection!</strong>
								</p>

								{/* x402 IPFS Pinning */}
								<div className={`mb-4 p-5 rounded-xl border-2 ${
									enableX402Pinning 
										? isDarkMode ? "bg-primary-dark-subtle border-primary-dark" : "bg-primary-subtle border-primary"
										: isDarkMode ? "bg-surface-dark border-border-dark" : "bg-white border-border-light"
								}`}>
									<label className="flex items-start gap-3 cursor-pointer">
										<input
											type="checkbox"
											checked={enableX402Pinning}
											onChange={(e) => setEnableX402Pinning(e.target.checked)}
											className="w-5 h-5 mt-0.5"
										/>
										<div className="flex-1">
											<p className={`font-bold mb-1 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
												Upload to IPFS via Pinata x402
											</p>
											<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
												Pay to pin for 12 months{artworkFile && ` • Est. ${estimatePinningCost(artworkFile.size)} USDC on Base`}
											</p>
										</div>
									</label>

									{enableX402Pinning && (
										<div className="mt-4 space-y-3">
											{!pinnedCid && !isPinning && !pinningError && (
												<button
													type="button"
													onClick={handleX402Pinning}
													disabled={!artworkFile || !walletClient}
													className={`w-full px-5 py-3 rounded-xl font-bold transition-all ${
														!artworkFile || !walletClient
															? "opacity-50 cursor-not-allowed bg-surface-hover-light dark:bg-surface-hover-dark"
															: isDarkMode 
																? "bg-primary-dark hover:bg-primary-dark-hover text-white shadow-soft hover:shadow-medium"
																: "bg-primary hover:bg-primary-hover text-white shadow-soft hover:shadow-medium"
													}`}
												>
													Pin to IPFS Now
												</button>
											)}

											{isPinning && (
												<div className={`p-4 rounded-lg ${isDarkMode ? "bg-surface-hover-dark" : "bg-surface-hover-light"}`}>
													<div className="flex items-center gap-3">
														<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary dark:border-primary-dark"></div>
														<p className={`text-sm font-semibold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
															{chainId !== base.id ? "Switching to Base network..." : "Waiting for payment approval..."}
														</p>
													</div>
												</div>
											)}

											{pinnedCid && (
												<div className={`p-4 rounded-lg ${isDarkMode ? "bg-success-dark-subtle border border-success-dark" : "bg-success-subtle border border-success"}`}>
													<p className={`text-sm font-bold mb-2 ${isDarkMode ? "text-success-dark" : "text-success"}`}>
														✓ Pinned to IPFS!
													</p>
													<p className={`text-xs mb-1 ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
														This URL will be included in your backup locations
													</p>
													<p className={`text-xs font-mono break-all mb-3 ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
														{getIPFSUrl(pinnedCid)}
													</p>
													<button
														type="button"
														onClick={() => {
															setPinnedCid("");
															setPinningError("");
															setIsPinning(false);
														}}
														className={`text-xs font-semibold ${isDarkMode ? "text-success-dark hover:underline" : "text-success hover:underline"}`}
													>
														Clear and pin another file
													</button>
												</div>
											)}

											{pinningError && (
												<div className={`p-4 rounded-lg ${isDarkMode ? "bg-danger-dark-subtle border border-danger-dark" : "bg-danger-subtle border border-danger"}`}>
													<p className={`text-sm font-bold mb-1 ${isDarkMode ? "text-danger-dark" : "text-danger"}`}>
														Failed to pin
													</p>
													<p className={`text-xs ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
														{pinningError}
													</p>
													<div className="flex gap-2 mt-3">
														<button
															type="button"
															onClick={handleX402Pinning}
															className={`text-sm font-semibold ${isDarkMode ? "text-primary-dark hover:underline" : "text-primary hover:underline"}`}
														>
															Try again
														</button>
														<button
															type="button"
															onClick={() => {
																setPinningError("");
																setPinnedCid("");
																setIsPinning(false);
															}}
															className={`text-sm font-semibold ${isDarkMode ? "text-text-secondary-dark hover:underline" : "text-text-secondary-light hover:underline"}`}
														>
															Clear
														</button>
													</div>
												</div>
											)}
										</div>
									)}
								</div>

								{/* x402 Arweave Pinning - Placeholder */}
								<div className={`mb-4 p-5 rounded-xl border-2 opacity-50 ${
									isDarkMode ? "bg-surface-dark border-border-dark" : "bg-white border-border-light"
								}`}>
									<label className="flex items-start gap-3">
										<input
											type="checkbox"
											disabled
											className="w-5 h-5 mt-0.5"
										/>
										<div className="flex-1">
											<p className={`font-bold mb-1 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
												Upload to Arweave
											</p>
											<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
												Coming soon - permanent storage
											</p>
										</div>
									</label>
								</div>

								{/* Manual Backup URLs */}
								<div>
									<label className={`block text-sm font-semibold mb-2 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
										{pinnedCid ? "More Backup Locations (optional)" : "Backup Locations (one per line)"}
									</label>
									{pinnedCid && (
										<p className={`text-xs mb-2 ${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}`}>
											Add more locations if you want additional redundancy
										</p>
									)}
									<textarea
										rows={4}
										className={`w-full px-4 py-3 rounded-lg font-mono text-sm border ${
											isDarkMode
												? "bg-surface-hover-dark border-border-dark text-text-primary-dark placeholder:text-text-tertiary-dark"
												: "bg-white border-border-light text-text-primary-light placeholder:text-text-tertiary-light"
										} focus:outline-none focus:ring-2 focus:ring-secondary`}
										placeholder={"https://archive.org/file.png\nhttps://github.com/file.png\nhttps://your-server.com/file.png"}
										value={backupUrls}
										onChange={(e) => setBackupUrls(e.target.value)}
										required={!pinnedCid}
									/>
								</div>
					</div>

							{/* Permission Presets */}
							<div>
								<div className="mb-4">
									<label className={`block text-lg font-bold mb-2 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
										Who can update this artwork?
									</label>
									<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
										You can always remove permissions later, but you can't add them back
									</p>
								</div>
								<div className="grid gap-4">
									{[
										{ id: 'collaborative' as PermissionPreset, name: 'Collaborative', emoji: '🤝', desc: 'Both you and collectors have full control (recommended for preservation)' },
										{ id: 'full' as PermissionPreset, name: 'Artist Only', emoji: '🎨', desc: 'Only you can make changes, collectors cannot do anything' },
										{ id: 'frozen' as PermissionPreset, name: 'Immutable', emoji: '❄️', desc: 'Nobody can change it ever (not recommended)' },
									].map((preset) => (
										<label
											key={preset.id}
											className={`flex items-start gap-4 p-5 rounded-xl cursor-pointer transition-all border-2 ${
												permissionPreset === preset.id
												? isDarkMode
														? "bg-primary-dark-subtle border-primary-dark shadow-soft"
														: "bg-primary-subtle border-primary shadow-soft"
												: isDarkMode
													? "border-border-dark hover:border-border-hover-dark hover:bg-surface-hover-dark"
													: "border-border-light hover:border-border-hover-light hover:bg-surface-hover-light"
										}`}
									>
											<input
												type="radio"
												name="preset"
												checked={permissionPreset === preset.id}
												onChange={() => setPermissionPreset(preset.id)}
												className="mt-1 w-5 h-5"
											/>
											<div className="flex-1">
												<p className={`text-lg font-bold mb-1 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
													{preset.emoji} {preset.name}
												</p>
												<p className={`text-sm leading-relaxed ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
													{preset.desc}
										</p>
									</div>
										</label>
									))}
								</div>
							</div>
						</div>
					</div>

					{/* STEP 3: Recipient */}
					<div className={`p-8 md:p-10 rounded-3xl border-2 ${
						isDarkMode ? "bg-surface-dark border-border-dark" : "bg-surface-light border-border-light shadow-soft"
					}`}>
						<div className="flex items-center gap-4 mb-6">
							<div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
								isDarkMode ? "bg-primary-dark-subtle" : "bg-primary-subtle"
							}`}>
								<User className={`w-6 h-6 ${isDarkMode ? "text-primary-dark" : "text-primary"}`} />
											</div>
										<div>
								<h2 className={`text-2xl font-bold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									Who Gets It?
								</h2>
								<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
									{type === "ERC1155" ? "Leave blank to mint to yourself" : "Leave blank to mint to yourself"}
								</p>
								</div>
							</div>

						<div className="space-y-4">
							<div className="flex gap-3">
										<input
								className={`flex-1 px-5 py-4 rounded-xl font-mono text-sm border-2 transition-all ${
									isDarkMode
										? "bg-surface-hover-dark border-border-dark text-text-primary-dark placeholder:text-text-tertiary-dark focus:border-success-dark focus:bg-surface-dark"
										: "bg-white border-border-light text-text-primary-light placeholder:text-text-tertiary-light focus:border-success"
								} focus:outline-none focus:ring-4 focus:ring-success/10`}
								placeholder={connectedAddress || "0x..."}
								value={recipient}
								onChange={(e) => setRecipient(e.target.value)}
							/>
							{connectedAddress && !recipient && (
								<button
									type="button"
									onClick={() => setRecipient(connectedAddress)}
									className="px-6 py-4 rounded-xl bg-success hover:bg-success-dark dark:bg-success-dark text-white font-bold whitespace-nowrap shadow-soft"
								>
									→ Me
								</button>
													)}
										</div>
							
							{type === "ERC1155" && (
								<div>
									<label className={`block text-sm font-semibold mb-2 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
										Amount to mint
									</label>
									<input
										type="number"
										min="1"
										className={`w-full px-5 py-4 rounded-xl text-sm border-2 transition-all ${
											isDarkMode
												? "bg-surface-hover-dark border-border-dark text-text-primary-dark placeholder:text-text-tertiary-dark focus:border-success-dark focus:bg-surface-dark"
												: "bg-white border-border-light text-text-primary-light placeholder:text-text-tertiary-light focus:border-success"
										} focus:outline-none focus:ring-4 focus:ring-success/10`}
										placeholder="1"
										value={amount}
										onChange={(e) => setAmount(e.target.value)}
									/>
									<p className={`text-xs mt-1 ${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}`}>
										Number of editions to mint
									</p>
								</div>
							)}
										</div>
											</div>

					{/* Advanced Options - COLLAPSED */}
					<details
						className={`p-8 rounded-3xl border-2 ${isDarkMode ? "bg-surface-hover-dark border-border-dark" : "bg-surface-hover-light border-border-light"}`}
						open={showAdvanced}
						onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
					>
						<summary className={`cursor-pointer flex items-center justify-between text-lg font-bold ${isDarkMode ? "text-text-primary-dark hover:text-text-secondary-dark" : "text-text-primary-light hover:text-text-secondary-light"} transition-colors`}>
							<span>⚙️ Advanced Options</span>
							<ChevronDown className={`w-5 h-5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
						</summary>
						<div className="mt-8 space-y-8">
							{/* Attributes */}
							<div className="space-y-4">
								<h4 className={`text-lg font-bold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									Properties/Attributes
								</h4>
								<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
									Add custom properties like "Edition", "Year", etc.
								</p>
								{attributes.map((attr, index) => (
									<div key={index} className="flex gap-2">
										<input
											className={`flex-1 px-4 py-2 rounded-lg border ${isDarkMode ? "bg-surface-dark border-border-dark text-text-primary-dark" : "bg-white border-border-light text-text-primary-light"}`}
											placeholder="Property"
											value={attr.trait_type}
											onChange={(e) => {
												const newAttrs = [...attributes];
												newAttrs[index].trait_type = e.target.value;
												setAttributes(newAttrs);
											}}
										/>
										<input
											className={`flex-1 px-4 py-2 rounded-lg border ${isDarkMode ? "bg-surface-dark border-border-dark text-text-primary-dark" : "bg-white border-border-light text-text-primary-light"}`}
											placeholder="Value"
											value={attr.value}
											onChange={(e) => {
												const newAttrs = [...attributes];
												newAttrs[index].value = e.target.value;
												setAttributes(newAttrs);
											}}
										/>
										<button
											type="button"
											onClick={() => setAttributes(attributes.filter((_, i) => i !== index))}
											className={`px-3 py-2 rounded-lg ${isDarkMode ? "hover:bg-surface-hover-dark text-text-tertiary-dark" : "hover:bg-surface-hover-light text-text-tertiary-light"}`}
										>
											✕
										</button>
									</div>
								))}
								<button
									type="button"
									onClick={() => setAttributes([...attributes, { trait_type: "", value: "" }])}
									className={`text-sm font-semibold px-4 py-2 rounded-lg ${isDarkMode ? "text-primary-dark hover:bg-surface-hover-dark" : "text-primary hover:bg-surface-hover-light"}`}
								>
									+ Add Property
								</button>
					</div>

							{/* Display Options */}
							<div className="space-y-4">
								<h4 className={`text-lg font-bold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									Display Mode
								</h4>
								<div className="grid grid-cols-2 gap-4">
									{[
										{ value: 0, name: 'Direct File', desc: 'Show selected URL directly (manual backup switching)' },
										{ value: 1, name: 'Smart HTML', desc: 'Auto-tries each URL until one works (recommended)' },
									].map((mode) => (
										<label
											key={mode.value}
											className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer border-2 transition-all ${
												displayMode === mode.value
													? isDarkMode ? "bg-primary-dark-subtle border-primary-dark" : "bg-primary-subtle border-primary"
													: isDarkMode ? "border-border-dark hover:border-border-hover-dark" : "border-border-light hover:border-border-hover-light"
											}`}
										>
											<input
												type="radio"
												name="displayMode"
												checked={displayMode === mode.value}
												onChange={() => setDisplayMode(mode.value)}
												className="mt-1"
											/>
								<div>
												<p className={`font-semibold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
													{mode.name}
												</p>
												<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
													{mode.desc}
										</p>
									</div>
										</label>
									))}
						</div>
					</div>

							{/* Thumbnail Options */}
							<div className="space-y-4">
								<h4 className={`text-lg font-bold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									Thumbnail Storage
								</h4>
								<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
									Choose how to store your thumbnail image
								</p>
								
								<div className="grid grid-cols-2 gap-4">
									<label
										className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer border-2 transition-all ${
											!useOffchainThumbnail
												? isDarkMode ? "bg-primary-dark-subtle border-primary-dark" : "bg-primary-subtle border-primary"
												: isDarkMode ? "border-border-dark hover:border-border-hover-dark" : "border-border-light hover:border-border-hover-light"
										}`}
									>
										<input
											type="radio"
											name="thumbnailMode"
											checked={!useOffchainThumbnail}
											onChange={() => setUseOffchainThumbnail(false)}
											className="mt-1"
										/>
										<div>
											<p className={`font-semibold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
												On-Chain
											</p>
											<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
												Store on blockchain (max 60KB, higher gas cost)
											</p>
										</div>
									</label>

									<label
										className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer border-2 transition-all ${
											useOffchainThumbnail
												? isDarkMode ? "bg-primary-dark-subtle border-primary-dark" : "bg-primary-subtle border-primary"
												: isDarkMode ? "border-border-dark hover:border-border-hover-dark" : "border-border-light hover:border-border-hover-light"
										}`}
									>
										<input
											type="radio"
											name="thumbnailMode"
											checked={useOffchainThumbnail}
											onChange={() => setUseOffchainThumbnail(true)}
											className="mt-1"
										/>
										<div>
											<p className={`font-semibold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
												Off-Chain URLs
											</p>
											<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
												Use external URLs (cheaper, uses artwork URLs if not specified)
											</p>
										</div>
									</label>
							</div>

								{!useOffchainThumbnail && (
								<div>
										<label className={`block text-sm font-semibold mb-2 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
											Upload Thumbnail File
										</label>
										<div
											className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
												isDarkMode
													? "border-border-dark hover:border-primary-dark hover:bg-surface-hover-dark"
													: "border-border-light hover:border-primary hover:bg-surface-hover-light"
											} ${thumbnailFile ? "border-solid border-success dark:border-success-dark" : ""}`}
										onClick={() => {
											const input = document.createElement("input");
											input.type = "file";
											input.accept = getThumbnailAcceptAttribute();
											input.onchange = () => {
												const file = input.files?.[0];
												if (file && isThumbnailSupported(file)) {
													prepareThumbnail(file);
												} else if (file) {
													alert(getUnsupportedThumbnailMessage(file));
												}
											};
											input.click();
										}}
									>
										{thumbnailPreview ? (
											<div className="space-y-3">
													<FilePreview file={thumbnailFile} previewUrl={thumbnailPreview} maxHeight="max-h-32" />
													<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
														{thumbChunks.length} chunks • {thumbLength} bytes • {(thumbLength / 1024).toFixed(1)}KB
													</p>
													{thumbLength > 20 * 1024 && (
														<p className="text-sm text-warning dark:text-warning-dark font-semibold">
															⚠️ Large file - may result in high gas costs
														</p>
													)}
								</div>
							) : (
								<div>
													<Upload className={`w-10 h-10 mx-auto mb-2 ${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}`} />
													<p className={`text-sm font-semibold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
														Drop thumbnail or click to browse
													</p>
													<p className={`text-xs mt-1 ${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}`}>
														Image files only • Max 60KB
									</p>
								</div>
							)}
						</div>
					</div>
								)}

								{useOffchainThumbnail && (
								<div>
										<label className={`block text-sm font-semibold mb-2 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
											Thumbnail URLs (optional)
									</label>
										<textarea
											rows={3}
											className={`w-full px-4 py-3 rounded-lg font-mono text-sm border ${isDarkMode ? "bg-surface-dark border-border-dark text-text-primary-dark" : "bg-white border-border-light text-text-primary-light"} focus:outline-none focus:ring-2 focus:ring-primary`}
											placeholder="ipfs://thumb1&#10;https://example.com/thumb.jpg&#10;(Leave empty to use artwork URLs)"
											value={thumbnailUrls}
											onChange={(e) => setThumbnailUrls(e.target.value)}
										/>
										<p className={`text-xs mt-1 ${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}`}>
											One URL per line, or leave empty to use artwork URLs as thumbnails
												</p>
											</div>
										)}
					</div>

							{/* Custom HTML Template */}
							<div className="space-y-4">
								<h4 className={`text-lg font-bold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									Custom HTML Template
								</h4>
								<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
									Upload a custom HTML template for Smart HTML mode. Use {"{"}{"{"}{"}"}FILE_URIS{"}"}{"{"}{"}"} and {"{"}{"{"}{"}"}FILE_HASH{"}"}{"{"}{"}"} placeholders.
								</p>
								<div
									className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
										isDarkMode
											? "border-border-dark hover:border-primary-dark hover:bg-surface-hover-dark"
											: "border-border-light hover:border-primary hover:bg-surface-hover-light"
									} ${htmlTemplateFile ? "border-solid border-success dark:border-success-dark" : ""}`}
									onClick={() => {
										const input = document.createElement("input");
										input.type = "file";
										input.accept = ".html,.htm";
										input.onchange = () => {
											const file = input.files?.[0];
											if (file && (file.type === "text/html" || file.name.endsWith(".html"))) {
												prepareHtmlTemplate(file);
											} else if (file) {
												alert("Please upload an HTML file");
											}
										};
										input.click();
									}}
								>
									{htmlTemplateFile ? (
										<div className="space-y-3">
											<div className={`p-4 rounded-lg ${isDarkMode ? "bg-surface-dark border border-border-dark" : "bg-surface-light border border-border-light"}`}>
												<p className={`text-sm font-medium mb-2 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
													{htmlTemplateFile.name}
												</p>
												<p className={`text-xs ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
													{htmlTemplateChunks.length} chunks • {htmlTemplateContent.length} characters
												</p>
											</div>
										</div>
									) : (
										<div>
											<Upload className={`w-10 h-10 mx-auto mb-2 ${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}`} />
											<p className={`text-sm font-semibold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
												Drop HTML template or click to browse
											</p>
											<p className={`text-xs mt-1 ${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}`}>
												Optional - defaults to standard template
											</p>
										</div>
									)}
								</div>
							</div>

							{/* Custom Permissions */}
							<div className="space-y-4">
								<h4 className={`text-lg font-bold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									Fine-Grained Permissions
								</h4>
							<label className="flex items-center gap-3">
								<input
									type="checkbox"
										checked={useCustomPermissions}
										onChange={(e) => setUseCustomPermissions(e.target.checked)}
										className="w-4 h-4"
									/>
									<span className={isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}>
										Customize individual permissions (overrides preset above)
								</span>
							</label>

								{useCustomPermissions && (
									<div className={`p-6 rounded-xl space-y-6 ${isDarkMode ? "bg-surface-dark" : "bg-white border border-border-light"}`}>
										<div>
											<p className={`font-semibold mb-3 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
												Artist Permissions
											</p>
											<div className="space-y-2">
												{[
													{ label: "Update thumbnail", state: artistUpdateThumb, setState: setArtistUpdateThumb },
													{ label: "Update metadata", state: artistUpdateMeta, setState: setArtistUpdateMeta },
													{ label: "Choose which URI displays", state: artistChooseUris, setState: setArtistChooseUris },
													{ label: "Add/remove URIs", state: artistAddRemove, setState: setArtistAddRemove },
													{ label: "Choose thumbnail", state: artistChooseThumb, setState: setArtistChooseThumb },
													{ label: "Change display mode", state: artistUpdateMode, setState: setArtistUpdateMode },
													{ label: "Update HTML template", state: artistUpdateTemplate, setState: setArtistUpdateTemplate },
												].map((perm, i) => (
													<label key={i} className="flex items-center gap-3">
														<input type="checkbox" checked={perm.state} onChange={(e) => perm.setState(e.target.checked)} className="w-4 h-4" />
														<span className={`text-sm ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
															{perm.label}
								</span>
							</label>
												))}
						</div>
					</div>

										<div>
											<p className={`font-semibold mb-3 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
							Collector Permissions
											</p>
											<div className="space-y-2">
												{[
													{ label: "Choose which URI displays", state: collectorChooseUris, setState: setCollectorChooseUris },
													{ label: "Add/remove their own URIs", state: collectorAddRemove, setState: setCollectorAddRemove },
													{ label: "Choose thumbnail", state: collectorChooseThumb, setState: setCollectorChooseThumb },
													{ label: "Change display mode", state: collectorUpdateMode, setState: setCollectorUpdateMode },
												].map((perm, i) => (
													<label key={i} className="flex items-center gap-3">
														<input type="checkbox" checked={perm.state} onChange={(e) => perm.setState(e.target.checked)} className="w-4 h-4" />
														<span className={`text-sm ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
															{perm.label}
								</span>
							</label>
												))}
						</div>
					</div>
								</div>
							)}
						</div>
					</div>
					</details>

					{/* SUBMIT - BIG & BOLD */}
					<div className="pt-1">
						<button
							type="submit"
							disabled={!name || !artworkFile || backupUrlsArray.length === 0 || isPending || isConfirming}
							className={`w-full px-8 py-6 rounded-2xl font-bold text-xl transition-all duration-300 ${
								!name || !artworkFile || backupUrlsArray.length === 0 || isPending || isConfirming
									? "opacity-50 cursor-not-allowed bg-surface-hover-light dark:bg-surface-hover-dark text-text-tertiary-light dark:text-text-tertiary-dark"
									: isDarkMode
										? "bg-primary-dark hover:bg-primary-dark-hover text-white shadow-strong hover:scale-[1.02]"
										: "bg-primary hover:bg-primary-hover text-white shadow-strong hover:scale-[1.02]"
							}`}
						>
							{isPending || isConfirming ? (
								<span className="flex items-center justify-center gap-3">
									<Sparkles className="w-6 h-6 animate-pulse" />
									{isPending ? "Minting Your NFT..." : "Almost There..."}
								</span>
							) : (
								<span className="flex items-center justify-center gap-3">
									<Sparkles className="w-6 h-6" />
									Mint
								</span>
							)}
						</button>
						</div>

					{/* Errors */}
					{writeError && (
						<div className={`p-6 rounded-2xl ${isDarkMode ? "bg-danger-dark-subtle border-2 border-danger-dark" : "bg-danger-subtle border-2 border-danger"}`}>
							<p className={`font-bold text-lg mb-2 ${isDarkMode ? "text-danger-dark" : "text-danger"}`}>
								Something went wrong
							</p>
							<p className={`text-sm ${isDarkMode ? "text-danger-dark" : "text-danger"}`}>
									{writeError?.message?.includes("User rejected")
									? "You cancelled the transaction. Click 'Mint' again when ready!" 
									: "Transaction failed. Please check your wallet and try again."
								}
							</p>
						</div>
					)}
				</form>
			</div>

			<Footer isDarkMode={isDarkMode} />
		</PageBackground>
	);
}

