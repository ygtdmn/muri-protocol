import { useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useChainId, useReadContracts } from "wagmi";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { readContract } from "wagmi/actions";
import { isAddress } from "viem";
import type { Address } from "viem";
import { wagmiConfig } from "../lib/wagmi";
import { ierc721CreatorCoreAbi } from "../abis/IERC721CreatorCore-abi";
import { ierc1155CreatorCoreAbi } from "../abis/IERC1155CreatorCore-abi";
import { muriAbi } from "../abis/muri-abi";
import { useManifoldAuth } from "../hooks/useManifoldAuth";
import Layout from "../components/Layout";
import ConnectWallet from "../components/ConnectWallet";
import CollectionSetup from "../components/CollectionSetup";
import {
	Button,
	ButtonLink,
	Field,
	Input,
	LoadingLine,
	Notice,
	PageTitle,
	Section,
	StatusLabel,
} from "../components/ui";
import { readResult } from "../utils/readResults";
import { MURI_ADDRESS, MURI_EXTENSION_ADDRESS, shortAddress } from "../lib/muri";
import type { CollectionType } from "../lib/muri";

type Collection = {
	address: Address;
	type: CollectionType;
	name?: string;
};

const nameAbi = [
	{
		type: "function",
		name: "name",
		inputs: [],
		outputs: [{ name: "", type: "string", internalType: "string" }],
		stateMutability: "view",
	},
] as const;

async function inspectCollection(address: Address): Promise<Collection | null> {
	const [is721, is1155] = await Promise.all([
		readContract(wagmiConfig, {
			address,
			abi: ierc721CreatorCoreAbi,
			functionName: "supportsInterface",
			args: ["0x80ac58cd"],
		}).catch(() => false),
		readContract(wagmiConfig, {
			address,
			abi: ierc1155CreatorCoreAbi,
			functionName: "supportsInterface",
			args: ["0xd9b67a26"],
		}).catch(() => false),
	]);
	if (!is721 && !is1155) return null;
	const name = await readContract(wagmiConfig, {
		address,
		abi: nameAbi,
		functionName: "name",
	}).catch(() => undefined);
	return { address, type: is721 ? "ERC721" : "ERC1155", name };
}

function useAddressLookup() {
	const [input, setInput] = useState("");
	const [checking, setChecking] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const check = async (): Promise<Collection | null> => {
		const value = input.trim();
		setError(null);
		if (!isAddress(value)) {
			setError("That isn't a valid contract address.");
			return null;
		}
		setChecking(true);
		try {
			const found = await inspectCollection(value);
			if (!found) setError("No ERC-721 or ERC-1155 contract found at this address on the current network.");
			return found;
		} finally {
			setChecking(false);
		}
	};

	return { input, setInput, checking, error, check };
}

function RoleChooser() {
	const roles = [
		{
			to: "/collections?role=creator",
			title: "Mint or manage artworks",
			body: "For artists with a Manifold Creator Core collection.",
		},
		{
			to: "/collections?role=collector",
			title: "Preserve a token you own",
			body: "Add your own backups to art you collect, if the artist allows it.",
		},
	];
	return (
		<div className="flex flex-col gap-12">
			<PageTitle title="What are you here to do?" />
			<ul className="grid gap-6 md:grid-cols-2">
				{roles.map((role) => (
					<li key={role.to}>
						<Link to={role.to} className="group flex flex-col bg-surface h-full">
							<div className="flex items-end justify-between gap-6 p-6 md:p-8">
								<span className="flex flex-col gap-1.5">
									<span className="font-medium text-[clamp(1.2rem,1rem+0.6vw,1.5rem)] tracking-[-0.01em]">
										{role.title}
									</span>
									<span className="text-muted text-[14px]">{role.body}</span>
								</span>
								<span className="text-xl transition-transform duration-200 group-hover:translate-x-1">→</span>
							</div>
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}

function CreatorFlow() {
	const { address } = useConnection();
	const chainId = useChainId();
	const { token, session, isAuthenticated, isAuthenticating, authenticate } = useManifoldAuth();
	const lookup = useAddressLookup();
	const [selected, setSelected] = useState<Collection | null>(null);
	const [discovered, setDiscovered] = useState<Collection[]>([]);
	const [discovering, setDiscovering] = useState(false);
	const [discoverError, setDiscoverError] = useState<string | null>(null);
	const [authError, setAuthError] = useState<string | null>(null);
	const setupRef = useRef<HTMLDivElement>(null);

	const registrationContracts = useMemo(() => {
		if (!selected) return undefined;
		return [
			{
				abi: selected.type === "ERC721" ? ierc721CreatorCoreAbi : ierc1155CreatorCoreAbi,
				address: selected.address,
				functionName: "getExtensions",
			},
			{
				abi: muriAbi,
				address: MURI_ADDRESS,
				functionName: "isContractOperator",
				args: [selected.address, MURI_EXTENSION_ADDRESS],
			},
		] as const;
	}, [selected]);

	const registration = useReadContracts({
		allowFailure: true,
		contracts: registrationContracts,
		query: { enabled: !!registrationContracts, staleTime: 30_000 },
	});

	const extensions = readResult<readonly Address[]>(registration.data?.[0]);
	const extensionRegistered = Boolean(
		extensions?.some((e) => e.toLowerCase() === MURI_EXTENSION_ADDRESS.toLowerCase())
	);
	const contractRegistered = readResult<boolean>(registration.data?.[1]) ?? false;
	const ready = extensionRegistered && contractRegistered;

	useEffect(() => {
		setDiscovered([]);
		setSelected(null);
		setAuthError(null);
	}, [address, chainId]);

	useEffect(() => {
		if (selected) setupRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	}, [selected]);

	const discover = async () => {
		if (!token || !session) return;
		setDiscovering(true);
		setDiscoverError(null);
		try {
			const res = await fetch(
				"https://studio.api.manifoldxyz.dev/contract_deployer/creator-core/all",
				{ headers: { Authorization: `Bearer ${token}`, Accept: "application/json", Session: session } }
			);
			if (!res.ok) throw new Error(`Manifold returned ${res.status}`);
			const all = (await res.json()) as {
				name: string;
				spec: string;
				contractInfo: { networkId: number; status: string; contractAddress: string }[];
			}[];
			setDiscovered(
				all.flatMap((c) => {
					const info = c.contractInfo.find(
						(i) => i.networkId === chainId && i.status === "deploy-complete"
					);
					if (!info || (c.spec !== "ERC721" && c.spec !== "ERC1155")) return [];
					return [{ address: info.contractAddress as Address, type: c.spec, name: c.name }];
				})
			);
		} catch (error) {
			setDiscoverError(error instanceof Error ? error.message : "Couldn't load collections.");
		} finally {
			setDiscovering(false);
		}
	};

	useEffect(() => {
		if (address && isAuthenticated) void discover();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [address, chainId, isAuthenticated]);

	return (
		<div className="flex flex-col gap-14">
			<PageTitle title="Choose a collection">
				MURI works through a Manifold Creator Core extension. Pick one of your collections, run the
				one-time setup, then mint or update tokens.
			</PageTitle>

			<div className="flex flex-col gap-6 md:gap-8">
				<Section title="Your collections" description="Found through your Manifold Studio account.">
					{!address ? (
						<div className="flex flex-col items-start gap-5">
							<p className="text-muted">Connect the wallet you use on Manifold Studio.</p>
							<ConnectWallet />
						</div>
					) : !isAuthenticated ? (
						<div className="flex flex-col items-start gap-5">
							<p className="text-muted max-w-[52ch]">
								Sign a message to let this page read your Manifold collections. It's a signature, not a
								transaction.
							</p>
							<Button
								loading={isAuthenticating}
								onClick={async () => {
									try {
										setAuthError(null);
										await authenticate();
									} catch (error) {
										setAuthError(error instanceof Error ? error.message : "Sign-in failed");
									}
								}}
							>
								Sign in with Manifold
							</Button>
							{authError && (
								<Notice tone="signal" title="Sign-in failed">
									{authError}
									{authError.includes("not registered") && (
										<>
											{" "}
											<a href="https://studio.manifold.xyz" target="_blank" rel="noopener noreferrer" className="link">
												Register at studio.manifold.xyz ↗
											</a>
										</>
									)}
								</Notice>
							)}
						</div>
					) : discovering && discovered.length === 0 ? (
						<LoadingLine label="Loading collections" />
					) : (
						<div className="flex flex-col gap-5">
							{discoverError && <Notice tone="signal" title="Couldn't load collections">{discoverError}</Notice>}
							{discovered.length === 0 && !discoverError ? (
								<p className="text-muted">
									No Creator Core collections on this network.{" "}
									<a href="https://studio.manifold.xyz" target="_blank" rel="noopener noreferrer" className="link text-foreground">
										Create one on Manifold Studio ↗
									</a>
								</p>
							) : (
								<ul className="flex flex-col border-t border-line">
									{discovered.map((c) => {
										const active = selected?.address === c.address;
										return (
											<li key={c.address}>
												<button
													type="button"
													onClick={() => setSelected(c)}
													aria-pressed={active}
													className={`w-full grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_5rem_9rem] items-center gap-4 py-4 border-b border-line text-left transition-colors hover:bg-background px-2 -mx-2 ${
														active ? "bg-background" : ""
													}`}
												>
													<span className="font-medium truncate">
														{active && <span aria-hidden>→ </span>}
														{c.name || "Untitled collection"}
													</span>
													<span className="micro text-muted">{c.type}</span>
													<span className="font-mono text-[12px] text-muted hidden sm:block text-right">
														{shortAddress(c.address)}
													</span>
												</button>
											</li>
										);
									})}
								</ul>
							)}
							<div>
								<Button size="sm" variant="ghost" loading={discovering} onClick={() => void discover()}>
									Refresh
								</Button>
							</div>
						</div>
					)}
				</Section>

				<Section title="Or paste an address" description="Any Manifold Creator Core you admin.">
					<form
						className="flex flex-col gap-2"
						onSubmit={async (e) => {
							e.preventDefault();
							const found = await lookup.check();
							if (found) setSelected(found);
						}}
					>
						<div className="flex flex-col sm:flex-row gap-3 sm:items-end">
						<Field label="Collection address" htmlFor="creator-address" className="flex-1">
							<Input
								id="creator-address"
								className="font-mono text-[13px]"
								placeholder="0x…"
								value={lookup.input}
								onChange={(e) => lookup.setInput(e.target.value)}
								spellCheck={false}
								autoComplete="off"
							/>
						</Field>
						<Button type="submit" variant="secondary" loading={lookup.checking} disabled={!lookup.input.trim()}>
							Look up
						</Button>
						</div>
						{lookup.error && <p className="text-[13px] text-signal">{lookup.error}</p>}
					</form>
				</Section>

				{selected && (
					<div ref={setupRef} className="scroll-mt-24 animate-fade-in">
						<Section
							title={selected.name || "Selected collection"}
							description={
								<span className="font-mono text-[12px] break-all">
									{selected.type} · {selected.address}
								</span>
							}
						>
							<div className="flex flex-col gap-8">
								{registration.isLoading ? (
									<LoadingLine label="Checking setup" />
								) : (
									<>
										<div className="flex items-center justify-between gap-4">
											<span className="micro text-muted">One-time setup</span>
											<StatusLabel tone={ready ? "up" : "caution"}>
												{ready ? "Ready" : "Needs setup"}
											</StatusLabel>
										</div>
										<CollectionSetup
											creator={selected.address}
											type={selected.type}
											extensionRegistered={extensionRegistered}
											contractRegistered={contractRegistered}
											onChanged={() => void registration.refetch()}
										/>
									</>
								)}
								<div className="flex flex-col sm:flex-row gap-3">
									<ButtonLink
										to={`/mint?creator=${selected.address}&type=${selected.type}&chain=${chainId}`}
										aria-disabled={!ready}
										className={!ready ? "pointer-events-none opacity-35" : ""}
									>
										Mint new artwork →
									</ButtonLink>
									<ButtonLink
										variant="secondary"
										to={`/update?creator=${selected.address}&type=${selected.type}&chain=${chainId}`}
										aria-disabled={!ready}
										className={!ready ? "pointer-events-none opacity-35" : ""}
									>
										Update a token
									</ButtonLink>
								</div>
							</div>
						</Section>
					</div>
				)}
			</div>
		</div>
	);
}

function CollectorFlow() {
	const navigate = useNavigate();
	const chainId = useChainId();
	const lookup = useAddressLookup();
	const [tokenId, setTokenId] = useState("");

	return (
		<div className="flex flex-col gap-14">
			<PageTitle title="Find the token you own">
				If the artist allowed it, you can add your own backup copies to a token and choose how it
				displays. Smart HTML tries your links after the artist's.
			</PageTitle>
			<Section title="Token">
				<form
					className="flex flex-col gap-5"
					onSubmit={async (e) => {
						e.preventDefault();
						const found = await lookup.check();
						if (found) {
							const params = new URLSearchParams({ creator: found.address, type: found.type, chain: String(chainId) });
							if (tokenId.trim()) params.set("token", tokenId.trim());
							navigate(`/collector-zone?${params}`);
						}
					}}
				>
					<div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
						<Field label="Collection address" htmlFor="collector-address" error={lookup.error}>
							<Input
								id="collector-address"
								className="font-mono text-[13px]"
								placeholder="0x…"
								value={lookup.input}
								onChange={(e) => lookup.setInput(e.target.value)}
								spellCheck={false}
								autoComplete="off"
							/>
						</Field>
						<Field label="Token ID" htmlFor="collector-token" optional>
							<Input
								id="collector-token"
								inputMode="numeric"
								placeholder="1"
								value={tokenId}
								onChange={(e) => setTokenId(e.target.value.replace(/[^\d]/g, ""))}
							/>
						</Field>
					</div>
					<div>
						<Button type="submit" loading={lookup.checking} disabled={!lookup.input.trim()}>
							Continue →
						</Button>
					</div>
				</form>
			</Section>
		</div>
	);
}

export default function Collections() {
	const [params] = useSearchParams();
	const role = params.get("role");

	return (
		<Layout>
			{role === "creator" ? <CreatorFlow /> : role === "collector" ? <CollectorFlow /> : <RoleChooser />}
		</Layout>
	);
}
