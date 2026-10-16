import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { getConnection } from "wagmi/actions";
import { createWalletClient, custom } from "viem";
import type { EIP1193Provider } from "viem";
import { getClient } from "@relayprotocol/relay-sdk";
import type { Execute, RelayChain } from "@relayprotocol/relay-sdk";
import { wagmiConfig } from "../lib/wagmi";
import {
	BASE_CHAIN_ID,
	describeRelayError,
	formatToken,
	getTokenBalance,
	loadRelayChains,
	payableChains,
	quoteUsdcOnBase,
	scanHoldings,
	searchTokens,
} from "../lib/relay";
import type { Holding, RelayToken } from "../lib/relay";
import { formatUsdc } from "../lib/x402";
import { requireTerms } from "../lib/terms";
import { Button, Choice, Input, Loader, Notice } from "./ui";

// Relay routes below this tend to fail or cost more in fees than they move.
const MIN_TOP_UP = 100_000n; // 0.10 USDC

type Details = {
	currencyIn?: { amount?: string; amountFormatted?: string; amountUsd?: string; currency?: { symbol?: string; decimals?: number } };
	currencyOut?: { amountFormatted?: string };
	timeEstimate?: number;
};
type Fees = { relayer?: { amountUsd?: string }; gas?: { amountUsd?: string } };

const usd = (value?: string) => (value ? `$${Number(value).toFixed(Number(value) < 0.01 ? 4 : 2)}` : "–");

function TokenLogo({ src }: { src?: string }) {
	return src ? (
		<img src={src} alt="" className="w-4 h-4 shrink-0 object-contain" loading="lazy" />
	) : (
		<span className="w-4 h-4 shrink-0 bg-line-strong" />
	);
}

/**
 * Get the USDC on Base an x402 payment needs by swapping or bridging from any token on any
 * EVM chain Relay supports. Calls `onFunded` once the USDC has landed.
 */
export default function RelayTopUp({
	needed,
	balance,
	purpose,
	refetchBalance,
	onFunded,
}: {
	/** USDC (atomic) the payment needs on Base. */
	needed: bigint;
	/** USDC (atomic) the wallet already has on Base. */
	balance: bigint;
	/** e.g. "the Arweave upload" */
	purpose: string;
	refetchBalance: () => Promise<bigint>;
	onFunded: () => void;
}) {
	const { address } = useConnection();
	const shortfall = needed > balance ? needed - balance : 0n;
	const topUp = shortfall > MIN_TOP_UP ? shortfall : MIN_TOP_UP;

	const chainsQuery = useQuery({ queryKey: ["relay-chains"], queryFn: loadRelayChains, staleTime: Infinity });
	const chains = useMemo(() => (chainsQuery.data ? payableChains(chainsQuery.data) : []), [chainsQuery.data]);

	const holdings = useQuery({
		queryKey: ["relay-holdings", address],
		queryFn: () => scanHoldings(chainsQuery.data!, address!),
		enabled: Boolean(chainsQuery.data && address),
		staleTime: 60_000,
	});

	const [manual, setManual] = useState(false);
	const [manualChainId, setManualChainId] = useState<number>(BASE_CHAIN_ID);
	const [term, setTerm] = useState("");
	const [debouncedTerm, setDebouncedTerm] = useState("");
	const [selected, setSelected] = useState<{ token: RelayToken; chain: RelayChain } | null>(null);
	const [running, setRunning] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Relay finished but the USDC isn't readable on Base yet.
	const [arriving, setArriving] = useState(false);

	const checkArrival = async () => {
		const next = await refetchBalance();
		if (next >= needed) {
			setArriving(false);
			onFunded();
			return true;
		}
		return false;
	};

	useEffect(() => {
		const t = window.setTimeout(() => setDebouncedTerm(term), 300);
		return () => window.clearTimeout(t);
	}, [term]);

	// Default to the holding most likely to cover the cost: stablecoins first, then native gas tokens.
	const found = holdings.data;
	useEffect(() => {
		if (selected || manual || !found?.length) return;
		const rank = (h: Holding) =>
			/usd/i.test(h.token.symbol) ? 0 : h.token.address === "0x0000000000000000000000000000000000000000" ? 1 : 2;
		const best = [...found].sort((a, b) => rank(a) - rank(b))[0];
		setSelected({ token: best.token, chain: best.chain });
	}, [found, selected, manual]);

	const manualChain = chains.find((c) => c.id === manualChainId);
	const tokenResults = useQuery({
		queryKey: ["relay-tokens", manualChainId, debouncedTerm],
		queryFn: () => searchTokens(manualChain!, debouncedTerm),
		enabled: manual && Boolean(manualChain),
		staleTime: 5 * 60_000,
	});

	const selectedBalance = useQuery({
		queryKey: ["relay-balance", selected?.chain.id, selected?.token.address, address],
		queryFn: () => getTokenBalance(selected!.chain, selected!.token, address!),
		enabled: Boolean(selected && address),
		staleTime: 30_000,
	});

	const quote = useQuery({
		queryKey: ["relay-quote", selected?.chain.id, selected?.token.address, topUp.toString(), address],
		queryFn: () => quoteUsdcOnBase(selected!.token, topUp, address!),
		enabled: Boolean(selected && address && topUp > 0n),
		staleTime: 20_000,
		refetchInterval: running ? false : 30_000,
		retry: false,
	});

	const details = quote.data?.details as Details | undefined;
	const fees = quote.data?.fees as Fees | undefined;
	const amountIn = details?.currencyIn?.amount ? BigInt(details.currencyIn.amount) : undefined;
	const notEnough =
		amountIn !== undefined && selectedBalance.data !== undefined && selectedBalance.data < amountIn;

	const execute = async () => {
		if (!quote.data) return;
		if (!(await requireTerms())) return;
		setError(null);
		setRunning("Preparing");
		try {
			// The SDK expects the wallet to already be on the origin chain. Most Relay chains aren't in
			// this app's wagmi config, so talk to the wallet's provider directly.
			const { connector, address: account } = getConnection(wagmiConfig);
			const chain = selected?.chain.viemChain;
			if (!connector || !account || !chain) throw new Error("Connect a wallet first.");
			const provider = (await connector.getProvider()) as EIP1193Provider;
			const wallet = createWalletClient({ account, chain, transport: custom(provider) });
			if ((await wallet.getChainId()) !== chain.id) {
				setRunning(`Switch your wallet to ${selected.chain.displayName}`);
				try {
					await wallet.switchChain({ id: chain.id });
				} catch {
					await wallet.addChain({ chain });
					await wallet.switchChain({ id: chain.id });
				}
			}
			await getClient().actions.execute({
				quote: quote.data as Execute,
				wallet,
				onProgress: ({ currentStep, currentStepItem }) => {
					const state = currentStepItem?.progressState;
					if (state === "confirming" || state === "signing") {
						setRunning(currentStep?.action || "Confirm in your wallet");
					} else if (state === "validating" || state === "posting") {
						setRunning("Waiting for Relay to deliver USDC on Base");
					}
				},
			});
			setRunning("USDC sent. Waiting for it to show up on Base");
			// The fill can land a moment before the balance is readable from RPC. Only move on once
			// the USDC is really there, so the next step never asks to bridge again.
			for (let i = 0; i < 20; i++) {
				if (await checkArrival()) {
					setRunning(null);
					return;
				}
				await new Promise((r) => setTimeout(r, 1500));
			}
			setRunning(null);
			setArriving(true);
		} catch (e) {
			setRunning(null);
			setError(describeRelayError(e));
		}
	};

	const sources = holdings.data ?? [];

	return (
		<div className="flex flex-col gap-5 bg-background p-4 sm:p-5 animate-fade-in">
			<ol className="grid sm:grid-cols-2 gap-2 text-[13px]">
				<li className="flex gap-2.5 items-baseline">
					<span className="micro text-foreground">1</span>
					<span>
						<span className="font-medium">Get USDC on Base</span>
						<span className="text-muted"> with Relay</span>
					</span>
				</li>
				<li className="flex gap-2.5 items-baseline text-muted">
					<span className="micro">2</span>
					<span>Pay for {purpose}</span>
				</li>
			</ol>

			<p className="text-[13px] text-muted leading-relaxed">
				Storage is paid in USDC on Base. Your wallet has {formatUsdc(balance)} there and {purpose} needs{" "}
				{formatUsdc(needed)}. Relay can swap or bridge{" "}
				<span className="text-foreground">{formatUsdc(topUp)} USDC</span> into your wallet on Base from almost any
				token on any EVM chain it supports, usually within seconds. Anything left over stays in your wallet.
			</p>

			<div className="flex flex-col gap-2">
				<span className="micro text-muted">Pay with</span>
				{!manual && (
					<>
						{chainsQuery.isLoading || holdings.isLoading ? (
							<p className="flex items-center gap-3 text-[13px] text-muted">
								<Loader /> Looking for balances on common chains…
							</p>
						) : sources.length === 0 ? (
							<p className="text-[13px] text-muted">No balances found on the common chains. Pick a chain and token below.</p>
						) : (
							<div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto" role="radiogroup" aria-label="Pay with">
								{sources.map((h) => (
									<Choice
										key={`${h.chain.id}-${h.token.address}`}
										compact
										type="radio"
										name="relay-source"
										checked={selected?.chain.id === h.chain.id && selected.token.address === h.token.address}
										onChange={() => setSelected({ token: h.token, chain: h.chain })}
										title={
											<span className="inline-flex items-center gap-2">
												<TokenLogo src={h.token.logoURI} />
												{h.token.symbol}
												<span className="text-muted">on {h.chain.displayName}</span>
											</span>
										}
										meta={formatToken(h.balance, h.token.decimals)}
									/>
								))}
							</div>
						)}
						<div>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => {
									setManual(true);
									setSelected(null);
									setManualChainId(selected?.chain.id ?? BASE_CHAIN_ID);
								}}
							>
								Another chain or token →
							</Button>
						</div>
					</>
				)}

				{manual && (
					<div className="flex flex-col gap-3">
						<div className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
							<select
								aria-label="Chain"
								className="field"
								value={manualChainId}
								onChange={(e) => {
									setManualChainId(Number(e.target.value));
									setSelected(null);
								}}
							>
								{chains.map((c) => (
									<option key={c.id} value={c.id}>
										{c.displayName}
									</option>
								))}
							</select>
							<Input
								aria-label="Search tokens"
								placeholder="Search a token or paste its address"
								value={term}
								onChange={(e) => setTerm(e.target.value)}
								spellCheck={false}
							/>
						</div>
						{tokenResults.isLoading ? (
							<p className="flex items-center gap-3 text-[13px] text-muted">
								<Loader /> Loading tokens…
							</p>
						) : tokenResults.data?.length === 0 ? (
							<p className="text-[13px] text-muted">Relay doesn't list a token like that on this chain.</p>
						) : (
							<div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto" role="radiogroup" aria-label="Token">
								{tokenResults.data?.map((t) => (
									<Choice
										key={t.address}
										compact
										type="radio"
										name="relay-token"
										checked={selected?.token.address === t.address && selected.chain.id === t.chainId}
										onChange={() => manualChain && setSelected({ token: t, chain: manualChain })}
										title={
											<span className="inline-flex items-center gap-2">
												<TokenLogo src={t.logoURI} />
												{t.symbol}
												<span className="text-muted truncate">{t.name}</span>
											</span>
										}
									/>
								))}
							</div>
						)}
						<div>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => {
									setManual(false);
									setSelected(null);
								}}
							>
								← Back to your balances
							</Button>
						</div>
					</div>
				)}
			</div>

			{selected && (
				<div className="flex flex-col gap-4 border-t border-line pt-4">
					{quote.isLoading ? (
						<p className="flex items-center gap-3 text-[13px] text-muted">
							<Loader /> Getting a quote from Relay…
						</p>
					) : quote.error ? (
						<Notice tone="signal" title="No quote">
							{describeRelayError(quote.error)}
						</Notice>
					) : details ? (
						<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-[13px]">
							<dt className="text-muted">You pay</dt>
							<dd className="text-right tabular-nums">
								{details.currencyIn?.amountFormatted ? formatToken(amountIn ?? 0n, details.currencyIn.currency?.decimals ?? 18) : "–"}{" "}
								{details.currencyIn?.currency?.symbol} on {selected.chain.displayName}
								<span className="text-muted"> ≈ {usd(details.currencyIn?.amountUsd)}</span>
							</dd>
							<dt className="text-muted">You receive</dt>
							<dd className="text-right tabular-nums">{details.currencyOut?.amountFormatted} USDC on Base</dd>
							<dt className="text-muted">Relay fee</dt>
							<dd className="text-right tabular-nums">{usd(fees?.relayer?.amountUsd)}</dd>
							<dt className="text-muted">Network fee</dt>
							<dd className="text-right tabular-nums">{usd(fees?.gas?.amountUsd)}</dd>
							<dt className="text-muted">Time</dt>
							<dd className="text-right tabular-nums">~{details.timeEstimate ?? "?"}s</dd>
							<dt className="text-muted">Your balance</dt>
							<dd className={`text-right tabular-nums ${notEnough ? "text-signal" : ""}`}>
								{selectedBalance.data !== undefined
									? `${formatToken(selectedBalance.data, selected.token.decimals)} ${selected.token.symbol}`
									: selectedBalance.isError
										? "Couldn't read it"
										: "…"}
							</dd>
						</dl>
					) : null}

					{notEnough && (
						<p className="text-[13px] text-signal">
							Not enough {selected.token.symbol} on {selected.chain.displayName}. You have{" "}
							{formatToken(selectedBalance.data ?? 0n, selected.token.decimals)}.
						</p>
					)}

					<div className="flex flex-wrap items-center gap-4">
						<Button
							disabled={!quote.data || Boolean(quote.error) || notEnough || Boolean(running)}
							loading={Boolean(running)}
							onClick={() => void execute()}
						>
							Get {formatUsdc(topUp)} USDC with Relay
						</Button>
						{running && <span className="text-[13px] text-muted">{running}</span>}
					</div>
					{error && <Notice tone="signal" title="Relay didn't complete">{error}</Notice>}
					{arriving && (
						<Notice
							tone="caution"
							title="Still on its way"
							action={
								<Button size="sm" variant="ghost" onClick={() => void checkArrival()}>
									Check again
								</Button>
							}
						>
							Relay finished, but the USDC hasn't shown up on Base yet. It can take a minute. Don't
							bridge again; check again shortly.
						</Notice>
					)}
				</div>
			)}

			<p className="text-[12px] text-faint">
				Swaps and bridges are executed by{" "}
				<a href="https://relay.link" target="_blank" rel="noopener noreferrer" className="link">
					Relay
				</a>
				. The fees above go to Relay and the network; MURI takes none. EVM chains only: Solana, Bitcoin and
				other chains need their own wallet.
			</p>
		</div>
	);
}
