import { useState } from "react";
import {
	ARTIST_PERMISSIONS,
	COLLECTOR_PERMISSIONS,
	PERMISSION,
	PERMISSION_PRESETS,
} from "../../lib/muri";
import type { PermissionKey, PermissionPreset } from "../../lib/muri";

const PRESETS: { id: PermissionPreset; name: string }[] = [
	{ id: "collaborative", name: "Collaborative" },
	{ id: "artist", name: "Artist only" },
	{ id: "frozen", name: "Immutable" },
];

// Bit order as stored in the contract's uint16, highest bit first.
const BITS = (Object.keys(PERMISSION) as PermissionKey[]).sort((a, b) => PERMISSION[b] - PERMISSION[a]);
const LABELS = Object.fromEntries(
	[...ARTIST_PERMISSIONS, ...COLLECTOR_PERMISSIONS].map((p) => [p.key, p.label])
) as Record<PermissionKey, string>;
const isOwnerBit = (key: PermissionKey) => key.startsWith("collector");

/** The token's permissions are one 11-bit number. Click a preset or a bit to see how it's encoded. */
export default function PermissionBits() {
	const [flags, setFlags] = useState<number>(PERMISSION_PRESETS.collaborative);
	const [hover, setHover] = useState<PermissionKey | null>(null);
	const activePreset = PRESETS.find((p) => PERMISSION_PRESETS[p.id] === flags)?.id;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap gap-2" role="group" aria-label="Presets">
				{PRESETS.map((p) => (
					<button
						key={p.id}
						type="button"
						onClick={() => setFlags(PERMISSION_PRESETS[p.id])}
						aria-pressed={activePreset === p.id}
						className={`h-8 px-3 font-mono text-[10px] uppercase tracking-[0.16em] border transition-colors ${
							activePreset === p.id
								? "border-foreground text-foreground"
								: "border-line-strong text-muted hover:text-foreground"
						}`}
					>
						{p.name}
					</button>
				))}
			</div>

			<div className="flex flex-col gap-2">
				<div className="grid grid-cols-11 gap-1 sm:gap-1.5">
					{BITS.map((key) => {
						const on = (flags & PERMISSION[key]) !== 0;
						return (
							<button
								key={key}
								type="button"
								aria-pressed={on}
								aria-label={`${isOwnerBit(key) ? "Owner" : "Artist"}: ${LABELS[key]}`}
								onClick={() => setFlags((f) => f ^ PERMISSION[key])}
								onMouseEnter={() => setHover(key)}
								onMouseLeave={() => setHover(null)}
								onFocus={() => setHover(key)}
								onBlur={() => setHover(null)}
								className={`aspect-square grid place-items-center font-mono text-[11px] sm:text-[13px] border transition-colors duration-150 ${
									on
										? isOwnerBit(key)
											? "bg-muted border-muted text-background"
											: "bg-foreground border-foreground text-background"
										: "border-line-strong text-faint hover:border-muted"
								}`}
							>
								{on ? 1 : 0}
							</button>
						);
					})}
				</div>
				<div className="grid grid-cols-11 gap-1 sm:gap-1.5 micro text-faint">
					<span className="col-span-4">Owner</span>
					<span className="col-span-7">Artist</span>
				</div>
			</div>

			<div className="border-t border-line pt-5">
				<p className="text-[14px] min-h-[1.5em]">
					{hover ? (
						<>
							<span className="text-muted">{isOwnerBit(hover) ? "Owner" : "Artist"} · </span>
							{LABELS[hover]}
						</>
					) : (
						<span className="text-muted">Hover a bit to see what it allows.</span>
					)}
				</p>
			</div>
		</div>
	);
}
