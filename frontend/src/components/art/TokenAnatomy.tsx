import { useLinkProbes } from "../../hooks/useLinkHealth";
import type { LinkHealth } from "../../hooks/useLinkHealth";
import { OFF_CHAIN_ART } from "../../lib/offChainArt";
import { Dot } from "../ui";
import type { Tone } from "../ui";

const tone: Record<LinkHealth, Tone> = {
	checking: "neutral",
	live: "up",
	dead: "signal",
	unreachable: "signal",
	unverified: "caution",
};

function Node({
	label,
	title,
	detail,
	accent,
}: {
	label: string;
	title: string;
	detail: string;
	accent?: boolean;
}) {
	return (
		<div className={`flex flex-col gap-1 p-4 border ${accent ? "border-foreground" : "border-line-strong"} bg-background`}>
			<span className="micro text-faint">{label}</span>
			<span className="font-medium text-[15px]">{title}</span>
			<span className="text-[12px] text-muted leading-snug">{detail}</span>
		</div>
	);
}

// A connector with a dot that travels along it, showing the direction of resolution.
function Flow({ delay = 0 }: { delay?: number }) {
	return (
		<div aria-hidden className="relative flex items-center justify-center lg:w-10 h-8 lg:h-auto">
			<div className="absolute inset-y-0 left-1/2 w-px lg:inset-x-0 lg:top-1/2 lg:bottom-auto lg:h-px lg:w-auto bg-line-strong" />
			<span
				className="absolute w-1.5 h-1.5 bg-foreground left-[calc(50%-3px)] lg:left-0 lg:top-[calc(50%-3px)] animate-[flow-y_2.4s_ease-in-out_infinite] lg:animate-[flow-x_2.4s_ease-in-out_infinite]"
				style={{ animationDelay: `${delay}s` }}
			/>
		</div>
	);
}

/** What happens when a marketplace asks a MURI token for its artwork, drawn with Off-Chain Art's real links. */
export default function TokenAnatomy() {
	const probes = useLinkProbes(OFF_CHAIN_ART.uris.map((u) => u.uri));
	const firstLive = probes.findIndex((p) => p.health === "live");

	return (
		<div className="flex flex-col gap-5">
			<div className="grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1.5fr)_auto_minmax(0,0.9fr)] items-stretch">
				<Node label="On-chain" title="tokenURI" detail="Metadata JSON, built by the contract on every read." />
				<Flow />
				<Node label="On-chain" title="Smart HTML" detail="animation_url. A page that tries each link in order." />
				<Flow delay={0.6} />
				<div className="flex flex-col p-4 border border-line-strong bg-background gap-2">
					<span className="micro text-faint">Off-chain · {OFF_CHAIN_ART.uris.length} copies</span>
					<ol className="flex flex-col gap-1.5">
						{OFF_CHAIN_ART.uris.map((u, i) => (
							<li key={u.uri} className="flex items-center gap-2.5 text-[13px]">
								<span className="micro text-faint tabular-nums w-4">{i + 1}</span>
								<Dot tone={tone[probes[i].health]} />
								<span className={i === firstLive ? "font-medium" : probes[i].health === "live" || probes[i].health === "checking" ? "" : "text-muted line-through decoration-1"}>
									{u.host}
								</span>
								{i === firstLive && <span className="micro text-up ml-auto">Used</span>}
							</li>
						))}
					</ol>
				</div>
				<Flow delay={1.2} />
				<Node accent label="Checked" title="sha256 =" detail={`${OFF_CHAIN_ART.fileHash.slice(0, 10)}…, stored on-chain. Wrong file, next link.`} />
			</div>
			<p className="text-[12px] text-faint">
				Link statuses are Off-Chain Art's real links, checked from your browser just now.
			</p>
		</div>
	);
}
