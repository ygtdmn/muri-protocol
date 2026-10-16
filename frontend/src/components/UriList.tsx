import { toGatewayUrl, useLinkProbes } from "../hooks/useLinkHealth";
import { hostOf } from "../lib/uri";
import type { LinkHealth } from "../hooks/useLinkHealth";
import { Button, StatusLabel } from "./ui";
import type { Tone } from "./ui";

const health: Record<LinkHealth, { tone: Tone; label: string }> = {
	checking: { tone: "neutral", label: "Checking" },
	live: { tone: "up", label: "Live" },
	dead: { tone: "signal", label: "Dead" },
	unreachable: { tone: "signal", label: "Unreachable" },
	unverified: { tone: "neutral", label: "Responds" },
};

export default function UriList({
	uris,
	selectedIndex,
	showSelection,
	onSelect,
	onRemove,
	busy,
	emptyLabel = "No URIs yet.",
}: {
	uris: readonly string[];
	selectedIndex?: number;
	/** Selection only matters in direct-file mode; Smart HTML tries every URI. */
	showSelection?: boolean;
	onSelect?: (index: number) => void;
	onRemove?: (index: number) => void;
	busy?: boolean;
	emptyLabel?: string;
}) {
	const probes = useLinkProbes(uris);

	if (uris.length === 0) {
		return <p className="text-[13px] text-muted py-4 border-y border-line">{emptyLabel}</p>;
	}

	return (
		<ol className="flex flex-col border-t border-line">
			{uris.map((uri, i) => {
				const selected = showSelection && selectedIndex === i;
				const probe = probes[i];
				const status = health[probe.health];
				// For ar:// and ipfs://, name the gateway that actually served it.
				const via = probe.health === "live" && !/^https?:/i.test(uri) ? hostOf(probe.url) : undefined;
				const href = probe.url ?? toGatewayUrl(uri);
				return (
					<li key={`${i}-${uri}`} className="border-b border-line py-3.5 flex flex-col gap-2.5">
						<div className="flex items-start gap-4">
							<span className="micro text-faint tabular-nums pt-[3px] w-5 shrink-0">
								{String(i).padStart(2, "0")}
							</span>
							{href ? (
								<a
									href={href}
									target="_blank"
									rel="noopener noreferrer"
									className="flex-1 min-w-0 font-mono text-[12px] leading-relaxed break-all hover:opacity-60 transition-opacity"
								>
									{uri}
								</a>
							) : (
								<span className="flex-1 min-w-0 font-mono text-[12px] leading-relaxed break-all text-muted">{uri}</span>
							)}
						</div>
						<div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-9">
							<span title="Checked from your browser. Some hosts block this check.">
								<StatusLabel tone={status.tone}>{status.label}</StatusLabel>
							</span>
							{via && <span className="micro text-faint">via {via}</span>}
							{selected && <span className="micro text-foreground">Displayed</span>}
							<span className="flex-1" />
							{showSelection && onSelect && !selected && (
								<Button size="sm" variant="ghost" disabled={busy} onClick={() => onSelect(i)}>
									Display this
								</Button>
							)}
							{onRemove && (
								<Button
									size="sm"
									variant="ghost"
									className="hover:text-signal!"
									disabled={busy}
									onClick={() => onRemove(i)}
								>
									Remove
								</Button>
							)}
						</div>
					</li>
				);
			})}
		</ol>
	);
}
