import type { ReactNode } from "react";
import Layout from "../components/Layout";
import { PageTitle } from "../components/ui";
import { MURI_ADDRESS, MURI_EXTENSION_ADDRESS } from "../lib/muri";
import { TERMS_UPDATED as UPDATED } from "../lib/terms";

function Clause({ n, title, children }: { n: number; title: string; children: ReactNode }) {
	return (
		<section id={`clause-${n}`} className="grid gap-3 md:grid-cols-[3rem_minmax(0,1fr)] scroll-mt-24">
			<span className="micro text-faint tabular-nums pt-[7px]">{String(n).padStart(2, "0")}</span>
			<div className="flex flex-col gap-3">
				<h2 className="font-medium text-[clamp(1.1rem,1rem+0.4vw,1.3rem)] tracking-[-0.01em]">{title}</h2>
				<div className="flex flex-col gap-3 text-[15px] leading-relaxed text-muted [&_strong]:text-foreground [&_strong]:font-medium">
					{children}
				</div>
			</div>
		</section>
	);
}

function ThirdParty({ name, role, url }: { name: string; role: ReactNode; url?: string }) {
	return (
		<li className="grid gap-1 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6 py-3 border-b border-line">
			<span className="text-foreground">
				{url ? (
					<a href={url} target="_blank" rel="noopener noreferrer" className="link">
						{name}
					</a>
				) : (
					name
				)}
			</span>
			<span className="text-[14px]">{role}</span>
		</li>
	);
}

export default function Terms() {
	return (
		<Layout>
			<div className="flex flex-col gap-14 mx-auto w-full max-w-[52rem]">
				<PageTitle title="Terms of Use">
					Last updated {UPDATED}. Please read these before using the site or the MURI Protocol contracts.
				</PageTitle>

				<div className="flex flex-col gap-12 border-t border-line pt-12">
					<Clause n={1} title="What these terms cover">
						<p>
							These terms apply to your use of this website (the "Site") and of the MURI Protocol smart
							contracts it connects to (together, the "Protocol"). The Site and the Protocol were created
							by Yigit Duman ("we", "us"). By using the Site or the Protocol you agree to these terms. If
							you don't agree, don't use them.
						</p>
					</Clause>

					<Clause n={2} title="MURI takes no fees">
						<p>
							<strong>We do not charge any fee, commission or margin</strong>, on mints, updates, uploads,
							swaps or anything else. We receive no part of any payment you make through the Site.
						</p>
						<p>
							Every payment you make goes to a third party: network gas to the blockchain's validators,
							storage payments to the storage provider you choose, and swap or bridge fees to Relay and
							the networks involved. Prices shown on the Site are quotes from those third parties; we do
							not set them and cannot refund them.
						</p>
						<p>
							Uploading through the Site is optional. You can host your files anywhere and add the links
							yourself.
						</p>
					</Clause>

					<Clause n={3} title="Open-source software, provided as is">
						<p>
							The Protocol and the Site are open-source software published under the MIT License. They are
							provided <strong>"as is" and "as available", without warranties of any kind</strong>,
							express or implied, including merchantability, fitness for a particular purpose,
							non-infringement, availability, accuracy or security.
						</p>
						<p>
							The smart contracts may contain bugs or vulnerabilities, and they have not been
							independently audited. Third-party services the Site relies on may change, fail or shut
							down. Nothing guarantees that any link, copy or file stays available, that link checks shown
							on the Site are accurate, or that a token will display its artwork.
						</p>
					</Clause>

					<Clause n={4} title="You control your wallet; we never hold your assets">
						<p>
							The Site is an interface. It never holds your private keys, seed phrase, tokens or funds, and
							it cannot move them. Every transaction and payment is created by you and signed in your own
							wallet. You are solely responsible for your wallet, its security, and every transaction and
							signature you approve.
						</p>
						<p>
							<strong>Blockchain transactions are irreversible.</strong> We cannot cancel, reverse or
							refund them. Review every transaction and signature in your wallet before you approve it.
						</p>
					</Clause>

					<Clause n={5} title="Permanence and permissions">
						<p>
							Data written to a blockchain is public and generally cannot be changed or deleted. Files
							uploaded to <strong>Arweave are designed to be permanent and cannot be removed</strong>, by
							you or by us. Files pinned to IPFS are public and can be copied and re-pinned by anyone.
						</p>
						<p>
							The Protocol has no function to grant a revoked permission back, or to revoke an owner's
							permissions once a token is minted. A token minted with no permissions ("Immutable") can't be
							changed through the Protocol's functions, including to add a new link if every existing link
							stops working.
						</p>
						<p>
							<strong>These limits don't bind a collection's admins.</strong> An admin of the creator
							contract can register a different operator for the collection and use it to write a token's
							data again: restoring permissions, replacing links, metadata or the file hash, and removing
							links added by owners. Revoking permissions limits what can be done through the Protocol's
							normal functions; it is not a guarantee against the people who control the collection.
						</p>
					</Clause>

					<Clause n={6} title="Your content">
						<p>
							You are solely responsible for any file, metadata, link or other content you mint, upload,
							store or reference through the Site or the Protocol. You confirm that you own it or have
							every right needed to use it this way, and that it does not infringe anyone's rights or
							break any law.
						</p>
						<p>
							We do not host, review, moderate or control your content, and we cannot remove content from
							a blockchain, Arweave or IPFS.
						</p>
					</Clause>

					<Clause n={7} title="Third-party services">
						<p>
							The Site uses and links to services run by independent third parties. We don't control them
							and are not responsible for their availability, security, fees, actions or content. Your use
							of each is governed by its own terms and privacy policy.
						</p>
						<ul className="flex flex-col border-t border-line">
							<ThirdParty
								name="Manifold"
								url="https://manifold.xyz"
								role="Creator Core contracts that MURI extends. Optional sign-in through Manifold's OAuth to list your collections, read from Manifold Studio's API."
							/>
							<ThirdParty
								name="ar.io and ArDrive Turbo"
								url="https://ar.io"
								role="Arweave uploads, priced and paid per upload."
							/>
							<ThirdParty name="Pinata" url="https://pinata.cloud" role="IPFS uploads and pinning, priced and paid per upload." />
							<ThirdParty
								name="x402 payment facilitators"
								url="https://x402.org"
								role="Settle the USDC payments that the storage providers request. Chosen by the storage provider, not by us."
							/>
							<ThirdParty
								name="Relay"
								url="https://relay.link"
								role="Optional swaps and bridges into USDC on Base. Requests pass through our server only to attach an API key."
							/>
							<ThirdParty
								name="Wallet providers"
								role="MetaMask (MetaMask SDK), Base (Base Account SDK), WalletConnect (Reown), and any browser extension wallet you choose, such as Rabby or Phantom."
							/>
							<ThirdParty
								name="Blockchain networks and RPC providers"
								role="Ethereum, Base and Sepolia, read and written through public RPC endpoints including PublicNode, dRPC, 1RPC, MEV Blocker, Flashbots, MeowRPC, Merkle, OmniaTech, 0xRPC, Payload, RadiumBlock, BlockRazor and Base's own RPC."
							/>
							<ThirdParty
								name="IPFS and Arweave gateways"
								role={
									<>
										ipfs:// and ar:// links are fetched through public gateways, tried in order until one
										answers: Filebase (ipfs.filebase.io), Pinata (gateway.pinata.cloud), 4everland
										(4everland.io), Protocol Labs (dweb.link and ipfs.io), and for Arweave, arweave.net and
										ar.io's turbo-gateway.com. The Site uses them for link checks and links, and MURI's default
										on-chain HTML page uses the same list when a token is viewed.
									</>
								}
							/>
							<ThirdParty
								name="Other storage hosts"
								role="Any other link is fetched from wherever it points, for example Amazon S3, GitHub, the Internet Archive or the artist's own server."
							/>
							<ThirdParty name="Vercel" url="https://vercel.com" role="Hosts the Site and its API proxy." />
							<ThirdParty name="Google Fonts" url="https://fonts.google.com" role="Serves the Site's typefaces." />
							<ThirdParty
								name="Explorers and marketplaces"
								role="Links to Etherscan, Basescan, OpenSea and Manifold Gallery."
							/>
						</ul>
					</Clause>

					<Clause n={8} title="What happens in your browser">
						<p>
							The Site has no accounts and runs no analytics or advertising trackers. It stores a few
							things in your browser: your light or dark theme, your wallet connection (stored by the
							wallet libraries), and, if you sign in with Manifold, short-lived Manifold session cookies
							that expire after an hour.
						</p>
						<p>
							Some features contact third parties directly from your browser, which shares your IP
							address and browser details with them. In particular, the homepage and the token pages check
							artwork links live by requesting them from the hosts they point to, or from the IPFS and
							Arweave gateways listed above, and the homepage can
							download the Off-Chain Art original if you ask it to verify the file. Your wallet address and
							transactions are public on the blockchain.
						</p>
					</Clause>

					<Clause n={9} title="No advice">
						<p>
							Nothing on the Site is financial, investment, legal or tax advice. Tokens, cryptocurrencies
							and digital art are volatile and can lose all value. You are responsible for your own
							decisions and for any taxes that apply to you.
						</p>
					</Clause>

					<Clause n={10} title="Your responsibilities">
						<p>
							You are responsible for complying with the laws that apply to you. You may not use the Site
							or the Protocol if you are subject to sanctions or located where their use is prohibited, or
							to break any law or infringe anyone's rights.
						</p>
					</Clause>

					<Clause n={11} title="Limitation of liability">
						<p>
							To the fullest extent permitted by law, <strong>we are not liable for any loss or damage</strong>{" "}
							arising from or related to the Site, the Protocol, any third-party service, or any content,
							including lost tokens, funds, data, files, profits or opportunities, failed or mistaken
							transactions, unavailable or altered artwork, smart contract bugs, and any direct, indirect,
							incidental, special, consequential or punitive damages, even if we were told they were
							possible.
						</p>
						<p>
							Where liability cannot be excluded, our total liability to you is limited to the amount you
							paid us in the twelve months before the claim, which is zero, because we take no fees.
						</p>
					</Clause>

					<Clause n={12} title="Indemnity">
						<p>
							You agree to indemnify and hold us harmless against any claim, loss or cost, including
							reasonable legal fees, arising from your use of the Site or the Protocol, your content, or
							your breach of these terms or of anyone's rights.
						</p>
					</Clause>

					<Clause n={13} title="Changes">
						<p>
							We may change these terms, the Site, or stop operating the Site at any time without notice.
							The date at the top shows when the terms last changed. Continuing to use the Site after a
							change means you accept the updated terms. The deployed smart contracts keep running on the
							blockchain whether or not the Site does.
						</p>
					</Clause>

					<Clause n={14} title="General">
						<p>
							If any part of these terms is found unenforceable, the rest stays in effect. Not enforcing a
							part of these terms is not a waiver of it. These terms are the entire agreement between you
							and us about the Site and the Protocol.
						</p>
					</Clause>

					<Clause n={15} title="Contracts and contact">
						<p>
							The Protocol contracts are MURIProtocol at{" "}
							<span className="font-mono text-[13px] break-all text-foreground">{MURI_ADDRESS}</span> and the
							Manifold extension at{" "}
							<span className="font-mono text-[13px] break-all text-foreground">{MURI_EXTENSION_ADDRESS}</span>,
							on Ethereum, Base and Sepolia. The source code is on{" "}
							<a href="https://github.com/ygtdmn/muri-protocol" target="_blank" rel="noopener noreferrer" className="link text-foreground">
								GitHub
							</a>
							. Questions about these terms:{" "}
							<a href="https://x.com/yigitduman" target="_blank" rel="noopener noreferrer" className="link text-foreground">
								@yigitduman on X
							</a>
							.
						</p>
					</Clause>
				</div>
			</div>
		</Layout>
	);
}
