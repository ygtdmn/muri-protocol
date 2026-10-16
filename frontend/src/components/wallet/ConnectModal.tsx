import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useConnect, useConnectors } from "wagmi";
import type { Connector } from "wagmi";
import { renderSVG } from "uqr";
import { closeConnectModal, useConnectModalOpen } from "../../lib/walletModal";

/**
 * The wallets we offer, in order. `ids` are the connector ids that can serve each: the SDK
 * connectors from lib/wagmi.ts, or the EIP-6963 rdns an installed extension announces itself with.
 */
const WALLETS: {
	key: string;
	name: string;
	mark: string;
	ids: string[];
	hint?: string;
	install?: string;
	mobile?: () => string;
}[] = [
	{ key: "metamask", name: "MetaMask", mark: "MM", ids: ["metaMaskSDK"], hint: "Extension or app" },
	{ key: "rabby", name: "Rabby", mark: "R", ids: ["io.rabby"], install: "https://rabby.io" },
	{
		key: "phantom",
		name: "Phantom",
		mark: "P",
		ids: ["app.phantom"],
		install: "https://phantom.com/download",
		// Phantom's in-app browser opens the site with the wallet injected.
		mobile: () =>
			`https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}?ref=${encodeURIComponent(window.location.origin)}`,
	},
	{ key: "base", name: "Base", mark: "B", ids: ["baseAccount"], hint: "Passkey or app" },
	{ key: "walletconnect", name: "WalletConnect", mark: "WC", ids: ["walletConnect"], hint: "Scan with any wallet" },
	{ key: "injected", name: "Browser wallet", mark: "◇", ids: ["injected"] },
];
const KNOWN = new Set(WALLETS.flatMap((w) => w.ids));

type Row = {
	key: string;
	name: string;
	mark: string;
	icon?: string;
	connector?: Connector;
	status: string;
	live?: boolean;
	href?: string;
};

type EIP6963Info = { rdns: string; name: string; icon: string };

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function reason(error: unknown) {
	const e = error as { code?: number; shortMessage?: string; message?: string };
	const text = `${e?.shortMessage ?? e?.message ?? ""}`;
	if (e?.code === 4001 || /reject|denied|cancel/i.test(text)) return "Declined in the wallet.";
	if (/already pending|already processing/i.test(text)) return "Your wallet already has a request open. Check it.";
	return text.split("\n")[0].slice(0, 140) || "The wallet did not connect.";
}

function Mark({ icon, mark }: { icon?: string; mark: string }) {
	return (
		<span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border border-line-strong bg-background font-mono text-[10px] font-medium tracking-[0.06em] text-muted">
			{icon ? (
				<img src={icon} alt="" className="h-6 w-6 grayscale transition-[filter] duration-200 group-hover:grayscale-0" />
			) : (
				mark
			)}
		</span>
	);
}

function WalletRow({ row, busy, onClick }: { row: Row; busy: boolean; onClick?: () => void }) {
	const body = (
		<>
			<Mark icon={row.icon} mark={row.mark} />
			<span className="min-w-0 flex-1 text-[15px]">{row.name}</span>
			<span className={`micro flex items-center gap-1.5 ${row.live ? "text-foreground" : "text-faint"}`}>
				{busy ? (
					<>
						<span className="h-1.5 w-1.5 bg-foreground animate-pulse" aria-hidden />
						Opening
					</>
				) : (
					<>
						{row.live && <span className="h-1.5 w-1.5 bg-up" aria-hidden />}
						{row.status}
					</>
				)}
			</span>
		</>
	);
	const className =
		"group flex w-full items-center gap-3.5 border-b border-line px-5 py-3 text-left transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40";
	return row.href ? (
		<a href={row.href} target="_blank" rel="noreferrer" className={className}>
			{body}
		</a>
	) : (
		<button type="button" onClick={onClick} disabled={!onClick} className={className}>
			{body}
		</button>
	);
}

function Qr({ uri, wallet, onBack }: { uri: string; wallet: string; onBack: () => void }) {
	const svg = useMemo(
		() => renderSVG(uri, { border: 2, whiteColor: "#f7f6f3", blackColor: "#111111", pixelSize: 6 }),
		[uri]
	);
	const [copied, setCopied] = useState(false);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(uri);
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		} catch {
			// Clipboard blocked.
		}
	};
	const button =
		"h-10 border border-line-strong font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:border-foreground hover:text-foreground";
	return (
		<div className="px-5 py-5">
			<p className="text-[13px] leading-relaxed text-muted">
				{`Scan with ${wallet === "MetaMask" ? "the MetaMask app" : "your phone's wallet"}. Approve the connection there and this closes by itself.`}
			</p>
			{/* uqr returns a static SVG string built from the pairing link, nothing user-supplied. */}
			<div
				className="mx-auto mt-4 w-full max-w-[260px] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
				dangerouslySetInnerHTML={{ __html: svg }}
			/>
			<div className="mt-4 grid grid-cols-2 gap-2">
				{isMobile() ? (
					<a
						href={uri}
						className="flex h-10 items-center justify-center bg-foreground font-mono text-[10px] uppercase tracking-[0.16em] text-background"
					>
						Open the app
					</a>
				) : (
					<button type="button" onClick={copy} className={button}>
						{copied ? "Copied" : "Copy link"}
					</button>
				)}
				<button type="button" onClick={onBack} className={button}>
					← Other wallets
				</button>
			</div>
		</div>
	);
}

/**
 * Our own connect modal, in place of RainbowKit's, as on the Normies site. Lists MetaMask, Rabby,
 * Phantom, Base, WalletConnect and the browser's injected wallet, plus any other extension that
 * announces itself (EIP-6963). MetaMask without its extension and WalletConnect hand back a pairing
 * link, drawn here as a QR code. Mounted once in App; open it with `openConnectModal()`.
 */
export default function ConnectModal() {
	const open = useConnectModalOpen();
	const connectors = useConnectors();
	const { mutateAsync: connectAsync } = useConnect();
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [qr, setQr] = useState<{ uri: string; name: string } | null>(null);
	// Extensions that announce themselves (EIP-6963), by rdns. wagmi folds MetaMask's announcement
	// into its SDK connector, so this is how we know the MetaMask extension is there.
	const [announced, setAnnounced] = useState<Map<string, EIP6963Info>>(() => new Map());
	const attempt = useRef(0);

	useEffect(() => {
		if (!open) return undefined;
		const found = new Map<string, EIP6963Info>();
		const onAnnounce = (e: Event) => {
			const info = (e as CustomEvent<{ info?: EIP6963Info }>).detail?.info;
			if (!info?.rdns || found.has(info.rdns)) return;
			found.set(info.rdns, info);
			setAnnounced(new Map(found));
		};
		window.addEventListener("eip6963:announceProvider", onAnnounce);
		window.dispatchEvent(new Event("eip6963:requestProvider"));
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeConnectModal();
		window.addEventListener("keydown", onKey);
		const { overflow } = document.body.style;
		document.body.style.overflow = "hidden";
		const current = attempt;
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("eip6963:announceProvider", onAnnounce);
			document.body.style.overflow = overflow;
			setBusy(null);
			setError(null);
			setQr(null);
			current.current += 1;
		};
	}, [open]);

	if (!open) return null;

	const hasInjected = Boolean((window as { ethereum?: unknown }).ethereum);
	const byId = new Map(connectors.map((c) => [c.id, c]));
	const others = connectors.filter((c) => c.type === "injected" && !KNOWN.has(c.id) && c.id !== "injected");

	const pick = async (key: string, name: string, connector: Connector) => {
		const run = ++attempt.current;
		setError(null);
		setBusy(key);
		const onMessage = ({ type, data }: { type: string; data?: unknown }) => {
			if (type === "display_uri" && run === attempt.current) setQr({ uri: String(data), name });
		};
		connector.emitter.on("message", onMessage);
		try {
			await connectAsync({ connector });
			if (run === attempt.current) closeConnectModal();
		} catch (e) {
			if (run === attempt.current) {
				setQr(null);
				setError(reason(e));
			}
		} finally {
			connector.emitter.off("message", onMessage);
			if (run === attempt.current) setBusy(null);
		}
	};

	const known = WALLETS.map((w): Row | null => {
		const connector = w.ids.map((id) => byId.get(id)).find(Boolean);
		if (w.key === "injected") {
			// The plain browser wallet is whichever extension owns window.ethereum. Announced
			// extensions are already listed by name, so this row is only for one that doesn't announce.
			if (!hasInjected || announced.size > 0 || others.length > 0) return null;
			return { ...w, connector, status: "Detected", live: true };
		}
		if (w.key === "metamask" && connector) {
			const ext = announced.get("io.metamask");
			return { ...w, connector, icon: ext?.icon, status: ext ? "Detected" : (w.hint ?? ""), live: Boolean(ext) };
		}
		if (connector) {
			const detected = connector.type === "injected";
			return {
				...w,
				connector,
				icon: detected ? connector.icon : undefined,
				status: detected ? "Detected" : (w.hint ?? ""),
				live: detected,
			};
		}
		if (w.key === "walletconnect") return null; // no project id configured
		if (isMobile() && w.mobile) return { ...w, href: w.mobile(), status: `Open in ${w.name} ↗` };
		return { ...w, href: w.install, status: "Install ↗" };
	}).filter((r): r is Row => r !== null);
	const extra: Row[] = others.map((c) => ({
		key: c.id,
		name: c.name,
		mark: c.name.slice(0, 2).toUpperCase(),
		icon: c.icon,
		connector: c,
		status: "Detected",
		live: true,
	}));
	// What is installed comes first, then what can connect without an install, then installs.
	const rank = (r: Row) => (r.live ? 0 : r.connector ? 1 : 2);
	const rows = [...known, ...extra].sort((a, b) => rank(a) - rank(b));

	return createPortal(
		<div
			className="fixed inset-0 z-[100] flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center sm:p-5 animate-fade-in"
			onClick={() => closeConnectModal()}
			role="presentation"
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="connect-title"
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-[400px] border border-line-strong bg-surface"
			>
				<header className="flex items-center justify-between border-b border-line px-5 py-4">
					<div>
						<h2 id="connect-title" className="font-medium text-[17px]">
							{qr ? qr.name : "Connect a wallet"}
						</h2>
						<p className="micro mt-1 text-faint">{qr ? "Scan to connect" : "Ethereum, Base, Sepolia"}</p>
					</div>
					<button
						type="button"
						onClick={() => closeConnectModal()}
						aria-label="Close"
						className="flex h-9 w-9 items-center justify-center border border-line-strong text-muted transition-colors hover:border-foreground hover:text-foreground"
					>
						×
					</button>
				</header>

				{qr ? (
					<Qr
						uri={qr.uri}
						wallet={qr.name}
						onBack={() => {
							attempt.current += 1;
							setQr(null);
							setBusy(null);
						}}
					/>
				) : (
					<>
						<div>
							{rows.map((r) => (
								<WalletRow
									key={r.key}
									row={r}
									busy={busy === r.key}
									onClick={r.connector && !busy ? () => void pick(r.key, r.name, r.connector!) : undefined}
								/>
							))}
						</div>
						{error && (
							<p role="alert" className="border-b border-line bg-background px-5 py-3 text-[13px] text-signal">
								{error}
							</p>
						)}
						<p className="px-5 py-3.5 text-[12px] leading-relaxed text-faint">
							Connecting only shares your address. Nothing is signed or sent until you confirm it in your wallet.
						</p>
					</>
				)}
			</div>
		</div>,
		document.body
	);
}
