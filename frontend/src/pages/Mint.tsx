import { useMemo, useState, useCallback, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useChainId, useWalletClient } from "wagmi";
import { useSearchParams, useNavigate } from "react-router-dom";
import type { Address } from "viem";
import { decodeEventLog } from "viem";
import { wayfinderExtensionAbi } from "../abis/wayfinder-manifold-extension-abi";
import fastlz from "../lib/fastlz";
import { sha256 } from "js-sha256";
import { Upload, Link2, Sparkles, ChevronDown, User, Info, Cloud } from "lucide-react";
import {
	isFileSupported,
	getUnsupportedFileMessage,
	getFileInfo,
	isThumbnailSupported,
	getThumbnailAcceptAttribute,
	getUnsupportedThumbnailMessage
} from "../utils/fileValidation";
import { pinToIPFSWithX402, getIPFSUrl, estimatePinningCost } from "../utils/pinatax402";
import FilePreview from "../components/FilePreview";
import Header from "../components/Header";
import { useTheme } from "../hooks/useTheme";
import Footer from "../components/Footer";

type PermissionPreset = 'collaborative' | 'full' | 'frozen';

export default function Mint() {
	const [sp] = useSearchParams();
	const navigate = useNavigate();
	const { address: connectedAddress } = useAccount();
	const chainId = useChainId();
	const { data: walletClient } = useWalletClient();
	const creator = (sp.get("creator") || "") as Address;
	const type = sp.get("type") || "Unknown";
	const { isDarkMode, toggleTheme } = useTheme();

	// === SIMPLE ESSENTIAL FIELDS ===
	const [artworkFile, setArtworkFile] = useState<File | null>(null);
	const [artworkPreview, setArtworkPreview] = useState<string>("");
	const [name, setName] = useState("");
	const [backupUrls, setBackupUrls] = useState("");
	const [recipient, setRecipient] = useState("");
	const [permissionPreset, setPermissionPreset] = useState<PermissionPreset>('collaborative');

	// === ADVANCED (HIDDEN) ===
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [description, setDescription] = useState("");
	const [externalUrl, setExternalUrl] = useState("");
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
						const decoded = decodeEventLog({ abi: wayfinderExtensionAbi, data: log.data, topics: log.topics });
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
		setImageMimeType(file.type);
		const reader = new FileReader();
		reader.onload = (e) => setArtworkPreview(e.target?.result as string);
		reader.readAsDataURL(file);
		const buffer = await file.arrayBuffer();
		const hash = sha256.hex(new Uint8Array(buffer));
		setImageHash(`0x${hash}`);
		const fileInfo = getFileInfo(file);
		const isStaticImage = fileInfo.category === "image" && !file.type.includes("gif");
		setIsAnimationUri(!isStaticImage);
	}, []);

	const prepareThumbnail = useCallback(async (file: File) => {
		const fileSizeKB = file.size / 1024;
		const MAX_SIZE_KB = 120;

		if (fileSizeKB > MAX_SIZE_KB) {
			alert(
				`File too large for on-chain storage. Maximum size is ${MAX_SIZE_KB}KB, your file is ${fileSizeKB.toFixed(1)}KB. Please compress or resize your thumbnail.`
			);
			return;
		}

		setThumbnailFile(file);
		setThumbMime(file.type);

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

	const handleX402Pinning = useCallback(async () => {
		if (!artworkFile || !walletClient) {
			setPinningError("Missing artwork file or wallet connection");
			return;
		}

		setIsPinning(true);
		setPinningError("");
		setPinnedCid("");

		try {
			const result = await pinToIPFSWithX402({
				file: artworkFile,
				name: name || artworkFile.name,
				walletClient,
			});

			const ipfsUrl = getIPFSUrl(result.cid);
			setPinnedCid(result.cid);
			
			// Auto-populate backup URLs with the IPFS URL if empty
			if (!backupUrls.trim()) {
				setBackupUrls(ipfsUrl);
			} else if (!backupUrls.includes(ipfsUrl)) {
				setBackupUrls(`${ipfsUrl}\n${backupUrls}`);
			}

			setIsPinning(false);
		} catch (error) {
			console.error("x402 pinning error:", error);
			setPinningError(error instanceof Error ? error.message : "Failed to pin to IPFS");
			setIsPinning(false);
		}
	}, [artworkFile, walletClient, name, backupUrls]);

	const backupUrlsArray = useMemo(
		() => backupUrls.split("\n").map((s) => s.trim()).filter(Boolean),
		[backupUrls]
	);

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
			collaborative: (1<<0)|(1<<1)|(1<<2)|(1<<3)|(1<<4)|(1<<5)|(1<<6)|(1<<7)|(1<<8), 
			full: (1<<0)|(1<<1)|(1<<2)|(1<<3)|(1<<4)|(1<<5)|(1<<6), 
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
		if (externalUrl) fields.push(`"external_url":${JSON.stringify(externalUrl)}`);
		if (attributes.length > 0) {
			const validAttrs = attributes
				.filter((a) => a.trait_type && a.value !== "")
				.map((attr) => `{"trait_type":${JSON.stringify(attr.trait_type)},"value":${JSON.stringify(attr.value)}}`);
			if (validAttrs.length > 0) {
				fields.push(`"attributes":[${validAttrs.join(",")}]`);
			}
		}
		return fields.join(",");
	}, [name, description, externalUrl, attributes]);

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
			htmlTemplate: { chunks: [] as readonly Address[], zipped: false },
		}),
		[metadataJson, backupUrlsArray, imageMimeType, imageHash, isAnimationUri, permissionsFlags, displayMode, useOffchainThumbnail, thumbnailUrlsArray, thumbMime]
	);

	const onSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const recipientAddress = (recipient || connectedAddress) as Address;
		const thumbnailChunksToSend = useOffchainThumbnail ? [] : (thumbChunks as readonly `0x${string}`[]);

		if (type === "ERC721") {
				writeContract({
					abi: wayfinderExtensionAbi,
					address: import.meta.env.VITE_WAYFINDER_EXTENSION_ADDRESS as Address,
				functionName: "mintERC721",
				args: [creator, recipientAddress, initConfig, thumbnailChunksToSend, []],
					value: 0n,
				});
			} else {
				writeContract({
					abi: wayfinderExtensionAbi,
					address: import.meta.env.VITE_WAYFINDER_EXTENSION_ADDRESS as Address,
				functionName: "mintERC1155",
				args: [creator, [recipientAddress], [BigInt(1)], initConfig, thumbnailChunksToSend, []],
					value: 0n,
				});
			}
	};

	// === SUCCESS STATE ===
	if (isSuccess) {
		const network = getManifoldNetwork(chainId);
		const manifoldLink = mintedTokenId ? `https://gallery.manifold.xyz/${network}/${creator}/${mintedTokenId}` : null;

		return (
			<div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? "bg-bg-dark" : "bg-bg-light"}`}>
				<div className="max-w-2xl w-full text-center animate-scale-in">
					<div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-8 ${
						isDarkMode ? "bg-success-dark-subtle" : "bg-success-subtle"
					}`}>
						<Sparkles className={`w-14 h-14 ${isDarkMode ? "text-success-dark" : "text-success"}`} />
				</div>

					<h2 className={`text-4xl md:text-5xl font-bold mb-4 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
						Your Art is Protected! 🎨
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
							className="inline-block px-10 py-5 rounded-2xl bg-gradient-to-r from-primary to-secondary hover:from-primary-hover hover:to-secondary-hover text-white font-bold text-lg shadow-strong transition-all duration-200 mb-8"
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
			</div>
		);
	}

	// === MAIN FORM ===
	return (
		<div className={`min-h-screen flex flex-col ${isDarkMode ? "bg-bg-dark" : "bg-bg-light"}`}>
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
								? "bg-gradient-to-br from-primary-dark-subtle to-secondary-dark-subtle border-primary-dark"
								: "bg-gradient-to-br from-primary-subtle to-secondary-subtle border-primary"
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
										✓ Ready to protect
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
								isDarkMode ? "bg-secondary-dark-subtle" : "bg-secondary-subtle"
							}`}>
								<Link2 className={`w-6 h-6 ${isDarkMode ? "text-secondary-dark" : "text-secondary"}`} />
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
											? "bg-surface-hover-dark border-border-dark text-text-primary-dark placeholder:text-text-tertiary-dark focus:border-primary-dark focus:bg-bg-dark"
											: "bg-white border-border-light text-text-primary-light placeholder:text-text-tertiary-light focus:border-primary"
									} focus:outline-none focus:ring-4 focus:ring-primary/10`}
									placeholder="My Amazing Artwork"
									value={name}
									onChange={(e) => setName(e.target.value)}
									required
								/>
							</div>

							{/* Description & External Link - Collapsed Panel */}
							<details className={`p-5 rounded-xl border ${isDarkMode ? "bg-surface-dark border-border-dark" : "bg-white border-border-light"}`}>
								<summary className={`cursor-pointer font-semibold ${isDarkMode ? "text-text-primary-dark hover:text-text-secondary-dark" : "text-text-primary-light hover:text-text-secondary-light"} transition-colors`}>
									<span className="inline-flex items-center gap-2">
										<ChevronDown className="w-4 h-4 inline" />
										Add description & link (optional)
									</span>
								</summary>
								<div className="mt-4 space-y-4">
							<div>
										<label className={`block text-sm font-semibold mb-2 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
											Description
										</label>
								<textarea
									rows={4}
											className={`w-full px-4 py-3 rounded-lg border ${isDarkMode ? "bg-surface-hover-dark border-border-dark text-text-primary-dark" : "bg-surface-light border-border-light text-text-primary-light"} focus:outline-none focus:ring-2 focus:ring-primary`}
									placeholder="Tell the story behind your artwork..."
									value={description}
									onChange={(e) => setDescription(e.target.value)}
								/>
							</div>

							<div>
										<label className={`block text-sm font-semibold mb-2 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
											External Link
										</label>
								<input
											className={`w-full px-4 py-3 rounded-lg border ${isDarkMode ? "bg-surface-hover-dark border-border-dark text-text-primary-dark" : "bg-surface-light border-border-light text-text-primary-light"} focus:outline-none focus:ring-2 focus:ring-primary`}
									placeholder="https://yourwebsite.com"
									value={externalUrl}
									onChange={(e) => setExternalUrl(e.target.value)}
								/>
							</div>
						</div>
							</details>

							{/* Backup URLs */}
						<div>
								<label className={`block text-lg font-bold mb-2 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									Backup Locations
								</label>
								<p className={`text-sm mb-3 leading-relaxed ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
									Upload your file to multiple places, paste the links here (one per line).
									<br />
									<strong>More backups = better protection!</strong> If one fails, we'll use another.
								</p>
							<textarea
									rows={5}
									className={`w-full px-5 py-4 rounded-xl font-mono text-sm border-2 transition-all ${
										isDarkMode
											? "bg-surface-hover-dark border-border-dark text-text-primary-dark placeholder:text-text-tertiary-dark focus:border-secondary-dark focus:bg-bg-dark"
											: "bg-white border-border-light text-text-primary-light placeholder:text-text-tertiary-light focus:border-secondary"
									} focus:outline-none focus:ring-4 focus:ring-secondary/10`}
									placeholder={"ipfs://QmYourFileHash\nhttps://arweave.net/your-id\nhttps://your-server.com/file.png"}
									value={backupUrls}
									onChange={(e) => setBackupUrls(e.target.value)}
								required
							/>
								
								{/* Quick Upload Links */}
								<div className={`mt-4 p-5 rounded-xl ${isDarkMode ? "bg-surface-hover-dark" : "bg-surface-hover-light"}`}>
									<div className="flex items-start gap-3 mb-3">
										<Info className={`w-5 h-5 mt-0.5 ${isDarkMode ? "text-primary-dark" : "text-primary"}`} />
										<div>
											<p className={`font-semibold mb-1 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
												Where to upload?
											</p>
											<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
												Upload to 2-3 of these for good protection:
											</p>
											</div>
											</div>
									<div className="grid grid-cols-2 md:grid-cols-3 gap-2">
										{[
											{ name: "Web3.Storage", url: "https://web3.storage", free: true },
											{ name: "ArDrive", url: "https://ardrive.net", free: false },
											{ name: "Archive.org", url: "https://archive.org/create", free: true },
											{ name: "GitHub", url: "https://github.com", free: true },
											{ name: "Cloudflare R2", url: "https://developers.cloudflare.com/r2/", free: true },
										].map((service) => (
											<a
												key={service.name}
												href={service.url}
										target="_blank"
										rel="noopener noreferrer"
												className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${
											isDarkMode
														? "bg-surface-dark hover:bg-surface-hover-dark text-text-primary-dark border border-border-dark"
														: "bg-white hover:bg-surface-hover-light text-text-primary-light border border-border-light"
												}`}
											>
												<span>{service.name}</span>
												<span className={`text-xs font-bold ${service.free ? "text-success dark:text-success-dark" : "text-warning dark:text-warning-dark"}`}>
													{service.free ? "FREE" : "PAID"}
										</span>
									</a>
										))}
											</div>
						</div>
								
								{/* x402 IPFS Auto-Pinning */}
								<div className={`mt-6 p-6 rounded-xl border-2 ${
									enableX402Pinning 
										? isDarkMode ? "bg-secondary-dark-subtle border-secondary-dark" : "bg-secondary-subtle border-secondary"
										: isDarkMode ? "bg-surface-dark border-border-dark" : "bg-white border-border-light"
								}`}>
									<div className="flex items-start gap-3 mb-4">
										<Cloud className={`w-6 h-6 mt-1 ${
											enableX402Pinning
												? isDarkMode ? "text-secondary-dark" : "text-secondary"
												: isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"
										}`} />
										<div className="flex-1">
											<label className="flex items-center gap-3 cursor-pointer">
												<input
													type="checkbox"
													checked={enableX402Pinning}
													onChange={(e) => {
														setEnableX402Pinning(e.target.checked);
														if (!e.target.checked) {
															setPinnedCid("");
															setPinningError("");
														}
													}}
													className="w-5 h-5"
												/>
												<div>
													<p className={`font-bold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
														🚀 Auto-pin to IPFS (Pinata x402)
													</p>
													<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
														Pay to pin your file to IPFS for 12 months via x402 protocol
														{artworkFile && ` • Est. ${estimatePinningCost(artworkFile.size)} USDC`}
													</p>
												</div>
											</label>
										</div>
									</div>

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
															: "bg-gradient-to-r from-secondary to-primary hover:from-secondary-hover hover:to-primary-hover text-white shadow-soft hover:shadow-medium hover:scale-[1.02]"
													}`}
												>
													<span className="flex items-center justify-center gap-2">
														<Cloud className="w-5 h-5" />
														Pin to IPFS Now
													</span>
												</button>
											)}

											{isPinning && (
												<div className={`p-4 rounded-lg ${isDarkMode ? "bg-surface-hover-dark" : "bg-surface-hover-light"}`}>
													<div className="flex items-center gap-3">
														<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-secondary dark:border-secondary-dark"></div>
														<p className={`text-sm font-semibold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
															Waiting for payment approval and pinning...
														</p>
													</div>
												</div>
											)}

											{pinnedCid && (
												<div className={`p-4 rounded-lg ${isDarkMode ? "bg-success-dark-subtle border border-success-dark" : "bg-success-subtle border border-success"}`}>
													<p className={`text-sm font-bold mb-2 ${isDarkMode ? "text-success-dark" : "text-success"}`}>
														✓ Pinned successfully!
													</p>
													<p className={`text-xs font-mono break-all ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
														CID: {pinnedCid}
													</p>
													<p className={`text-xs mt-2 ${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}`}>
														IPFS URL has been added to backup locations
													</p>
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
													<button
														type="button"
														onClick={handleX402Pinning}
														className={`mt-3 text-sm font-semibold ${isDarkMode ? "text-secondary-dark hover:underline" : "text-secondary hover:underline"}`}
													>
														Try again
													</button>
												</div>
											)}

											<div className={`text-xs ${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}`}>
												<p className="flex items-start gap-2">
													<span>ℹ️</span>
													<span>Uses x402 protocol for instant, frictionless payments. Your wallet will prompt you to approve the payment in USDC on Base.</span>
												</p>
											</div>
										</div>
									)}
								</div>
					</div>

							{/* Permission Presets */}
							<div>
								<label className={`block text-lg font-bold mb-3 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									Who can update this artwork?
								</label>
								<div className="grid gap-4">
									{[
										{ id: 'collaborative' as PermissionPreset, name: 'Collaborative', emoji: '🤝', desc: 'You control it, collectors can add backup links (recommended for preservation)' },
										{ id: 'full' as PermissionPreset, name: 'Artist Only', emoji: '🎨', desc: 'Only you can make any changes' },
										{ id: 'frozen' as PermissionPreset, name: 'Frozen Forever', emoji: '❄️', desc: 'Nobody can change it (maximum decentralization)' },
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
								isDarkMode ? "bg-success-dark-subtle" : "bg-success-subtle"
							}`}>
								<User className={`w-6 h-6 ${isDarkMode ? "text-success-dark" : "text-success"}`} />
											</div>
										<div>
								<h2 className={`text-2xl font-bold ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									Who Gets It?
								</h2>
								<p className={`text-sm ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
									Leave blank to mint to yourself
								</p>
								</div>
							</div>

						<div className="flex gap-3">
										<input
								className={`flex-1 px-5 py-4 rounded-xl font-mono text-sm border-2 transition-all ${
									isDarkMode
										? "bg-surface-hover-dark border-border-dark text-text-primary-dark placeholder:text-text-tertiary-dark focus:border-success-dark focus:bg-bg-dark"
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
												Store on blockchain (max 120KB, higher gas cost)
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
														Image files only • Max 120KB
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
					<div className="pt-6">
						<button
							type="submit"
							disabled={!name || !artworkFile || backupUrlsArray.length === 0 || isPending || isConfirming}
							className={`w-full px-8 py-6 rounded-2xl font-bold text-xl transition-all duration-300 ${
								!name || !artworkFile || backupUrlsArray.length === 0 || isPending || isConfirming
									? "opacity-50 cursor-not-allowed bg-surface-hover-light dark:bg-surface-hover-dark text-text-tertiary-light dark:text-text-tertiary-dark"
									: "bg-gradient-to-r from-primary to-secondary hover:from-primary-hover hover:to-secondary-hover text-white shadow-strong hover:shadow-[0_8px_40px_rgba(59,130,246,0.4)] hover:scale-[1.02]"
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
									Mint Protected NFT
								</span>
							)}
						</button>

						<button
							type="button"
							onClick={() => navigate("/collections")}
							className={`w-full mt-3 px-6 py-3 rounded-xl font-semibold transition-all ${
								isDarkMode
									? "text-text-secondary-dark hover:text-text-primary-dark hover:bg-surface-hover-dark"
									: "text-text-secondary-light hover:text-text-primary-light hover:bg-surface-hover-light"
							}`}
						>
							Cancel
						</button>
						</div>

					{/* Helpful Info Box */}
					<div className={`p-6 rounded-2xl ${isDarkMode ? "bg-info-dark-subtle/30 border border-info-dark/20" : "bg-info-subtle border border-info/20"}`}>
						<div className="flex items-start gap-3">
							<Info className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDarkMode ? "text-info-dark" : "text-info"}`} />
							<div className="text-sm leading-relaxed">
								<p className={`font-semibold mb-1 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
									What happens after minting?
								</p>
								<p className={isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}>
									Your NFT will automatically try each backup URL in order until one works.
									If collectors have permission, they can add even more backup links to help preserve your work.
									It's like having a community helping keep your art alive forever.
								</p>
							</div>
						</div>
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
		</div>
	);
}

