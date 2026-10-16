import Layout from "../components/Layout";
import ResolvingHero from "../components/art/ResolvingHero";
import TokenAnatomy from "../components/art/TokenAnatomy";
import PermissionBits from "../components/art/PermissionBits";
import StorageCost from "../components/art/StorageCost";
import { Section } from "../components/ui";
import { MURI_ADDRESS, MURI_EXTENSION_ADDRESS } from "../lib/muri";
import { OFF_CHAIN_ART } from "../lib/offChainArt";

const questions = [
	{
		q: "What problem does this solve?",
		a: "Most NFTs point to a single link. When that server goes down or that pin expires, the token shows a broken image. MURI keeps several links per token and moves to the next one when a link fails.",
	},
	{
		q: "Why not store the whole thing on-chain?",
		a: "If you can afford it, do that. Fully on-chain is the most durable option there is, with nothing to keep online. But on-chain storage is paid by the byte, so large images, video, audio or 3D can cost thousands of dollars to store. MURI is for those works: the metadata, the HTML page and an optional thumbnail stay on-chain, and only the file itself lives off-chain, in as many places as you want.",
	},
	{
		q: "What is Smart HTML mode?",
		a: "The token's animation_url is an HTML page generated on-chain. It loads each URI in order, checks the file against the stored SHA-256, and shows the first copy that matches. Direct mode skips the page and serves one chosen URI.",
	},
	{
		q: "Does MURI charge a fee?",
		a: "No. MURI takes nothing, on mints, updates or uploads. You pay network gas for your own transactions, and if you choose to upload through the site, the storage provider's price goes straight to ar.io (Arweave) or Pinata (IPFS). Relay's fee applies only if you swap or bridge into USDC.",
	},
	{
		q: "Do I have to upload through the site?",
		a: "No. Uploading here is a convenience. You can host the file anywhere, on your own server, S3, GitHub, the Internet Archive or a pinning service you already use, and paste the links. MURI only stores the links and the file's hash.",
	},
	{
		q: "How does paying for storage work?",
		a: "Uploads use x402, an HTTP payment standard. Your wallet signs one USDC authorization on Base for the quoted price, paid directly to the storage provider, and the upload goes through. No account, no API key, no approval transaction.",
	},
	{
		q: "Can collectors add links?",
		a: "If the artist allows it, the owner of a token can add their own backup URIs. Smart HTML tries them after the artist's, so a collector can keep a piece alive even if the artist stops maintaining it.",
	},
	{
		q: "What can I connect?",
		a: "Manifold Creator Core contracts (ERC-721 and ERC-1155) on Ethereum, Base and Sepolia. Other contracts can integrate directly by implementing IMURIProtocolCreator.",
	},
];

export default function Home() {
	return (
		<Layout hero={<ResolvingHero />}>
			<div className="flex flex-col gap-20 md:gap-28">
				<div className="flex flex-col gap-6 md:gap-8">
					<Section
						id="off-chain-art"
						title="Off-Chain Art"
						description={`${OFF_CHAIN_ART.date}. ${OFF_CHAIN_ART.collection} #${OFF_CHAIN_ART.tokenId}, ${OFF_CHAIN_ART.standard} on Ethereum.`}
					>
						<div className="flex flex-col gap-10">
							<div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
								<div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
									<p>
										MURI started as an artwork. Off-Chain Art is a framework for work that can't fit
										fully on-chain but should still last. Instead of a single tokenURI, the image is
										stored in six places: two IPFS pinning services, Arweave, GitHub, Amazon S3 and the
										Internet Archive.
									</p>
									<p>
										The token is an on-chain web page. It fetches each link, hashes what comes back and
										shows the first copy that matches the hash stored in the contract, so no other image
										can ever be displayed. The artist and the collector can both add new links.
									</p>
									<p>
										Some of its links have failed since the mint, and the piece still loads.
									</p>
									<div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 font-mono text-[11px] uppercase tracking-[0.16em]">
										<a href={OFF_CHAIN_ART.links.thread} target="_blank" rel="noopener noreferrer" className="link text-foreground">
											The thread ↗
										</a>
										<a href={OFF_CHAIN_ART.links.token} target="_blank" rel="noopener noreferrer" className="link text-foreground">
											The token ↗
										</a>
										<a href={OFF_CHAIN_ART.links.code} target="_blank" rel="noopener noreferrer" className="link text-foreground">
											The code ↗
										</a>
									</div>
								</div>
								<div className="flex flex-col gap-3">
									<p className="text-[13px] text-muted leading-relaxed">
										The image blends six historic paintings that were altered without their artists'
										consent or outside their intent:
									</p>
									<ul className="flex flex-col border-t border-line">
										{OFF_CHAIN_ART.paintings.map((p) => (
											<li key={p.title} className="flex justify-between gap-4 py-2 border-b border-line text-[13px]">
												<span>{p.title}</span>
												<span className="text-muted text-right">{p.artist}</span>
											</li>
										))}
									</ul>
								</div>
							</div>
						</div>
					</Section>

					<Section
						title="How a token resolves"
						description="What happens when a marketplace asks a MURI token for its artwork."
					>
						<TokenAnatomy />
					</Section>

					<Section
						title="Storage"
						description="Optional. Upload a copy from the mint page or paste links you already host. MURI takes no fee."
					>
						<StorageCost />
					</Section>

					<Section
						title="Permissions"
						description="Each token stores who may change what as one number. The artist's bits can be switched off later, not back on. The owner's are set at mint."
					>
						<PermissionBits />
					</Section>

					<Section title="Questions">
						<dl className="flex flex-col gap-7">
							{questions.map((item) => (
								<div key={item.q} className="flex flex-col gap-1.5">
									<dt className="font-semibold text-[14px]">{item.q}</dt>
									<dd className="text-[14px] text-muted leading-relaxed">{item.a}</dd>
								</div>
							))}
						</dl>
					</Section>

					<Section title="Contracts" description="Same addresses on Ethereum, Base and Sepolia.">
						<dl className="flex flex-col gap-4">
							{[
								{ label: "MURIProtocol", address: MURI_ADDRESS },
								{ label: "Manifold extension", address: MURI_EXTENSION_ADDRESS },
							].map((c) => (
								<div key={c.label} className="flex flex-col gap-1">
									<dt className="text-[13px] text-muted">{c.label}</dt>
									<dd>
										<a
											href={`https://etherscan.io/address/${c.address}`}
											target="_blank"
											rel="noopener noreferrer"
											className="font-mono text-[13px] break-all hover:opacity-60 transition-opacity"
										>
											{c.address}
										</a>
									</dd>
								</div>
							))}
						</dl>
					</Section>
				</div>
			</div>
		</Layout>
	);
}
