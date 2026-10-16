import { useQuery } from "@tanstack/react-query";
import { quoteBySize } from "../../lib/storage";
import { formatUsdc } from "../../lib/x402";
import { formatBytes } from "../../lib/muri";
import { OFF_CHAIN_ART } from "../../lib/offChainArt";

const rows = [
	{ provider: "arweave" as const, name: "Arweave", term: "Permanent", via: "ar.io Turbo" },
	{ provider: "ipfs" as const, name: "IPFS", term: "12 months", via: "Pinata" },
];

/** Live x402 prices for storing Off-Chain Art's original file today. */
export default function StorageCost() {
	const quotes = useQuery({
		queryKey: ["example-quotes", OFF_CHAIN_ART.fileBytes],
		queryFn: async () => {
			const [arweave, ipfs] = await Promise.allSettled(
				rows.map((r) => quoteBySize(r.provider, OFF_CHAIN_ART.fileBytes, "image/png"))
			);
			return { arweave, ipfs };
		},
		staleTime: 10 * 60_000,
	});

	return (
		<div className="flex flex-col gap-4">
			<p className="text-[14px] text-muted">
				What it costs right now to store the Off-Chain Art original ({formatBytes(OFF_CHAIN_ART.fileBytes)}):
			</p>
			<dl className="flex flex-col border-t border-line">
				{rows.map((r) => {
					const result = quotes.data?.[r.provider];
					const price =
						result?.status === "fulfilled" ? formatUsdc(result.value.usdc) : result ? "Unavailable" : "…";
					return (
						<div
							key={r.provider}
							className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[8rem_minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 py-4 border-b border-line"
						>
							<dt className="font-medium">{r.name}</dt>
							<span className="text-[13px] text-muted order-3 sm:order-0 col-span-2 sm:col-span-1">
								{r.term} · via {r.via}
							</span>
							<dd className="font-mono text-[clamp(1.1rem,1rem+0.4vw,1.35rem)] tabular-nums">{price}</dd>
						</div>
					);
				})}
				<div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[8rem_minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 py-4 border-b border-line">
					<dt className="font-medium">Any URL</dt>
					<span className="text-[13px] text-muted order-3 sm:order-0 col-span-2 sm:col-span-1">
						Your server, S3, GitHub, Internet Archive
					</span>
					<dd className="font-mono text-[clamp(1.1rem,1rem+0.4vw,1.35rem)] text-muted">Yours</dd>
				</div>
			</dl>
			<p className="text-[12px] text-faint">
				MURI takes no fee: these are the providers' own prices, live, paid to them directly in USDC on Base
				over x402. Uploading through the site is optional; links you host yourself cost nothing here.
			</p>
		</div>
	);
}
