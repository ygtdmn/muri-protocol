import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { acceptTerms, declineTerms, useTermsPromptOpen } from "../lib/terms";
import { Button, Choice } from "./ui";

const POINTS = [
	"MURI takes no fees. Gas, storage and swap payments go to the networks and services involved.",
	"You sign every transaction in your own wallet. Blockchain transactions can't be reversed.",
	"On-chain data and Arweave uploads are public and permanent. Revoked permissions can't be restored through MURI, though a collection's admins keep control of their collection.",
	"The software is provided as is, and relies on third parties we don't control.",
];

/**
 * Shown before someone's first transaction or payment (see requireTerms in lib/terms.ts).
 * Mounted once in App.
 */
export default function TermsModal() {
	const open = useTermsPromptOpen();
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		if (!open) return;
		setChecked(false);
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && declineTerms();
		window.addEventListener("keydown", onKey);
		const { overflow } = document.body.style;
		document.body.style.overflow = "hidden";
		return () => {
			window.removeEventListener("keydown", onKey);
			document.body.style.overflow = overflow;
		};
	}, [open]);

	if (!open) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-[100] flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center sm:p-5 animate-fade-in"
			onClick={() => declineTerms()}
			role="presentation"
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="terms-title"
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-[460px] border border-line-strong bg-surface"
			>
				<header className="border-b border-line px-5 py-4">
					<h2 id="terms-title" className="font-medium text-[17px]">
						Before you continue
					</h2>
					<p className="micro mt-1 text-faint">Terms of Use</p>
				</header>
				<ul className="flex flex-col gap-2.5 px-5 py-4 text-[13px] leading-relaxed text-muted">
					{POINTS.map((p) => (
						<li key={p} className="flex gap-3">
							<span aria-hidden className="mt-[7px] w-1 h-1 shrink-0 bg-faint" />
							{p}
						</li>
					))}
				</ul>
				<div className="flex flex-col gap-4 border-t border-line px-5 py-4">
					<Choice
						compact
						type="checkbox"
						checked={checked}
						onChange={setChecked}
						title={
							<span className="text-[13px]">
								I have read and agree to the{" "}
								<Link
									to="/terms"
									target="_blank"
									rel="noopener noreferrer"
									onClick={(e) => e.stopPropagation()}
									className="link text-foreground"
								>
									Terms of Use ↗
								</Link>
							</span>
						}
					/>
					<div className="flex gap-2">
						<Button fullWidth disabled={!checked} onClick={acceptTerms}>
							Agree and continue
						</Button>
						<Button variant="secondary" onClick={declineTerms}>
							Cancel
						</Button>
					</div>
				</div>
			</div>
		</div>,
		document.body
	);
}
