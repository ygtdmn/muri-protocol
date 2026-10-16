/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** MURIProtocol, the same address on every network. */
	readonly VITE_MURI_ADDRESS: `0x${string}`;
	/** MURIProtocolManifoldExtension, the same address on every network. */
	readonly VITE_MURI_EXTENSION_ADDRESS: `0x${string}`;
	/** Manifold OAuth app, for listing a creator's collections. Optional. */
	readonly VITE_MANIFOLD_CLIENT_ID?: string;
	readonly VITE_MANIFOLD_APP_NAME?: string;
	/** Without it the WalletConnect option is hidden. */
	readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
	/** Where the Relay proxy lives. Defaults to this site's /api/relay. */
	readonly VITE_RELAY_API_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
