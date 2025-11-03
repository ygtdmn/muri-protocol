import { useEffect, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { useNavigate } from "react-router-dom";
import { readContract } from "wagmi/actions";
import type { Address } from "viem";
import { wagmiConfig } from "../lib/wagmi";
import { ierc721CreatorCoreAbi } from "../abis/IERC721CreatorCore-abi";
import { ierc1155CreatorCoreAbi } from "../abis/IERC1155CreatorCore-abi";
import { muriAbi } from "../abis/muri-abi";
import RegisterExtension from "../components/RegisterExtension";
import RegisterMURI from "../components/RegisterMURI";
import { useManifoldAuth } from "../hooks/useManifoldAuth";
import { useReadContract } from "wagmi";
import { Palette, Heart, RefreshCw, ArrowLeft, Search } from "lucide-react";
import Header from "../components/Header";
import ConnectButtonPrimary from "../components/ConnectButtonPrimary";
import { useTheme } from "../hooks/useTheme";
import Footer from "../components/Footer";
import PageBackground from "../components/PageBackground";
import { CollectionCard } from "../components/features/CollectionCard";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";

type CreatorCoreInfo = {
	address: Address;
	type: "ERC721" | "ERC1155" | "Unknown";
	name?: string;
	isAdmin: boolean | null;
};

export default function Collections() {
	const { address } = useAccount();
	const navigate = useNavigate();
	const chainId = useChainId();
	const { token, session, isAuthenticated, isAuthenticating, authenticate } =
		useManifoldAuth();
	const [creatorInput, setCreatorInput] = useState("");
	const [resolved, setResolved] = useState<CreatorCoreInfo | null>(null);
	const [checking, setChecking] = useState(false);
	const [discovering, setDiscovering] = useState(false);
	const [discovered, setDiscovered] = useState<CreatorCoreInfo[]>([]);
	const [userRole, setUserRole] = useState<"creator" | "collector" | null>(
		null
	);
	const [authError, setAuthError] = useState<string | null>(null);
	const { isDarkMode, toggleTheme } = useTheme();

	// Check if extension is registered with Manifold
	const coreAbi =
		resolved?.type === "ERC721"
			? ierc721CreatorCoreAbi
			: ierc1155CreatorCoreAbi;
	const { data: extensions, refetch: refetchExtensions } = useReadContract({
		abi: coreAbi,
		address: resolved?.address,
		functionName: "getExtensions",
		args: [],
		query: { enabled: !!resolved?.address && resolved?.type !== "Unknown" },
	});

	const muriExtensionAddress = import.meta.env
		.VITE_MURI_EXTENSION_ADDRESS as Address;
	const isExtensionRegistered =
		extensions && Array.isArray(extensions)
			? extensions.includes(muriExtensionAddress)
			: false;

	// Check if contract is registered with MURI Protocol
	const { data: isContractRegistered, refetch: refetchContractRegistration } = useReadContract({
		abi: muriAbi,
		address: import.meta.env.VITE_MURI_ADDRESS as Address,
		functionName: "isContractOperator",
		args: [
			resolved?.address ||
				("0x0000000000000000000000000000000000000000" as Address),
			muriExtensionAddress,
		],
		query: { enabled: !!resolved?.address },
	});

	const canProceed = Boolean(
		resolved &&
			resolved.isAdmin &&
			isExtensionRegistered &&
			isContractRegistered
	);

	useEffect(() => {
		setResolved(null);
	}, [creatorInput]);

	// Clear discovered collections when wallet address changes
	useEffect(() => {
		setDiscovered([]);
		setResolved(null);
		setAuthError(null);
	}, [address]);

	const checkCreator = async () => {
		if (!address) return;
		try {
			setChecking(true);
			const core = creatorInput.trim() as Address;

			const is721 = await readContract(wagmiConfig, {
				address: core,
				abi: ierc721CreatorCoreAbi,
				functionName: "supportsInterface",
				args: ["0x80ac58cd" as `0x${string}`],
			}).catch(() => false);

			const is1155 = await readContract(wagmiConfig, {
				address: core,
				abi: ierc1155CreatorCoreAbi,
				functionName: "supportsInterface",
				args: ["0xd9b67a26" as `0x${string}`],
			}).catch(() => false);

			// Skip admin check for now as requested
			const isAdmin = true; // await readContract(wagmiConfig, {
			//   address: core,
			//   abi: (IAdminControl as any).abi,
			//   functionName: 'isAdmin',
			//   args: [address],
			// }).catch(() => null)

			// Fetch contract name using standard ERC721/ERC1155 name function
			let contractName: string | undefined;
			try {
				const nameAbi = [
					{
						type: "function",
						name: "name",
						inputs: [],
						outputs: [{ name: "", type: "string", internalType: "string" }],
						stateMutability: "view",
					},
				] as const;

				if (is721 || is1155) {
					contractName = await readContract(wagmiConfig, {
						address: core,
						abi: nameAbi,
						functionName: "name",
						args: [],
					});
				}
			} catch (error) {
				console.log("Could not fetch contract name:", error);
			}

			const info: CreatorCoreInfo = {
				address: core,
				type: is721 ? "ERC721" : is1155 ? "ERC1155" : "Unknown",
				name: contractName,
				isAdmin: isAdmin,
			};
			setResolved(info);
		} finally {
			setChecking(false);
		}
	};

	const discoverCreatorCores = async () => {
		if (!address || !token || !session) return;
		try {
			setDiscovering(true);

			console.log("Discovering creator cores via Manifold API");

			// Fetch all creator cores from Manifold API
			const response = await fetch(
				"https://studio.api.manifoldxyz.dev/contract_deployer/creator-core/all",
				{
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: "application/json",
						Session: session,
					},
				}
			);

			if (!response.ok) {
				throw new Error(`Manifold API error: ${response.status}`);
			}

			const allContracts = await response.json();
			console.log(`Found ${allContracts.length} total creator cores`);

			// Map chainId to networkId
			const chainIdToNetworkId: Record<number, number> = {
				1: 1, // Mainnet
				5: 5, // Goerli
				137: 137, // Polygon
				8453: 8453, // Base
				11155111: 11155111, // Sepolia
			};

			const networkId = chainIdToNetworkId[chainId];
			if (!networkId) {
				console.log("Unsupported network for discovery");
				setDiscovered([]);
				return;
			}

			// Filter contracts for current network
			interface ContractInfo {
				networkId: number;
				status: string;
				contractAddress: string;
			}
			interface Contract {
				contractInfo: ContractInfo[];
				spec: string;
				name: string;
			}
			const contractsOnNetwork = allContracts
				.filter((contract: Contract) =>
					contract.contractInfo.some(
						(info: ContractInfo) =>
							info.networkId === networkId && info.status === "deploy-complete"
					)
				)
				.map((contract: Contract) => {
					const info = contract.contractInfo.find(
						(info: ContractInfo) => info.networkId === networkId
					);
					return {
						address: info?.contractAddress as Address,
						spec: contract.spec,
						name: contract.name,
					};
				});

			console.log(
				`Found ${contractsOnNetwork.length} contracts on current network`
			);

			// Skip admin check for now, just return all contracts
			interface NetworkContract {
				address: Address;
				spec: string;
				name: string;
			}
			const results: CreatorCoreInfo[] = contractsOnNetwork.map(
				(contract: NetworkContract) => ({
					address: contract.address,
					type: contract.spec as "ERC721" | "ERC1155",
					name: contract.name,
					isAdmin: true, // Skip admin check for now
				})
			);

			console.log(`Found ${results.length} contracts`);
			setDiscovered(results);
		} catch (error) {
			console.error("Discovery error:", error);
		} finally {
			setDiscovering(false);
		}
	};

	useEffect(() => {
		// Automatically discover creator cores when authenticated
		if (address && isAuthenticated) {
			void discoverCreatorCores();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [address, chainId, isAuthenticated]);

	return (
		<PageBackground
			isDarkMode={isDarkMode}
			className={`scroll-smooth min-h-screen flex flex-col relative ${
				isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"
			}`}
		>
			<Header isDarkMode={isDarkMode} toggleTheme={toggleTheme} />

			{/* Role Selection - Centered */}
			{!userRole && (
			<div className="flex-grow flex items-center justify-center p-4">
				<div className="max-w-5xl w-full">
						<div className="px-4 md:px-6 lg:px-8 py-12">
							<div className="text-center mb-16">
								<h1
									className={`
										text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight
										${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
									`}
							>
								Welcome to{" "}
								<span className={isDarkMode ? "text-primary-dark" : "text-primary"}>
									MURI Protocol
								</span>
							</h1>
								<p
									className={`
										text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed
										${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
									`}
								>
									Are you creating art or collecting it?
								</p>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
								{/* Creator Card */}
								<button
									onClick={() => setUserRole("creator")}
									className={`
										group p-12 md:p-14 rounded-3xl
										border transition-all duration-200
										${
											isDarkMode
												? "bg-surface-dark border-border-dark hover:bg-surface-hover-dark"
												: "bg-surface-light border-border-light hover:bg-surface-hover-light shadow-soft"
										}
									`}
								>
									<div className="text-center space-y-6">
										<div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all duration-200 shadow-lg ${
											isDarkMode 
												? "bg-gradient-to-br from-primary-dark/40 via-primary-dark/20 to-transparent border border-primary-dark/40" 
												: "bg-gradient-to-br from-primary/30 via-primary/15 to-transparent border border-primary/40"
										}`}>
											<Palette className={`w-10 h-10 ${isDarkMode ? "text-primary-dark" : "text-primary"}`} />
										</div>
										
										<div>
											<h3 className={`text-3xl font-bold mb-3 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
											  Creator
											</h3>
											<p className={`text-lg leading-relaxed ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
												Mint NFTs with automatic backup protection.
											</p>
										</div>
									</div>
								</button>

								{/* Collector Card */}
								<button
									onClick={() => setUserRole("collector")}
									className={`
										group p-12 md:p-14 rounded-3xl
										border transition-all duration-200
										${
											isDarkMode
												? "bg-surface-dark border-border-dark hover:bg-surface-hover-dark"
												: "bg-surface-light border-border-light hover:bg-surface-hover-light shadow-soft"
										}
									`}
								>
									<div className="text-center space-y-6">
										<div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all duration-200 shadow-lg ${
											isDarkMode 
												? "bg-gradient-to-br from-secondary-dark/40 via-secondary-dark/20 to-transparent border border-secondary-dark/40" 
												: "bg-gradient-to-br from-secondary/30 via-secondary/15 to-transparent border border-secondary/40"
										}`}>
											<Heart className={`w-10 h-10 ${isDarkMode ? "text-secondary-dark" : "text-secondary"}`} />
										</div>
										
										<div>
											<h3 className={`text-3xl font-bold mb-3 ${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}`}>
												Collector
											</h3>
											<p className={`text-lg leading-relaxed ${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}`}>
												Help preserve art you own. Manage your backup links.
											</p>
										</div>
									</div>
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Main Content for Creator and Collector */}
			<div className="flex-grow">
				{/* Creator Interface - Normal Layout */}
				{userRole === "creator" && (
					<div className="px-4 md:px-6 lg:px-8 py-8 md:py-12 max-w-6xl mx-auto space-y-10">
						<>
							{/* Header with back button */}
							<div className="flex items-center justify-between">
								<button
									onClick={() => setUserRole(null)}
									className={`
										flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium
										transition-all duration-200
										${
											isDarkMode
												? "text-text-secondary-dark hover:text-text-primary-dark hover:bg-surface-hover-dark"
												: "text-text-secondary-light hover:text-text-primary-light hover:bg-surface-hover-light"
										}
									`}
								>
									<ArrowLeft className="w-5 h-5" />
									<span>Back</span>
								</button>
							</div>

							<div>
								<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
									<div>
										<h2
											className={`
												text-4xl md:text-5xl font-bold mb-3
												${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
											`}
										>
											Your Collections
										</h2>
										<p
											className={`
												text-lg md:text-xl
												${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
											`}
										>
											Select a collection to start creating
										</p>
									</div>
									{isAuthenticated && (
										<button
											onClick={discoverCreatorCores}
											disabled={discovering}
											className={`
												flex items-center gap-2 px-4 py-2 rounded-md
												transition-all duration-200
												${
													isDarkMode
														? "bg-surface-dark hover:bg-surface-hover-dark text-text-primary-dark border border-border-dark"
														: "bg-surface-light hover:bg-surface-hover-light text-text-primary-light border border-border-light shadow-soft"
												}
												disabled:opacity-50 disabled:cursor-not-allowed
											`}
										>
											<RefreshCw className={`w-4 h-4 ${discovering ? 'animate-spin' : ''}`} />
											<span className="text-sm font-medium">
												{discovering ? "Searching..." : "Refresh"}
											</span>
										</button>
									)}
								</div>

								{discovered.length > 0 ? (
									<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
										{discovered.map((c) => (
											<CollectionCard
												key={c.address}
												address={c.address}
												name={c.name}
												type={c.type}
												onClick={() => setResolved(c)}
												isDarkMode={isDarkMode}
											/>
										))}
									</div>
								) : (
									<div
										className={`
											rounded-lg p-8
											${
												isDarkMode
													? "bg-surface-dark border border-border-dark"
													: "bg-surface-light border border-border-light"
											}
										`}
									>
										{!address ? (
											<EmptyState
												icon={<Search className="w-full h-full" />}
												title="Connect Your Wallet"
												description="Connect your wallet to discover and manage your Manifold collections"
												action={<ConnectButtonPrimary />}
											/>
										) : !isAuthenticated ? (
											<div className="text-center space-y-6">
												<EmptyState
													icon={<Search className="w-full h-full" />}
													title="Sign in to Manifold"
													description="Authenticate with Manifold to automatically discover your Creator Core collections"
													action={
														<button
															onClick={async () => {
																try {
																	setAuthError(null);
																	await authenticate();
																} catch (error) {
																	setAuthError(error instanceof Error ? error.message : 'Authentication failed');
																}
															}}
															disabled={isAuthenticating}
															className={`
																px-6 py-3 rounded-lg font-semibold
																bg-primary hover:bg-primary-hover
																dark:bg-primary-dark dark:hover:bg-primary-dark-hover
																text-white
																shadow-soft hover:shadow-medium
																transition-all duration-200
																disabled:opacity-50
															`}
														>
															{isAuthenticating ? "Signing in..." : "Sign in to Manifold"}
														</button>
													}
												/>
												
												{authError && (
													<Alert variant="danger" title="Authentication Error">
														{authError}
														{authError.includes("not registered") && (
															<a 
																href="https://studio.manifold.xyz" 
																target="_blank" 
																rel="noopener noreferrer"
																className="block mt-2 font-medium underline"
															>
																Register at studio.manifold.xyz →
															</a>
														)}
													</Alert>
												)}
												
												<p
													className={`
														text-sm
														${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}
													`}
												>
													Or enter your Creator Core contract address below
												</p>
											</div>
										) : (
											<div className="text-center space-y-4">
												<EmptyState
													icon={<Search className="w-full h-full" />}
													title="No Collections Found"
													description="We couldn't find any Manifold collections for your wallet. Enter a collection address below to continue."
												/>
												
												{!discovering && address && (
													<p
														className={`
															text-sm
															${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}
														`}
													>
														Create collections at{" "}
														<a
															href="https://studio.manifold.xyz"
															target="_blank"
															rel="noopener noreferrer"
															className={`
																font-medium underline
																${
																	isDarkMode
																		? "text-primary-dark hover:text-primary-dark-hover"
																		: "text-primary hover:text-primary-hover"
																}
															`}
														>
															studio.manifold.xyz
														</a>
													</p>
												)}
											</div>
										)}
									</div>
								)}
							</div>

							{address && (
								<>
									<div
										className={`
											my-8 border-t
											${isDarkMode ? "border-border-dark" : "border-border-light"}
										`}
									/>

									<div>
										<h3
											className={`
												text-xl font-bold mb-2
												${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
											`}
										>
											Or enter a collection address
										</h3>
										<p
											className={`
												text-sm mb-4
												${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
											`}
										>
											Have a specific Manifold Creator Core contract? Paste it here
										</p>
										<div className="flex gap-3">
											<input
												className={`
													flex-1 px-4 py-3 rounded-md font-mono text-sm
													border transition-all duration-200
													${
														isDarkMode
															? "bg-surface-dark border-border-dark text-text-primary-dark placeholder:text-text-tertiary-dark focus:border-primary-dark"
															: "bg-surface-light border-border-light text-text-primary-light placeholder:text-text-tertiary-light focus:border-primary"
													}
													focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
												`}
												value={creatorInput}
												onChange={(e) => setCreatorInput(e.target.value)}
												placeholder="0x..."
											/>
											<button
												className={`
													px-6 py-3 rounded-lg font-semibold
													bg-primary hover:bg-primary-hover
													dark:bg-primary-dark dark:hover:bg-primary-dark-hover
													text-white
													shadow-soft hover:shadow-medium
													transition-all duration-200
													disabled:opacity-50 disabled:cursor-not-allowed
												`}
												onClick={checkCreator}
												disabled={!creatorInput || checking}
											>
												{checking ? (
													<span className="flex items-center gap-2">
														<RefreshCw className="w-4 h-4 animate-spin" />
														Checking...
													</span>
												) : (
													"Check"
												)}
											</button>
										</div>
									</div>
								</>
							)}

							{resolved && (
								<div
									className={`
										p-8 md:p-10 rounded-3xl animate-slide-up border-2
										${
											isDarkMode
												? "bg-surface-dark border-border-dark shadow-medium"
												: "bg-surface-light border-border-light shadow-strong"
										}
									`}
								>
									<div className="space-y-8">
										<div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
											<div className="flex-1">
												<h3
													className={`
														text-3xl font-bold mb-3
														${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
													`}
												>
													{resolved.name ||
														`${
															resolved.type === "ERC721"
																? "Single Edition"
																: resolved.type === "ERC1155"
																? "Multiple Edition"
																: "Unknown"
														} Collection`}
												</h3>
												<p
													className={`
														text-sm font-mono
														${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}
													`}
												>
													{resolved.address}
												</p>
											</div>
											<div className="flex gap-3">
												<span
													className={`
														px-4 py-2 text-sm font-bold rounded-full
														${
															isExtensionRegistered
																? "bg-success-subtle dark:bg-success-dark-subtle text-success dark:text-success-dark border-2 border-success/30"
																: isDarkMode
																? "bg-surface-hover-dark text-text-tertiary-dark border-2 border-border-dark"
																: "bg-surface-hover-light text-text-tertiary-light border-2 border-border-light"
														}
													`}
												>
													{isExtensionRegistered ? "✓ Extension" : "Extension"}
												</span>
												<span
													className={`
														px-4 py-2 text-sm font-bold rounded-full
														${
															isContractRegistered
																? "bg-success-subtle dark:bg-success-dark-subtle text-success dark:text-success-dark border-2 border-success/30"
																: isDarkMode
																? "bg-surface-hover-dark text-text-tertiary-dark border-2 border-border-dark"
																: "bg-surface-hover-light text-text-tertiary-light border-2 border-border-light"
														}
													`}
												>
													{isContractRegistered ? "✓ MURI Protocol" : "MURI Protocol"}
												</span>
											</div>
										</div>

										{resolved.type !== "Unknown" && (
											<div className="space-y-4">
												<RegisterExtension
													creator={resolved.address}
													type={resolved.type}
													onSuccess={refetchExtensions}
												/>
												<RegisterMURI 
													creator={resolved.address}
													onSuccess={refetchContractRegistration}
												/>
											</div>
										)}

										{!canProceed && (
											<Alert variant="warning" title="Setup Required">
												Complete both registration steps above to start minting and updating
												your NFTs
											</Alert>
										)}

										<div className="grid md:grid-cols-2 gap-5">
									<button
										className={`
											group px-8 py-6 rounded-2xl font-bold text-lg
											transition-all duration-300
											${
												canProceed
													? isDarkMode
														? "bg-primary-dark hover:bg-primary-dark-hover text-white shadow-medium hover:shadow-strong hover:scale-105"
														: "bg-primary hover:bg-primary-hover text-white shadow-medium hover:shadow-strong hover:scale-105"
													: "opacity-40 cursor-not-allowed bg-surface-hover-light dark:bg-surface-hover-dark text-text-tertiary-light dark:text-text-tertiary-dark"
											}
										`}
										disabled={!canProceed}
										onClick={() =>
											navigate(
												`/mint?creator=${resolved.address}&type=${resolved.type}`
											)
										}
									>
												<span className="flex items-center justify-center gap-2">
													Create New Artwork
												</span>
											</button>
											<button
												className={`
													px-8 py-6 rounded-2xl font-bold text-lg
													border-2 transition-all duration-300
													${
														canProceed
															? `
																bg-surface-light hover:bg-surface-hover-light
																dark:bg-surface-dark dark:hover:bg-surface-hover-dark
																text-text-primary-light dark:text-text-primary-dark
																border-border-light dark:border-border-dark
																hover:border-primary dark:hover:border-primary-dark
																hover:scale-105
															`
															: "opacity-40 cursor-not-allowed bg-surface-hover-light dark:bg-surface-hover-dark text-text-tertiary-light dark:text-text-tertiary-dark border-border-light dark:border-border-dark"
													}
												`}
												disabled={!canProceed}
												onClick={() =>
													navigate(
														`/update?creator=${resolved.address}&type=${resolved.type}`
													)
												}
											>
												Update Existing
											</button>
										</div>
									</div>
								</div>
							)}
						</>
					</div>
				)}

				{/* Collector Interface - Normal Layout */}
				{userRole === "collector" && (
					<div className="px-4 md:px-6 lg:px-8 py-8 md:py-12 max-w-6xl mx-auto space-y-10">
						<>
							{/* Header with back button */}
							<div className="flex items-center justify-between">
								<button
									onClick={() => setUserRole(null)}
									className={`
										flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium
										transition-all duration-200
										${
											isDarkMode
												? "text-text-secondary-dark hover:text-text-primary-dark hover:bg-surface-hover-dark"
												: "text-text-secondary-light hover:text-text-primary-light hover:bg-surface-hover-light"
										}
									`}
								>
									<ArrowLeft className="w-5 h-5" />
									<span>Back</span>
								</button>
							</div>

							<div>
								<div className="mb-8">
									<h2
										className={`
											text-4xl md:text-5xl font-bold mb-3
											${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
										`}
									>
										Collector Zone
									</h2>
									<p
										className={`
											text-lg md:text-xl
											${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
										`}
									>
										Help preserve the art you love
									</p>
								</div>

								{address ? (
									<div className="space-y-6">
										<div>
											<h3
												className={`
													text-xl font-bold mb-2
													${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
												`}
											>
												Enter Collection Address
											</h3>
											<p
												className={`
													text-sm mb-4
													${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
												`}
											>
												Paste the Manifold Creator Core contract address for the collection
											</p>
											<div className="flex gap-3">
												<input
													className={`
														flex-1 px-4 py-3 rounded-md font-mono text-sm
														border transition-all duration-200
														${
															isDarkMode
																? "bg-surface-dark border-border-dark text-text-primary-dark placeholder:text-text-tertiary-dark focus:border-primary-dark"
																: "bg-surface-light border-border-light text-text-primary-light placeholder:text-text-tertiary-light focus:border-primary"
														}
														focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
													`}
													value={creatorInput}
													onChange={(e) => setCreatorInput(e.target.value)}
													placeholder="0x..."
												/>
												<button
													className={`
														px-6 py-3 rounded-lg font-semibold
														bg-primary hover:bg-primary-hover
														dark:bg-primary-dark dark:hover:bg-primary-dark-hover
														text-white
														shadow-soft hover:shadow-medium
														transition-all duration-200
														disabled:opacity-50 disabled:cursor-not-allowed
													`}
													onClick={checkCreator}
													disabled={!creatorInput || checking}
												>
													{checking ? (
														<span className="flex items-center gap-2">
															<RefreshCw className="w-4 h-4 animate-spin" />
															Checking...
														</span>
													) : (
														"Check"
													)}
												</button>
											</div>
										</div>

										{resolved && (
											<div
												className={`
													p-8 md:p-10 rounded-3xl animate-slide-up border-2
													${
														isDarkMode
															? "bg-surface-dark border-border-dark shadow-medium"
															: "bg-surface-light border-border-light shadow-strong"
													}
												`}
											>
												<div className="space-y-8">
													<div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
														<div className="flex-1">
															<h3
																className={`
																	text-3xl font-bold mb-3
																	${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
																`}
															>
																{resolved.name ||
																	`${
																		resolved.type === "ERC721"
																			? "Single Edition"
																			: resolved.type === "ERC1155"
																			? "Multiple Edition"
																			: "Unknown"
																	} Collection`}
															</h3>
															<p
																className={`
																	text-sm font-mono
																	${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}
																`}
															>
																{resolved.address}
															</p>
														</div>
														<span
															className={`
																px-5 py-2.5 text-base font-bold rounded-full
																bg-success-subtle dark:bg-success-dark-subtle
																text-success dark:text-success-dark
																border-2 border-success/30
															`}
														>
															✓ Ready
														</span>
													</div>

													<div>
													<button
														className={`
															group w-full px-8 py-6 rounded-2xl font-bold text-lg
															text-white
															shadow-medium hover:shadow-strong
															transition-all duration-300
															hover:scale-105
															${isDarkMode ? "bg-secondary-dark hover:bg-secondary-dark-hover" : "bg-secondary hover:bg-secondary-hover"}
														`}
														onClick={() =>
															navigate(
																`/collector-zone?creator=${resolved.address}&type=${resolved.type}`
															)
														}
													>
															<span className="flex items-center justify-center gap-2">
																Enter Collector Zone
															</span>
														</button>
														<p
															className={`
																text-base mt-4 text-center
																${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
															`}
														>
															Add backup links and help preserve this collection
														</p>
													</div>
												</div>
											</div>
										)}
									</div>
								) : (
									<div
										className={`
											rounded-lg p-8
											${
												isDarkMode
													? "bg-surface-dark border border-border-dark"
													: "bg-surface-light border border-border-light"
											}
										`}
									>
										<EmptyState
											icon={<Heart className="w-full h-full" />}
											title="Connect Your Wallet"
											description="Connect your wallet to discover and customize NFTs you own"
											action={<ConnectButtonPrimary />}
										/>
									</div>
								)}
							</div>
						</>
					</div>
				)}
			</div>

			<Footer isDarkMode={isDarkMode} />
		</PageBackground>
	);
}
