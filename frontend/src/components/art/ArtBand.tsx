import { Link } from "react-router-dom";
import { OFF_CHAIN_ART } from "../../lib/offChainArt";

/**
 * A full-bleed strip of Off-Chain Art. Each page shows a different crop of the same piece.
 * `onChain` uses the 512×288 thumbnail stored in the contract instead of the original.
 */
export default function ArtBand({
	position = "50% 50%",
	onChain = false,
	tall = false,
}: {
	position?: string;
	onChain?: boolean;
	tall?: boolean;
}) {
	return (
		<div className={`relative w-full overflow-hidden bg-black ${tall ? "h-[38svh] min-h-[220px]" : "h-24 md:h-36"}`}>
			<img
				src={onChain ? OFF_CHAIN_ART.images.onChainThumbnail : OFF_CHAIN_ART.images.medium}
				srcSet={onChain ? undefined : `${OFF_CHAIN_ART.images.medium} 1200w, ${OFF_CHAIN_ART.images.full} 2400w`}
				sizes="100vw"
				alt=""
				aria-hidden
				className={`absolute inset-0 w-full h-full object-cover ${onChain ? "[image-rendering:pixelated]" : ""}`}
				style={{ objectPosition: position }}
			/>
			<Link
				to="/#off-chain-art"
				className="absolute bottom-2.5 right-5 md:right-10 font-mono text-[10px] uppercase tracking-[0.16em] text-white mix-blend-difference hover:opacity-60 transition-opacity"
			>
				{OFF_CHAIN_ART.title}
				{onChain ? " · on-chain thumbnail" : ""}
			</Link>
		</div>
	);
}
