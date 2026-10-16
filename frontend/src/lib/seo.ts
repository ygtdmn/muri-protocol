// Page metadata for search engines and link previews. Plain data, no browser APIs: the Vite build
// (vite.config.ts) reads it too, to write each page's tags into its own HTML file, since link
// preview crawlers (X, Discord, Telegram, Slack, iMessage) don't run JavaScript.

export const SITE_URL = "https://muri.yigitduman.com";
export const SITE_NAME = "MURI Protocol";
export const AUTHOR = "Yigit Duman";
export const AUTHOR_X = "@yigitduman";

export interface PageMeta {
	path: string;
	/** Shown in tabs and search results, without the site name (added on render). */
	title: string;
	description: string;
	/** 1200×630 share image in public/og. */
	image: string;
	imageAlt: string;
	/** Left out of the sitemap and marked noindex. */
	hidden?: boolean;
}

export const PAGES = {
	home: {
		path: "/",
		title: "Keep NFT artwork online",
		description:
			"MURI gives an NFT several copies of its file and records the file's hash on-chain. The token loads the first copy that still exists and still matches.",
		image: "/og/home.png",
		imageAlt: "Off-Chain Art by Yigit Duman, beside the words: as long as one copy survives, so does the artwork.",
	},
	collections: {
		path: "/collections",
		title: "Get started",
		description:
			"Mint new artworks into your Manifold collection, manage the ones you made, or help preserve a token you own.",
		image: "/og/collections.png",
		imageAlt: "MURI Protocol: get started.",
	},
	mint: {
		path: "/mint",
		title: "Mint an artwork",
		description:
			"Mint an NFT whose file is stored in several places, on Arweave, IPFS or your own servers, with its hash on-chain to verify every copy.",
		image: "/og/mint.png",
		imageAlt: "MURI Protocol: mint an artwork.",
	},
	update: {
		path: "/update",
		title: "Manage a token",
		description:
			"Add or remove copies of a MURI token's artwork, change its thumbnail, metadata and display mode, all on-chain.",
		image: "/og/update.png",
		imageAlt: "MURI Protocol: manage a token.",
	},
	collectorZone: {
		path: "/collector-zone",
		title: "Preserve a token",
		description:
			"Own a MURI token? Check its links and add your own copies of the artwork, so it outlives any single host.",
		image: "/og/collector-zone.png",
		imageAlt: "MURI Protocol: preserve a token.",
	},
	terms: {
		path: "/terms",
		title: "Terms of Use",
		description:
			"The terms for using the MURI Protocol site and contracts. MURI takes no fees; storage and swaps are paid to the third parties that provide them.",
		image: "/og/terms.png",
		imageAlt: "MURI Protocol: terms of use.",
	},
	notFound: {
		path: "/404",
		title: "Nothing at this address",
		description: "This page doesn't exist.",
		image: "/og/home.png",
		imageAlt: "MURI Protocol.",
		hidden: true,
	},
} satisfies Record<string, PageMeta>;

export type PageKey = keyof typeof PAGES;

export const fullTitle = (page: PageMeta) => (page.path === "/" ? `${SITE_NAME}: ${page.title}` : `${page.title} · ${SITE_NAME}`);

const escape = (value: string) =>
	value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The head tags for one page, as HTML. */
export function renderPageMeta(page: PageMeta): string {
	const url = `${SITE_URL}${page.path === "/" ? "/" : page.path}`;
	const image = `${SITE_URL}${page.image}`;
	const title = escape(fullTitle(page));
	const description = escape(page.description);
	const alt = escape(page.imageAlt);
	const tags = [
		`<title>${title}</title>`,
		`<meta name="description" content="${description}" />`,
		page.hidden ? `<meta name="robots" content="noindex" />` : `<link rel="canonical" href="${url}" />`,
		`<meta property="og:type" content="website" />`,
		`<meta property="og:site_name" content="${SITE_NAME}" />`,
		`<meta property="og:url" content="${url}" />`,
		`<meta property="og:title" content="${title}" />`,
		`<meta property="og:description" content="${description}" />`,
		`<meta property="og:image" content="${image}" />`,
		`<meta property="og:image:type" content="image/png" />`,
		`<meta property="og:image:width" content="1200" />`,
		`<meta property="og:image:height" content="630" />`,
		`<meta property="og:image:alt" content="${alt}" />`,
		`<meta property="og:locale" content="en_US" />`,
		`<meta name="twitter:card" content="summary_large_image" />`,
		`<meta name="twitter:creator" content="${AUTHOR_X}" />`,
		`<meta name="twitter:title" content="${title}" />`,
		`<meta name="twitter:description" content="${description}" />`,
		`<meta name="twitter:image" content="${image}" />`,
		`<meta name="twitter:image:alt" content="${alt}" />`,
	];
	return tags.join("\n\t\t");
}

/** Structured data for search engines: what the site is and who made it. */
function renderStructuredData(): string {
	const data = {
		"@context": "https://schema.org",
		"@type": "WebApplication",
		name: SITE_NAME,
		url: `${SITE_URL}/`,
		description: PAGES.home.description,
		applicationCategory: "UtilitiesApplication",
		operatingSystem: "Any",
		isAccessibleForFree: true,
		offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
		author: { "@type": "Person", name: AUTHOR, url: "https://yigitduman.com" },
		sameAs: ["https://github.com/ygtdmn/muri-protocol"],
	};
	return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

// The page's tags sit between these comments, so the build and the app can swap them as a block.
export const HEAD_START = "<!--page-meta:start-->";
export const HEAD_END = "<!--page-meta:end-->";

/** Everything page-specific in <head>: the tags, plus structured data on the home page. */
export function renderHead(page: PageMeta): string {
	const tags = renderPageMeta(page) + (page.path === "/" ? `\n\t\t${renderStructuredData()}` : "");
	return `${HEAD_START}\n\t\t${tags}\n\t\t${HEAD_END}`;
}

/** The page for a pathname; anything unknown is the not-found page. */
export function pageForPath(pathname: string): PageMeta {
	const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
	return (Object.values(PAGES) as PageMeta[]).find((p) => p.path === path && !p.hidden) ?? PAGES.notFound;
}
