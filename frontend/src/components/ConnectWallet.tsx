import { useEffect, useRef, useState } from "react";
import { useChains, useConnection, useDisconnect, useSwitchChain } from "wagmi";
import { useSearchParams } from "react-router-dom";
import { openConnectModal } from "../lib/walletModal";
import { shortAddress } from "../lib/muri";
import { buttonClass } from "./ui";

const headerLink = "font-mono text-[11px] uppercase tracking-[0.16em] tabular-nums transition-colors";

/** Address, network switcher and disconnect, for the connected wallet. */
function AccountMenu({ onClose }: { onClose: () => void }) {
	const { address, chain } = useConnection();
	const chains = useChains();
	const { mutate: switchChain, isPending, variables } = useSwitchChain();
	const { mutate: disconnect } = useDisconnect();
	const [params, setParams] = useSearchParams();
	const [copied, setCopied] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const onDown = (e: PointerEvent) => {
			if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose();
		};
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		document.addEventListener("pointerdown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [onClose]);

	if (!address) return null;
	const explorer = chain?.blockExplorers?.default.url;

	return (
		<div
			ref={ref}
			role="menu"
			className="absolute right-0 top-full mt-2 w-72 border border-line-strong bg-surface z-50 animate-fade-in normal-case tracking-normal"
		>
			<div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
				<span className="font-mono text-[12px] truncate">{shortAddress(address)}</span>
				<button
					type="button"
					onClick={async () => {
						try {
							await navigator.clipboard.writeText(address);
							setCopied(true);
							setTimeout(() => setCopied(false), 1200);
						} catch {
							// Clipboard blocked.
						}
					}}
					className="micro text-muted hover:text-foreground"
				>
					{copied ? "Copied" : "Copy"}
				</button>
			</div>
			<div className="py-2 border-b border-line">
				<p className="micro text-faint px-4 pb-1.5">Network</p>
				{chains.map((c) => {
					const current = chain?.id === c.id;
					const switching = isPending && variables?.chainId === c.id;
					return (
						<button
							key={c.id}
							type="button"
							role="menuitemradio"
							aria-checked={current}
							disabled={current || isPending}
							onClick={() =>
								switchChain(
									{ chainId: c.id },
									{
										// Choosing a network here also moves a network-pinned page (?chain=) with it.
										onSuccess: () => {
											if (!params.has("chain")) return;
											const next = new URLSearchParams(params);
											next.set("chain", String(c.id));
											setParams(next, { replace: true });
										},
									}
								)
							}
							className="w-full flex items-center justify-between px-4 py-2 text-[14px] text-left hover:bg-background disabled:hover:bg-transparent disabled:cursor-default"
						>
							<span className={current ? "" : "text-muted"}>{c.name}</span>
							{current ? (
								<span className="w-1.5 h-1.5 bg-up" aria-hidden />
							) : switching ? (
								<span className="micro text-faint">Switching</span>
							) : null}
						</button>
					);
				})}
				{!chain && <p className="px-4 pt-1 text-[12px] text-signal">Your wallet is on a network this app doesn't use.</p>}
			</div>
			<div className="flex items-center justify-between px-4 py-3">
				{explorer ? (
					<a
						href={`${explorer}/address/${address}`}
						target="_blank"
						rel="noopener noreferrer"
						className="micro text-muted hover:text-foreground"
					>
						Explorer ↗
					</a>
				) : (
					<span />
				)}
				<button
					type="button"
					onClick={() => {
						disconnect();
						onClose();
					}}
					className="micro text-muted hover:text-signal"
				>
					Disconnect
				</button>
			</div>
		</div>
	);
}

/**
 * The wallet control. `header` is the compact mono variant for the top bar; `primary` is the
 * full-size call to action. Connecting opens our own connect modal (components/wallet/ConnectModal).
 */
export default function ConnectWallet({
	variant = "primary",
	label = "Connect wallet",
}: {
	variant?: "header" | "primary";
	label?: string;
}) {
	const { address, status, chain } = useConnection();
	const [menu, setMenu] = useState(false);

	// A pairing abandoned in the modal (closed mid-QR) can leave wagmi "connecting" indefinitely,
	// so anything short of connected offers Connect; the modal shows progress itself.
	if (status !== "connected" || !address) {
		return variant === "header" ? (
			<button type="button" onClick={openConnectModal} className={`${headerLink} text-foreground hover:opacity-60`}>
				Connect
			</button>
		) : (
			<button type="button" onClick={openConnectModal} className={buttonClass()}>
				{label}
			</button>
		);
	}

	const wrongNetwork = !chain;
	const trigger =
		variant === "header" ? (
			<span className="flex items-center gap-4">
				<span className={`${headerLink} hidden sm:inline ${wrongNetwork ? "text-signal" : "text-muted"}`}>
					{wrongNetwork ? "Wrong network" : chain.name}
				</span>
				<span className={`${headerLink} text-foreground`}>{shortAddress(address)}</span>
			</span>
		) : (
			<span className={buttonClass({ variant: wrongNetwork ? "danger" : "secondary" })}>
				{wrongNetwork ? "Wrong network" : `${chain.name} · ${shortAddress(address)}`}
			</span>
		);

	return (
		<div className="relative">
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={menu}
				onClick={() => setMenu((m) => !m)}
				className="hover:opacity-70 transition-opacity"
			>
				{trigger}
			</button>
			{menu && <AccountMenu onClose={() => setMenu(false)} />}
		</div>
	);
}
