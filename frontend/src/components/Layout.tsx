import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import ConnectWallet from "./ConnectWallet";

const Sun = () => (
	<svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
		<circle cx="12" cy="12" r="4" />
		<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
	</svg>
);

const Moon = () => (
	<svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
		<path d="M20.99 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.78 9.79z" />
	</svg>
);

// The MURI mark: three bars, one per URI.
export function Mark({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 12 12" aria-hidden className={className} fill="currentColor">
			<rect x="1" y="1" width="2.6" height="10" />
			<rect x="4.7" y="1" width="2.6" height="10" opacity="0.7" />
			<rect x="8.4" y="1" width="2.6" height="10" />
		</svg>
	);
}

const navLink = (isActive: boolean) =>
	`font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hidden md:inline ${
		isActive ? "text-foreground" : "text-muted hover:text-foreground"
	}`;

function Header({ hideConnect }: { hideConnect?: boolean }) {
	const { isDarkMode, toggleTheme } = useTheme();
	const { pathname, search } = useLocation();
	const role = new URLSearchParams(search).get("role");
	const creatorArea = ["/mint", "/update"].includes(pathname) || (pathname === "/collections" && role === "creator");
	const collectorArea = pathname === "/collector-zone" || (pathname === "/collections" && role === "collector");

	return (
		<header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-line">
			<div className="mx-auto max-w-[1320px] px-5 md:px-10 h-14 flex items-center justify-between gap-6">
				<Link
					to="/"
					className="flex items-center gap-2.5 font-mono text-[12px] uppercase tracking-[0.16em] font-medium whitespace-nowrap"
				>
					<Mark className="w-3 h-3" />
					MURI
					<span className="text-muted font-normal hidden sm:inline">Protocol</span>
				</Link>

				<nav className="flex items-center gap-5 md:gap-7">
					<Link to="/collections?role=creator" className={navLink(creatorArea)}>
						Create
					</Link>
					<Link to="/collections?role=collector" className={navLink(collectorArea)}>
						Preserve
					</Link>
					<button
						type="button"
						onClick={toggleTheme}
						aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
						className="text-muted hover:text-foreground transition-colors"
					>
						{isDarkMode ? <Sun /> : <Moon />}
					</button>
					{!hideConnect && <ConnectWallet variant="header" />}
				</nav>
			</div>
		</header>
	);
}

function Footer() {
	const external = "hover:text-foreground transition-colors";
	// Links inside the credit lines stand out from the faint text around them.
	const credit = "text-muted hover:text-foreground transition-colors";
	return (
		<footer className="border-t border-line mt-24">
			<div className="mx-auto max-w-[1320px] px-5 md:px-10 py-10 flex flex-col md:flex-row md:items-end justify-between gap-8 font-mono text-[10px] uppercase tracking-[0.15em] text-faint">
				<div className="flex flex-col gap-1.5">
					<span>
						MURI Protocol by{" "}
						<a href="https://x.com/yigitduman" target="_blank" rel="noopener noreferrer" className={credit}>
							Yigit Duman
						</a>
					</span>
					<span>
						Built with the{" "}
						<a href="https://discord.gg/VmjjHSyWJ8" target="_blank" rel="noopener noreferrer" className={credit}>
							Pushers
						</a>{" "}
						community
					</span>
				</div>
				<div className="flex flex-wrap gap-x-6 gap-y-2">
					<a href="https://github.com/ygtdmn/muri-protocol" target="_blank" rel="noopener noreferrer" className={external}>
						GitHub ↗
					</a>
					<a href="https://x.com/YigitDuman/status/1957514000306246110" target="_blank" rel="noopener noreferrer" className={external}>
						Off-Chain Art ↗
					</a>
					<Link to="/terms" className={external}>
						Terms
					</Link>
				</div>
			</div>
		</footer>
	);
}

export default function Layout({
	children,
	hideConnect,
	hero,
}: {
	children: ReactNode;
	hideConnect?: boolean;
	/** Full-bleed content above the page container. */
	hero?: ReactNode;
}) {
	return (
		<div className="min-h-svh flex flex-col">
			<a
				href="#main"
				className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 bg-foreground text-background px-3 py-2 micro"
			>
				Skip to content
			</a>
			<Header hideConnect={hideConnect} />
			<main id="main" className="flex-1">
				{hero}
				<div className="mx-auto w-full max-w-[1320px] px-5 md:px-10 pt-12 md:pt-20">{children}</div>
			</main>
			<Footer />
		</div>
	);
}
