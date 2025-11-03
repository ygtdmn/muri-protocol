import { Link } from "react-router-dom";
import { Shield, Upload, Link2, Users, Zap, Heart, HelpCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import Header from "../components/Header";
import { useTheme } from "../hooks/useTheme";
import Footer from "../components/Footer";
import PageBackground from "../components/PageBackground";

export default function Home() {
	const [openFaq, setOpenFaq] = useState<Record<string, boolean>>({
		what: false,
		why: false,
		how: false,
		who: false,
	});

	const { isDarkMode, toggleTheme } = useTheme();

	const toggleFaq = (section: string) => {
		setOpenFaq((prev) => ({
			...prev,
			[section]: !prev[section],
		}));
	};
	return (
		<PageBackground
			isDarkMode={isDarkMode}
			className={`scroll-smooth min-h-screen flex flex-col relative ${
				isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"
			}`}
		>
			<Header
				isDarkMode={isDarkMode}
				toggleTheme={toggleTheme}
				hideConnectButton={true}
			/>

			{/* Hero Section */}
			<div className="flex-grow">
				<div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
					{/* Hero */}
					<div className="pt-16 pb-12 md:pt-24 md:pb-16 text-center relative">

						<div className="max-w-4xl mx-auto relative z-10">
							<h1
								className={`
									text-4xl md:text-5xl lg:text-6xl 
									font-bold tracking-tight 
									mb-6 leading-tight
									${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
								`}
							>
								Make Your Digital Art{" "}
								<span className={isDarkMode ? "text-primary-dark" : "text-primary"}>
									More Resilient
								</span>
							</h1>

							<p
								className={`
									text-lg md:text-xl 
									mb-10 leading-relaxed max-w-2xl mx-auto
									${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
								`}
							>
								Store your NFTs across multiple platforms. If one fails, your art
								automatically falls back to another. <strong>Simple, secure, resilient.</strong>
							</p>

							<div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
								<Link
									to="/collections"
									className={`group px-10 py-5 rounded-2xl text-lg font-bold text-white shadow-strong transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-primary/30 ${
										isDarkMode ? "bg-primary-dark hover:bg-primary-dark-hover" : "bg-primary hover:bg-primary-hover"
									}`}
								>
									<span className="flex items-center gap-2">
										Get Started
										<Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
									</span>
								</Link>
								
								<a
									href="#how-it-works"
									className={`
										px-8 py-4 rounded-xl text-base font-semibold
										border-2
										transition-all duration-200
										${
											isDarkMode
												? "border-border-dark text-text-primary-dark hover:bg-surface-hover-dark"
												: "border-border-light text-text-primary-light hover:bg-surface-hover-light"
										}
									`}
								>
									Learn How It Works →
								</a>
							</div>
						</div>
					</div>

					{/* How It Works */}
					<section id="how-it-works" className="py-16 scroll-mt-24">
						<div className="text-center mb-12">
							<h2
								className={`
									text-3xl md:text-4xl font-bold mb-4
									${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
								`}
							>
								How It Works
							</h2>
							<p
								className={`
									text-lg max-w-2xl mx-auto
									${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
								`}
							>
								Three simple steps to protect your digital art
							</p>
						</div>

						<div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
							{/* Step 1 */}
							<div
								className={`
									text-center p-8 rounded-xl
									${
										isDarkMode
											? "bg-surface-dark border border-border-dark"
											: "bg-surface-light border border-border-light shadow-soft"
									}
								`}
							>
								<div
									className={`
										w-16 h-16 mx-auto mb-6 rounded-xl
										flex items-center justify-center
										${
											isDarkMode
												? "bg-primary-dark-subtle"
												: "bg-primary-subtle"
										}
									`}
								>
									<Upload
										className={`w-8 h-8 ${isDarkMode ? "text-primary-dark" : "text-primary"}`}
									/>
								</div>
								<div className="mb-3 inline-block px-3 py-1 rounded-full bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark text-sm font-semibold">
									Step 1
								</div>
								<h3
									className={`
										text-xl font-semibold mb-3
										${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
									`}
								>
									Upload Your Art
								</h3>
								<p
									className={`
										text-sm leading-relaxed
										${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
									`}
								>
									Upload your artwork and MURI will calculate a secure hash to verify
									authenticity
								</p>
							</div>

							{/* Step 2 */}
							<div
								className={`
									text-center p-8 rounded-xl
									${
										isDarkMode
											? "bg-surface-dark border border-border-dark"
											: "bg-surface-light border border-border-light shadow-soft"
									}
								`}
							>
								<div
									className={`
										w-16 h-16 mx-auto mb-6 rounded-xl
										flex items-center justify-center
										${
											isDarkMode
												? "bg-secondary-dark-subtle"
												: "bg-secondary-subtle"
										}
									`}
								>
									<Link2
										className={`w-8 h-8 ${isDarkMode ? "text-secondary-dark" : "text-secondary"}`}
									/>
								</div>
								<div className="mb-3 inline-block px-3 py-1 rounded-full bg-secondary/10 dark:bg-secondary-dark/10 text-secondary dark:text-secondary-dark text-sm font-semibold">
									Step 2
								</div>
								<h3
									className={`
										text-xl font-semibold mb-3
										${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
									`}
								>
									Add Backup Links
								</h3>
								<p
									className={`
										text-sm leading-relaxed
										${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
									`}
								>
									Upload to IPFS, Arweave, or any storage provider. More backups mean more
									resilience
								</p>
							</div>

							{/* Step 3 */}
							<div
								className={`
									text-center p-8 rounded-xl
									${
										isDarkMode
											? "bg-surface-dark border border-border-dark"
											: "bg-surface-light border border-border-light shadow-soft"
									}
								`}
							>
								<div
									className={`
										w-16 h-16 mx-auto mb-6 rounded-xl
										flex items-center justify-center
										${
											isDarkMode
												? "bg-success-dark-subtle"
												: "bg-success-subtle"
										}
									`}
								>
									<Shield
										className={`w-8 h-8 ${isDarkMode ? "text-success-dark" : "text-success"}`}
									/>
								</div>
								<div className="mb-3 inline-block px-3 py-1 rounded-full bg-success/10 dark:bg-success-dark/10 text-success dark:text-success-dark text-sm font-semibold">
									Step 3
								</div>
								<h3
									className={`
										text-xl font-semibold mb-3
										${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
									`}
								>
									Mint with Confidence
								</h3>
								<p
									className={`
										text-sm leading-relaxed
										${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
									`}
								>
									Your NFT automatically uses the first working link. No manual
									intervention needed
								</p>
							</div>
						</div>
					</section>

					{/* Features Grid */}
					<section className="py-16">
						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
							<div
								className={`
									p-6 rounded-xl
									${
										isDarkMode
											? "bg-surface-dark border border-border-dark"
											: "bg-surface-light border border-border-light shadow-soft"
									}
								`}
							>
								<div className="flex items-start gap-4">
									<div
										className={`
											p-2 rounded-lg
											${isDarkMode ? "bg-primary-dark-subtle" : "bg-primary-subtle"}
										`}
									>
										<Shield className={`w-5 h-5 ${isDarkMode ? "text-primary-dark" : "text-primary"}`} />
									</div>
									<div>
										<h3
											className={`
												font-semibold mb-2
												${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
											`}
										>
											On-Chain Metadata
										</h3>
										<p
											className={`
												text-sm leading-relaxed
												${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
											`}
										>
											Your NFT details stored directly on the blockchain, not on a
											server that could go down
										</p>
									</div>
								</div>
							</div>

							<div
								className={`
									p-6 rounded-xl
									${
										isDarkMode
											? "bg-surface-dark border border-border-dark"
											: "bg-surface-light border border-border-light shadow-soft"
									}
								`}
							>
								<div className="flex items-start gap-4">
									<div
										className={`
											p-2 rounded-lg
											${isDarkMode ? "bg-secondary-dark-subtle" : "bg-secondary-subtle"}
										`}
									>
										<Link2 className={`w-5 h-5 ${isDarkMode ? "text-secondary-dark" : "text-secondary"}`} />
									</div>
									<div>
										<h3
											className={`
												font-semibold mb-2
												${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
											`}
										>
											Multiple Backups
										</h3>
										<p
											className={`
												text-sm leading-relaxed
												${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
											`}
										>
											Store the same artwork in multiple places - IPFS, Arweave,
											servers, anywhere
										</p>
									</div>
								</div>
							</div>

							<div
								className={`
									p-6 rounded-xl
									${
										isDarkMode
											? "bg-surface-dark border border-border-dark"
											: "bg-surface-light border border-border-light shadow-soft"
									}
								`}
							>
								<div className="flex items-start gap-4">
									<div
										className={`
											p-2 rounded-lg
											${isDarkMode ? "bg-success-dark-subtle" : "bg-success-subtle"}
										`}
									>
										<Users className={`w-5 h-5 ${isDarkMode ? "text-success-dark" : "text-success"}`} />
									</div>
									<div>
										<h3
											className={`
												font-semibold mb-2
												${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
											`}
										>
											Collector Power
										</h3>
										<p
											className={`
												text-sm leading-relaxed
												${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
											`}
										>
											Let collectors add backup links too. More eyes helping
											preserve your art
										</p>
									</div>
								</div>
							</div>

							<div
								className={`
									p-6 rounded-xl
									${
										isDarkMode
											? "bg-surface-dark border border-border-dark"
											: "bg-surface-light border border-border-light shadow-soft"
									}
								`}
							>
								<div className="flex items-start gap-4">
									<div
										className={`
											p-2 rounded-lg
											${isDarkMode ? "bg-info-dark-subtle" : "bg-info-subtle"}
										`}
									>
										<Zap className={`w-5 h-5 ${isDarkMode ? "text-info-dark" : "text-info"}`} />
									</div>
									<div>
										<h3
											className={`
												font-semibold mb-2
												${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
											`}
										>
											Auto-Failover
										</h3>
										<p
											className={`
												text-sm leading-relaxed
												${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
											`}
										>
											Thanks to Smart HTML mode, your NFT tries each link until one works. No
											manual switching needed
										</p>
									</div>
								</div>
							</div>

							<div
								className={`
									p-6 rounded-xl
									${
										isDarkMode
											? "bg-surface-dark border border-border-dark"
											: "bg-surface-light border border-border-light shadow-soft"
									}
								`}
							>
								<div className="flex items-start gap-4">
									<div
										className={`
											p-2 rounded-lg
											${isDarkMode ? "bg-warning-dark-subtle" : "bg-warning-subtle"}
										`}
									>
										<HelpCircle className={`w-5 h-5 ${isDarkMode ? "text-warning-dark" : "text-warning"}`} />
									</div>
									<div>
										<h3
											className={`
												font-semibold mb-2
												${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
											`}
										>
											Flexible Control
										</h3>
										<p
											className={`
												text-sm leading-relaxed
												${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
											`}
										>
											Set fine-grained permissions for artists and collectors.
											Take total control over who can do what
										</p>
									</div>
								</div>
							</div>

							<div
								className={`
									p-6 rounded-xl
									${
										isDarkMode
											? "bg-surface-dark border border-border-dark"
											: "bg-surface-light border border-border-light shadow-soft"
									}
								`}
							>
								<div className="flex items-start gap-4">
									<div
										className={`
											p-2 rounded-lg
											${isDarkMode ? "bg-danger-dark-subtle" : "bg-danger-subtle"}
										`}
									>
										<Heart className={`w-5 h-5 ${isDarkMode ? "text-danger-dark" : "text-danger"}`} />
									</div>
									<div>
										<h3
											className={`
												font-semibold mb-2
												${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
											`}
										>
											Fully Open Source
										</h3>
										<p
											className={`
												text-sm leading-relaxed
												${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
											`}
										>
											Transparent, auditable code. Fork it, improve it, or run your own version
										</p>
									</div>
								</div>
							</div>
						</div>
					</section>
					{/* FAQ Section */}
					<section className="py-16">
						<div className="text-center mb-12">
							<h2
								className={`
									text-3xl md:text-4xl font-bold mb-4
									${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
								`}
							>
								Common Questions
							</h2>
						</div>

						<div className="max-w-3xl mx-auto space-y-4">
							{/* FAQ Item 1 */}
							<div
								className={`
									rounded-lg border overflow-hidden
									${
										isDarkMode
											? "bg-surface-dark border-border-dark"
											: "bg-surface-light border-border-light"
									}
								`}
							>
								<button
									onClick={() => toggleFaq("what")}
									className={`
										w-full px-6 py-4 flex items-center justify-between
										transition-colors
										${
											isDarkMode
												? "hover:bg-surface-hover-dark"
												: "hover:bg-surface-hover-light"
										}
									`}
								>
									<h3
										className={`
											text-lg font-semibold text-left
											${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
										`}
									>
										What problem does MURI Protocol solve?
									</h3>
									<span
										className={`
											text-2xl
											${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}
										`}
									>
										{openFaq.what ? "−" : "+"}
									</span>
								</button>
								{openFaq.what && (
									<div
										className={`
											px-6 pb-4 pt-2
											${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
										`}
									>
										<p className="leading-relaxed">
											Most NFTs rely on a single link to display the artwork. If that
											link breaks (server goes down, IPFS gateway fails, etc.), the
											NFT becomes a broken image. MURI stores multiple backup
											links and automatically tries each one until it finds a working
											version. Your art stays visible, no matter what.
										</p>
									</div>
								)}
							</div>

							{/* FAQ Item 2 */}
							<div
								className={`
									rounded-lg border overflow-hidden
									${
										isDarkMode
											? "bg-surface-dark border-border-dark"
											: "bg-surface-light border-border-light"
									}
								`}
							>
								<button
									onClick={() => toggleFaq("how")}
									className={`
										w-full px-6 py-4 flex items-center justify-between
										transition-colors
										${
											isDarkMode
												? "hover:bg-surface-hover-dark"
												: "hover:bg-surface-hover-light"
										}
									`}
								>
									<h3
										className={`
											text-lg font-semibold text-left
											${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
										`}
									>
										How does it work technically?
									</h3>
									<span
										className={`
											text-2xl
											${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}
										`}
									>
										{openFaq.how ? "−" : "+"}
									</span>
								</button>
								{openFaq.how && (
									<div
										className={`
											px-6 pb-4 pt-2
											${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
										`}
									>
										<p className="leading-relaxed">
											MURI stores your NFT metadata and a hash of your artwork
											on-chain. You provide multiple URLs where your artwork lives
											(IPFS, Arweave, etc.). In "Smart HTML" mode, we embed a smart
											template that tries each URL in order until one loads. In
											"Direct mode," you (or collectors, if allowed) can pick which 
											URL to show and switch manually if needed.
										</p>
									</div>
								)}
							</div>

							{/* FAQ Item 3 */}
							<div
								className={`
									rounded-lg border overflow-hidden
									${
										isDarkMode
											? "bg-surface-dark border-border-dark"
											: "bg-surface-light border-border-light"
									}
								`}
							>
								<button
									onClick={() => toggleFaq("why")}
									className={`
										w-full px-6 py-4 flex items-center justify-between
										transition-colors
										${
											isDarkMode
												? "hover:bg-surface-hover-dark"
												: "hover:bg-surface-hover-light"
										}
									`}
								>
									<h3
										className={`
											text-lg font-semibold text-left
											${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
										`}
									>
										Can collectors really help preserve my art?
									</h3>
									<span
										className={`
											text-2xl
											${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}
										`}
									>
										{openFaq.why ? "−" : "+"}
									</span>
								</button>
								{openFaq.why && (
									<div
										className={`
											px-6 pb-4 pt-2
											${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
										`}
									>
										<p className="leading-relaxed">
											Yes! If you grant permission, collectors can add their own
											backup URLs for artwork they own. This creates a community
											preservation effort - if your original links fail, collector
											backups can keep the art alive. You decide what collectors can
											and can't do.
										</p>
									</div>
								)}
							</div>

							{/* FAQ Item 4 */}
							<div
								className={`
									rounded-lg border overflow-hidden
									${
										isDarkMode
											? "bg-surface-dark border-border-dark"
											: "bg-surface-light border-border-light"
									}
								`}
							>
								<button
									onClick={() => toggleFaq("who")}
									className={`
										w-full px-6 py-4 flex items-center justify-between
										transition-colors
										${
											isDarkMode
												? "hover:bg-surface-hover-dark"
												: "hover:bg-surface-hover-light"
										}
									`}
								>
									<h3
										className={`
											text-lg font-semibold text-left
											${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
										`}
									>
										Who should use MURI Protocol?
									</h3>
									<span
										className={`
											text-2xl
											${isDarkMode ? "text-text-tertiary-dark" : "text-text-tertiary-light"}
										`}
									>
										{openFaq.who ? "−" : "+"}
									</span>
								</button>
								{openFaq.who && (
									<div
										className={`
											px-6 pb-4 pt-2
											${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
										`}
									>
										<p className="leading-relaxed">
											Artists whose artwork is too large to store fully on-chain. While
											fully on-chain minting is the most resilient approach, MURI 
											provides the next best option when that's not practical due to file 
											size—offering better protection against link rot and platform failures 
											by not putting all your eggs in one basket. Works with Manifold Creator 
											Cores (ERC721 and ERC1155).
										</p>
									</div>
								)}
							</div>
						</div>
					</section>

					{/* CTA Section */}
					<section className="py-16 text-center">
						<div className="max-w-4xl mx-auto">
							<div
								className={`
									p-12 md:p-16 rounded-3xl
									${
										isDarkMode
											? "bg-surface-dark border-2 border-border-dark shadow-strong"
											: "bg-surface-light border-2 border-border-light shadow-strong"
									}
								`}
							>
								<Sparkles className={`w-16 h-16 mx-auto mb-6 ${isDarkMode ? "text-primary-dark" : "text-primary"}`} />
								
								<h2
									className={`
										text-3xl md:text-5xl font-bold mb-6
										${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
									`}
								>
									Ready to get started?
								</h2>
								<p
									className={`
										text-lg md:text-xl mb-10 leading-relaxed
										${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
									`}
								>
									Start minting more resilient NFTs
								</p>
								<Link
									to="/collections"
									className={`group inline-block px-12 py-6 rounded-2xl text-xl font-bold text-white shadow-strong transition-all duration-300 hover:scale-105 ${
										isDarkMode ? "bg-primary-dark hover:bg-primary-dark-hover" : "bg-primary hover:bg-primary-hover"
									}`}
								>
									<span className="flex items-center gap-3">
										Get Started
										<Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
									</span>
								</Link>
							</div>
						</div>
					</section>
				</div>
			</div>

			<Footer isDarkMode={isDarkMode} />
		</PageBackground>
	);
}
