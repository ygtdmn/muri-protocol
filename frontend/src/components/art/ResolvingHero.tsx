import { useEffect, useState } from "react";
import { ButtonLink, Dot } from "../ui";
import type { Tone } from "../ui";
import { probeLabel, useViewerReplay } from "../../hooks/useViewerReplay";
import type { ReplayLine } from "../../hooks/useViewerReplay";
import { OFF_CHAIN_ART } from "../../lib/offChainArt";
import { formatBytes } from "../../lib/muri";

const lineTone: Record<NonNullable<ReplayLine["tone"]>, string> = {
	dim: "text-white/45",
	ok: "text-[#7ee2a8]",
	bad: "text-[#ff8a80]",
};

// Each copy chip shows a different crop of the same artwork: six copies, one image.
const CROPS = ["14% 40%", "88% 20%", "50% 85%", "30% 75%", "70% 55%", "5% 90%"];

type ChipState = { label: string; tone: Tone; state: "waiting" | "trying" | "live" | "used" | "dead" };

/**
 * The homepage hero. MURI's pitch on the left; on the right, Off-Chain Art (the work MURI grew out
 * of) resolving live: the frame starts on the on-chain thumbnail, the token's viewer is replayed
 * against its six real copies, and the full image appears once a live copy is found.
 */
export default function ResolvingHero() {
	const replay = useViewerReplay();
	const [logOpen, setLogOpen] = useState(false);
	const { probes, found, done, trying, reported, verifiedUrl } = replay;
	const resolved = found >= 0;

	// Once the hash matches, get the log out of the way so the verified original shows.
	useEffect(() => {
		if (!verifiedUrl) return;
		const t = window.setTimeout(() => setLogOpen(false), 1400);
		return () => window.clearTimeout(t);
	}, [verifiedUrl]);
	const lastLine = replay.lines[replay.lines.length - 1];

	const chip = (i: number): ChipState => {
		const probe = probes[i];
		const revealed = reported.has(i) || done;
		if (!revealed || probe.health === "checking") {
			return trying === i
				? { label: "Trying", tone: "caution", state: "trying" }
				: { label: "Waiting", tone: "neutral", state: "waiting" };
		}
		if (probe.health === "live") {
			return i === found
				? { label: "Showing", tone: "up", state: "used" }
				: { label: "Standby", tone: "up", state: "live" };
		}
		return { label: probeLabel(probe), tone: "signal", state: "dead" };
	};

	return (
		<section className="mx-auto w-full max-w-[1320px] px-5 md:px-10 pt-10 md:pt-14 lg:pt-16 pb-6">
			<div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:items-center">
				<div className="flex flex-col gap-7">
					<h1 className="font-medium leading-[0.98] tracking-tight text-[clamp(2.6rem,1.2rem+4vw,4.75rem)]">
						MURI
						<br />
						Protocol
					</h1>
					<p className="text-muted leading-relaxed text-pretty max-w-[46ch] text-[clamp(1rem,0.94rem+0.3vw,1.15rem)]">
						An NFT usually points to one file at one address. MURI gives a token a list of addresses for
						the same file and records the file's hash on-chain. When the token is viewed, it loads the
						first copy that still exists and still matches. As long as one copy survives, so does the
						artwork.
					</p>
					<div className="flex flex-wrap gap-3">
						<ButtonLink to="/collections?role=creator">Mint an artwork →</ButtonLink>
						<ButtonLink to="/collections?role=collector" variant="secondary">
							Preserve a token
						</ButtonLink>
					</div>
				</div>

				<figure className="flex flex-col gap-3 min-w-0">
					<div className="relative aspect-video overflow-hidden bg-black">
						<img
							src={OFF_CHAIN_ART.images.onChainThumbnail}
							alt=""
							aria-hidden
							className="absolute inset-0 w-full h-full object-cover [image-rendering:pixelated]"
						/>
						<img
							src={verifiedUrl ?? OFF_CHAIN_ART.images.full}
							srcSet={verifiedUrl ? undefined : `${OFF_CHAIN_ART.images.medium} 1200w, ${OFF_CHAIN_ART.images.full} 2400w`}
							sizes="(min-width: 1024px) 60vw, 100vw"
							alt="Off-Chain Art by Yigit Duman: six historic paintings blended into one image"
							fetchPriority="high"
							className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
								resolved ? "opacity-100" : "opacity-0"
							}`}
						/>

						{logOpen && (
							<div className="absolute inset-0 bg-black/85 backdrop-blur-sm overflow-y-auto overscroll-contain px-4 pt-10 pb-12 font-mono text-[11px] leading-[1.65] text-white animate-fade-in">
								{replay.lines.map((l, i) => (
									<p key={i} className={`break-all ${l.tone ? lineTone[l.tone] : ""}`}>
										{l.text}
									</p>
								))}
							</div>
						)}

						<div
							className="absolute inset-x-0 bottom-0 flex items-center gap-4 bg-black/70 backdrop-blur-sm px-4 py-2.5 font-mono text-[11px] text-white"
							aria-live="polite"
						>
							<span className={`flex-1 min-w-0 truncate ${lastLine?.tone ? lineTone[lastLine.tone] : ""}`}>
								{lastLine?.text ?? "Starting the token's viewer…"}
							</span>
							<button
								type="button"
								onClick={() => setLogOpen((o) => !o)}
								aria-expanded={logOpen}
								className="shrink-0 uppercase tracking-[0.16em] text-[10px] text-white/70 hover:text-white transition-colors"
							>
								{logOpen ? "Close log" : "Log"}
							</button>
						</div>
					</div>

					<ol className="grid grid-cols-3 sm:grid-cols-6 gap-2" aria-label="Off-Chain Art's six copies">
						{OFF_CHAIN_ART.uris.map((u, i) => {
							const c = chip(i);
							return (
								<li
									key={u.uri}
									className={`flex flex-col border transition-colors duration-300 ${
										c.state === "used" ? "border-foreground" : "border-line"
									}`}
								>
									<div className="relative aspect-video overflow-hidden bg-black">
										<img
											src={OFF_CHAIN_ART.images.medium}
											alt=""
											aria-hidden
											loading="lazy"
											className={`absolute inset-0 w-full h-full object-cover scale-[2.2] transition-[filter,opacity] duration-500 ${
												c.state === "dead"
													? "grayscale opacity-20"
													: c.state === "waiting"
														? "grayscale opacity-40"
														: ""
											}`}
											style={{ objectPosition: CROPS[i], transformOrigin: CROPS[i] }}
										/>
										{c.state === "dead" && (
											<svg aria-hidden className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 56">
												<line x1="0" y1="56" x2="100" y2="0" stroke="#ff8a80" strokeWidth="0.8" />
											</svg>
										)}
										{c.state === "trying" && <span className="absolute inset-0 border border-caution animate-pulse" />}
									</div>
									<div className="flex flex-col gap-1 px-2 py-2">
										<span className="text-[12px] leading-tight truncate">{u.host}</span>
										<span className="micro inline-flex items-center gap-1.5 text-muted">
											<Dot tone={c.tone} />
											<span className="truncate">{c.label}</span>
										</span>
									</div>
								</li>
							);
						})}
					</ol>

					<figcaption className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
						<a href={OFF_CHAIN_ART.links.token} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
							{OFF_CHAIN_ART.title}, {OFF_CHAIN_ART.year} · {OFF_CHAIN_ART.collection} #{OFF_CHAIN_ART.tokenId} ↗
						</a>
						{verifiedUrl ? (
							<span className="text-up">Hash matches the contract</span>
						) : resolved ? (
							<button
								type="button"
								disabled={replay.verifying}
								onClick={() => {
									setLogOpen(true);
									void replay.verify();
								}}
								className="text-foreground hover:opacity-60 transition-opacity disabled:opacity-40"
							>
								{replay.verifying ? "Verifying…" : `Verify the ${formatBytes(OFF_CHAIN_ART.fileBytes)} file yourself →`}
							</button>
						) : null}
					</figcaption>
				</figure>
			</div>
		</section>
	);
}
