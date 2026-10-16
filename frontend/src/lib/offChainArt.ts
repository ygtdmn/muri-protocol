// Off-Chain Art (2025), the artwork MURI Protocol grew out of.
// Values below are read from the token's on-chain metadata and HTML.

export const OFF_CHAIN_ART = {
	title: "Off-Chain Art",
	year: 2025,
	date: "August 18, 2025",
	collection: "Ephemera",
	contract: "0xcb337152b6181683010d07e3f00e7508cd348bc7",
	tokenId: 7,
	standard: "ERC-1155",
	fileHash: "0x64e7494e20117fcfd5b7c5992460696c1c3114242c949a69e21a3937199f0edc",
	fileBytes: 19_159_304,
	width: 3840,
	height: 2160,
	thumbnail: { width: 512, height: 288, bytes: 45_754 },
	images: {
		full: "/art/off-chain-art-2400.webp",
		medium: "/art/off-chain-art-1200.webp",
		onChainThumbnail: "/art/off-chain-art-onchain-thumb.webp",
	},
	// In the order the token's HTML tries them.
	uris: [
		{ host: "web3.storage", kind: "IPFS", uri: "https://bafybeidjzgptc5unebgsbw3npoyzkpjzwuzoarw2wvkgroq2d4uzldoyp4.ipfs.w3s.link/" },
		{ host: "Amazon S3", kind: "Server", uri: "https://ygtdmn.s3.us-east-1.amazonaws.com/off-chain+art.png" },
		{ host: "Lighthouse", kind: "IPFS", uri: "https://gateway.lighthouse.storage/ipfs/bafybeidjzgptc5unebgsbw3npoyzkpjzwuzoarw2wvkgroq2d4uzldoyp4" },
		{ host: "GitHub", kind: "Server", uri: "https://raw.githubusercontent.com/ygtdmn/off-chain-art/refs/heads/main/artwork.png" },
		{ host: "Internet Archive", kind: "Archive", uri: "https://ia601007.us.archive.org/31/items/off-chain-art/off-chain%20art.png" },
		{ host: "Arweave", kind: "Arweave", uri: "https://amlljqoil6w6uh3pfyuk34uanrnznx2hf6prpovwzvkia4d673vq.arweave.net/Axa0wchfreofby4orfKAbFuW30cvnxe6ts1UgHB-_us" },
	],
	paintings: [
		{ title: "The Night Watch", artist: "Rembrandt" },
		{ title: "The Last Supper", artist: "Leonardo da Vinci" },
		{ title: "The Vision of Saint John", artist: "El Greco" },
		{ title: "The Last Judgement", artist: "Michelangelo" },
		{ title: "Las Meninas", artist: "Diego Velázquez" },
		{ title: "The Death of Actaeon", artist: "Titian" },
	],
	links: {
		thread: "https://x.com/YigitDuman/status/1957514000306246110",
		token: "https://opensea.io/item/ethereum/0xcb337152b6181683010d07e3f00e7508cd348bc7/7",
		code: "https://github.com/ygtdmn/off-chain-art",
	},
} as const;

export const shortUri = (uri: string, length = 30) =>
	uri.length > length ? `${uri.slice(0, length)}...` : uri;
