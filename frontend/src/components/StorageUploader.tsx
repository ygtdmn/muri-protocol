import { useEffect, useRef, useState } from "react";
import { useConnection, useChainId, useReadContract } from "wagmi";
import { erc20Abi } from "viem";
import { Button, Dropzone, Loader, Notice } from "./ui";
import RelayTopUp from "./RelayTopUp";
import { FreeTierUnavailable, PaidUploadError, quoteStorage, requiredUsdc, uploadToStorage } from "../lib/storage";
import { BASE_CHAIN_ID, BASE_USDC } from "../lib/relay";
import { requireTerms } from "../lib/terms";
import type { StorageProvider, StorageQuote, StoredFile } from "../lib/storage";
import { formatUsdc } from "../lib/x402";
import { formatBytes, hashFile } from "../lib/muri";
import GatewayLink from "./GatewayLink";

const PROVIDERS: {
	id: StorageProvider;
	name: string;
	term: string;
	via: string;
}[] = [
	{
		id: "arweave",
		name: "Arweave",
		term: "Permanent, paid once",
		via: "ar.io Turbo",
	},
	{
		id: "ipfs",
		name: "IPFS",
		term: "Pinned for 12 months",
		via: "Pinata",
	},
];

type RowState =
	| { status: "quoting" }
	| { status: "quoted"; quote: StorageQuote; note?: string }
	| { status: "quote-failed"; error: string }
	| { status: "uploading"; quote: StorageQuote }
	/** Not enough USDC on Base: the Relay top-up panel is open. */
	| { status: "funding"; quote: StorageQuote; funded: boolean }
	/** `resume` retries an upload that was already paid for, without paying again. */
	| { status: "failed"; quote: StorageQuote; error: string; resume?: () => Promise<StoredFile> };

/**
 * Upload a file to Arweave and/or IPFS, paid per upload in USDC on Base over x402.
 * Pass `file` when the page already holds the artwork (mint); otherwise the user picks one here,
 * and `expectedHash` guards against backing up the wrong file.
 */
export default function StorageUploader({
	file: providedFile,
	expectedHash,
	stored,
	onStored,
	onBusyChange,
	disabled,
}: {
	file?: File | null;
	expectedHash?: string;
	stored: StoredFile[];
	onStored: (file: StoredFile) => void;
	/** Told when an upload starts and when the last one ends, so the page can hold back meanwhile. */
	onBusyChange?: (busy: boolean) => void;
	disabled?: boolean;
}) {
	const { address, isConnected } = useConnection();
	const chainId = useChainId();
	// Where the user was before any Relay swap or x402 payment moved the wallet around.
	const homeChain = useRef<number | undefined>(undefined);
	const usdc = useReadContract({
		address: BASE_USDC,
		abi: erc20Abi,
		functionName: "balanceOf",
		args: address ? [address] : undefined,
		chainId: BASE_CHAIN_ID,
		query: { enabled: Boolean(address) },
	});
	const usdcBalance = usdc.data ?? 0n;
	const refetchUsdc = async () => (await usdc.refetch()).data ?? 0n;
	const [pickedFile, setPickedFile] = useState<File | null>(null);
	const [hashError, setHashError] = useState<string | null>(null);
	const [checkingHash, setCheckingHash] = useState(false);
	const [rows, setRows] = useState<Partial<Record<StorageProvider, RowState>>>({});

	const file = providedFile !== undefined ? providedFile : pickedFile;
	const usable = file && !hashError && !checkingHash;
	// The file an upload is for must still be the current one when it finishes.
	const currentFile = useRef(file);
	useEffect(() => {
		currentFile.current = file;
	}, [file]);
	// Providers with an upload or payment in progress. A ref, not state, so a double-click is caught
	// before the first await rather than after the next render.
	const inFlight = useRef(new Set<StorageProvider>());
	const pickId = useRef(0);

	const busy = Object.values(rows).some((r) => r?.status === "uploading");
	const onBusyChangeRef = useRef(onBusyChange);
	useEffect(() => {
		onBusyChangeRef.current = onBusyChange;
	});
	useEffect(() => onBusyChangeRef.current?.(busy), [busy]);

	useEffect(() => {
		if (!file || hashError || checkingHash) {
			setRows({});
			return;
		}
		let cancelled = false;
		setRows({ arweave: { status: "quoting" }, ipfs: { status: "quoting" } });
		for (const provider of PROVIDERS) {
			quoteStorage(provider.id, file)
				.then((quote) => {
					if (!cancelled) setRows((r) => ({ ...r, [provider.id]: { status: "quoted", quote } }));
				})
				.catch((error: unknown) => {
					if (!cancelled)
						setRows((r) => ({
							...r,
							[provider.id]: {
								status: "quote-failed",
								error: error instanceof Error ? error.message : "Quote failed",
							},
						}));
				});
		}
		return () => {
			cancelled = true;
		};
	}, [file, hashError, checkingHash]);

	const pick = async (next: File) => {
		const id = ++pickId.current;
		setPickedFile(next);
		setHashError(null);
		if (!expectedHash) return;
		setCheckingHash(true);
		try {
			const hash = await hashFile(next);
			// A later pick replaced this file while it was hashing; its own check decides.
			if (id !== pickId.current) return;
			if (hash.toLowerCase() !== expectedHash.toLowerCase()) {
				setHashError(
					"This file's SHA-256 doesn't match the hash stored for this token. Smart HTML would reject it, so it can't serve as a backup."
				);
			}
		} catch {
			// Fail closed: a file we couldn't check can't be paid for.
			if (id === pickId.current) setHashError("Couldn't read this file to check its hash. Try choosing it again.");
		} finally {
			if (id === pickId.current) setCheckingHash(false);
		}
	};

	const upload = async (provider: StorageProvider) => {
		const row = rows[provider];
		if (!file || !row || !("quote" in row) || inFlight.current.has(provider)) return;
		inFlight.current.add(provider);
		const quote = row.quote;
		const uploadFile = file;
		const stillCurrent = () => currentFile.current === uploadFile;
		try {
			if (!(await requireTerms())) return;
			if (row.status !== "funding") homeChain.current = chainId;

			// Free Arweave uploads skip payment; everything else needs USDC on Base first.
			if (!(provider === "arweave" && quote.likelyFree)) {
				const balance = await refetchUsdc();
				if (balance < requiredUsdc(quote)) {
					setRows((r) => ({ ...r, [provider]: { status: "funding", quote, funded: false } }));
					return;
				}
			}

			setRows((r) => ({ ...r, [provider]: { status: "uploading", quote } }));
			const settle = async (attempt: Promise<StoredFile>) => {
				try {
					const result = await attempt;
					// The page moved on to another file while this one uploaded: its copy is no use there.
					if (!stillCurrent()) return;
					onStored(result);
					setRows((r) => ({ ...r, [provider]: { status: "quoted", quote } }));
				} catch (error) {
					if (!stillCurrent()) return;
					if (error instanceof FreeTierUnavailable) {
						setRows((r) => ({
							...r,
							[provider]: { status: "quoted", quote: { ...quote, likelyFree: false }, note: error.message },
						}));
						return;
					}
					setRows((r) => ({
						...r,
						[provider]: {
							status: "failed",
							quote,
							error: error instanceof Error ? error.message : "Upload failed",
							resume: error instanceof PaidUploadError ? error.resume : undefined,
						},
					}));
				}
			};
			await settle(row.status === "failed" && row.resume ? row.resume() : uploadToStorage(uploadFile, quote, homeChain.current));
		} finally {
			inFlight.current.delete(provider);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			{providedFile === undefined && (
				<Dropzone
					compact
					onFile={pick}
					title={pickedFile ? pickedFile.name : "Choose the original artwork file"}
					hint={
						pickedFile
							? `${formatBytes(pickedFile.size)} · click to choose another`
							: "We check it against the token's on-chain hash before you pay."
					}
					error={hashError}
				/>
			)}

			<ul className="flex flex-col border-t border-line">
				{PROVIDERS.map((provider) => {
					const row = rows[provider.id];
					const done = stored.find((s) => s.provider === provider.id);
					const quote = row && "quote" in row ? row.quote : undefined;
					const free = provider.id === "arweave" && quote?.likelyFree;
					const needsWallet = !free && !isConnected;

					return (
						<li key={provider.id} className="border-b border-line py-4 flex flex-col gap-3">
							<div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[8rem_minmax(0,1fr)_6rem_auto] items-center gap-x-4 gap-y-1">
								<span className="font-medium">{provider.name}</span>
								<span className="text-[13px] text-muted order-3 sm:order-0 col-span-2 sm:col-span-1">
									{provider.term} · via {provider.via}
								</span>
								<span className="micro text-muted tabular-nums text-right hidden sm:block">
									{!file
										? "—"
										: row?.status === "quoting"
											? "…"
											: free
												? "Free"
												: quote
													? formatUsdc(quote.usdc)
													: "—"}
								</span>
								<div className="justify-self-end row-span-1">
									{done ? (
										<span className="micro text-up">Stored</span>
									) : (
										<Button
											size="sm"
											variant="secondary"
											disabled={disabled || !usable || !quote || needsWallet}
											loading={row?.status === "uploading"}
											onClick={() => void upload(provider.id)}
										>
											{row?.status === "uploading"
												? "Uploading"
												: quote && !free && file
													? `Pay ${formatUsdc(quote.usdc)}`
													: "Upload"}
										</Button>
									)}
								</div>
							</div>

							{row?.status === "uploading" && (
								<p className="flex items-center gap-3 text-[13px] text-muted">
									<Loader />
									{free
										? "Uploading to Arweave…"
										: "Approve the USDC payment on Base in your wallet. Large files take a while to upload."}
								</p>
							)}
							{row?.status === "funding" &&
								(row.funded ? (
									<Notice
										tone="up"
										title="Step 1 done · USDC is on Base"
										action={
											<Button size="sm" onClick={() => void upload(provider.id)}>
												Step 2 · Pay {formatUsdc(row.quote.usdc)} for {provider.name} →
											</Button>
										}
									>
										Your wallet now holds {formatUsdc(usdcBalance)} USDC on Base.
									</Notice>
								) : (
									<div className="flex flex-col gap-2">
										<RelayTopUp
											needed={requiredUsdc(row.quote)}
											balance={usdcBalance}
											purpose={`the ${provider.name} upload`}
											refetchBalance={refetchUsdc}
											onFunded={() =>
												setRows((r) => ({ ...r, [provider.id]: { status: "funding", quote: row.quote, funded: true } }))
											}
										/>
										<div>
											<Button
												size="sm"
												variant="ghost"
												onClick={() => setRows((r) => ({ ...r, [provider.id]: { status: "quoted", quote: row.quote } }))}
											>
												Cancel
											</Button>
										</div>
									</div>
								))}
							{done && (
								<GatewayLink uri={done.uri} className="link font-mono text-[12px] break-all text-muted" />
							)}
							{row?.status === "quoted" && row.note && <p className="text-[13px] text-caution">{row.note}</p>}
							{row?.status === "failed" && (
								<Notice
									tone="signal"
									title="Upload failed"
									action={
										<Button size="sm" variant="ghost" onClick={() => void upload(provider.id)}>
											{row.resume ? "Retry upload (already paid) →" : "Try again →"}
										</Button>
									}
								>
									{row.error}
								</Notice>
							)}
							{row?.status === "quote-failed" && (
								<p className="text-[13px] text-signal">{row.error}</p>
							)}
							{needsWallet && file && !done && (
								<p className="text-[13px] text-muted">Connect a wallet to pay.</p>
							)}
						</li>
					);
				})}
			</ul>
			<p className="text-[12px] text-faint leading-relaxed">
				Optional, for convenience. MURI takes no fee: you pay ar.io or Pinata directly, in USDC on Base
				over x402, with one signature and no approval transaction. No USDC on Base? We'll offer to swap or
				bridge it with Relay first. Prefer to host the file yourself? Add your own links instead.
				{isConnected && usdc.data !== undefined && (
					<>
						{" "}
						You have <span className="text-muted">{formatUsdc(usdcBalance)}</span> USDC on Base.
					</>
				)}
			</p>
		</div>
	);
}
