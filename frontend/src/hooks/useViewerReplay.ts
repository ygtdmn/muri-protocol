import { useEffect, useMemo, useState } from "react";
import { useLinkProbes } from "./useLinkHealth";
import type { LinkProbe } from "./useLinkHealth";
import { OFF_CHAIN_ART, shortUri } from "../lib/offChainArt";
import { formatBytes } from "../lib/muri";

export type ReplayLine = { text: string; tone?: "dim" | "ok" | "bad" };
type Event = (ReplayLine & { uri?: number; kind?: "try" | "status" }) | { pending: true };

const STEP_MS = 520;

function statusLine(probe: LinkProbe): ReplayLine {
	if (probe.health === "live") return { text: `Status: ${probe.status ?? 200}`, tone: "ok" };
	if (probe.health === "dead") return { text: `Status: ${probe.status}`, tone: "bad" };
	if (probe.health === "unverified") return { text: "Status: blocked by CORS", tone: "bad" };
	return { text: "Status: no response", tone: "bad" };
}

/** Short label for a probe, for places with no room for a full log line. */
export function probeLabel(probe: LinkProbe) {
	if (probe.health === "checking") return "Checking";
	if (probe.health === "live") return String(probe.status ?? 200);
	if (probe.health === "dead") return String(probe.status);
	if (probe.health === "unverified") return "Blocked";
	return "Down";
}

/**
 * Replays the Off-Chain Art viewer (the token's own on-chain HTML) against its six real links,
 * one line at a time. Link statuses are fetched live from the visitor's browser. `verify()`
 * downloads the original from the first live copy and hashes it, exactly like the token does.
 */
export function useViewerReplay() {
	const uris = useMemo(() => OFF_CHAIN_ART.uris.map((u) => u.uri), []);
	const probes = useLinkProbes(uris);
	const reduceMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
	const [shown, setShown] = useState(0);
	const [verifyLines, setVerifyLines] = useState<ReplayLine[]>([]);
	const [verifying, setVerifying] = useState(false);
	const [verifiedUrl, setVerifiedUrl] = useState<string | null>(null);

	const { events, found } = useMemo(() => {
		const list: Event[] = [
			{ text: `Showing the on-chain thumbnail (${formatBytes(OFF_CHAIN_ART.thumbnail.bytes)})`, tone: "dim" },
			{ text: `Expected: ${OFF_CHAIN_ART.fileHash}` },
			{ text: `URIs: ${uris.length}` },
			{ text: "Checking available images..." },
		];
		let foundIndex = -1;
		for (let i = 0; i < uris.length; i++) {
			list.push({ text: `Trying: ${shortUri(uris[i])}`, tone: "dim", uri: i, kind: "try" });
			if (probes[i].health === "checking") {
				list.push({ pending: true });
				break;
			}
			list.push({ ...statusLine(probes[i]), uri: i, kind: "status" });
			if (probes[i].health === "live") {
				foundIndex = i;
				list.push({ text: `Showing copy ${i + 1} of ${uris.length} (${OFF_CHAIN_ART.uris[i].host})`, tone: "ok" });
				break;
			}
		}
		return { events: list, found: foundIndex };
	}, [probes, uris]);

	const visible = reduceMotion ? events.length : Math.min(shown, events.length);
	const nextPending = "pending" in (events[visible] ?? {});
	const done = visible >= events.length && !nextPending;

	useEffect(() => {
		if (reduceMotion || visible >= events.length || nextPending) return;
		const t = window.setTimeout(() => setShown(visible + 1), visible === 0 ? 500 : STEP_MS);
		return () => window.clearTimeout(t);
	}, [visible, events.length, nextPending, reduceMotion]);

	// Free the verified file's blob URL when it is replaced or the page unmounts.
	useEffect(() => {
		if (!verifiedUrl) return;
		return () => URL.revokeObjectURL(verifiedUrl);
	}, [verifiedUrl]);

	const shownEvents = events.slice(0, visible).filter((e): e is Exclude<Event, { pending: true }> => !("pending" in e));
	// Which copy the replay is on, and which copies it has already reported on.
	const lastTry = [...shownEvents].reverse().find((e) => e.kind === "try");
	const reported = new Set(shownEvents.filter((e) => e.kind === "status").map((e) => e.uri));
	const trying = lastTry && !reported.has(lastTry.uri) ? lastTry.uri : undefined;

	const verify = async () => {
		if (found < 0 || verifying) return;
		setVerifying(true);
		const push = (line: ReplayLine, replaceLast = false) =>
			setVerifyLines((v) => (replaceLast ? [...v.slice(0, -1), line] : [...v, line]));
		try {
			const res = await fetch(uris[found]);
			if (!res.ok || !res.body) throw new Error(`Status: ${res.status}`);
			const total = Number(res.headers.get("content-length")) || OFF_CHAIN_ART.fileBytes;
			const reader = res.body.getReader();
			const chunks: Uint8Array[] = [];
			let received = 0;
			let lastPct = -1;
			push({ text: "Downloading: 0%" });
			for (;;) {
				const { done: finished, value } = await reader.read();
				if (finished) break;
				chunks.push(value);
				received += value.length;
				const pct = Math.min(99, Math.floor((received / total) * 100));
				if (pct !== lastPct) {
					lastPct = pct;
					push({ text: `Downloading: ${pct}%` }, true);
				}
			}
			push({ text: `Size: ${received}` }, true);
			const bytes = new Uint8Array(received);
			let offset = 0;
			for (const c of chunks) {
				bytes.set(c, offset);
				offset += c.length;
			}
			push({ text: `Hashing ${(received / 1024 / 1024).toFixed(1)}MB file...` });
			const digest = await crypto.subtle.digest("SHA-256", bytes);
			const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
			push({ text: `Hash: ${hex.slice(0, 16)}...` });
			if (`0x${hex}` === OFF_CHAIN_ART.fileHash) {
				push({ text: "HASH MATCH! Loading...", tone: "ok" });
				setVerifiedUrl(URL.createObjectURL(new Blob([bytes], { type: "image/png" })));
				push({ text: "Showing the original, verified in your browser", tone: "ok" });
			} else {
				push({ text: "HASH MISMATCH. This copy would be skipped.", tone: "bad" });
			}
		} catch (error) {
			push({ text: error instanceof Error ? error.message : "Download failed", tone: "bad" });
		} finally {
			setVerifying(false);
		}
	};

	return {
		probes,
		lines: [...shownEvents, ...verifyLines] as ReplayLine[],
		done,
		found: done ? found : -1,
		trying,
		reported,
		verify,
		verifying,
		verifiedUrl,
	};
}
