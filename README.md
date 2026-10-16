# MURI Protocol

Multiple URIs for any smart contract. Keep links alive on Ethereum.

Built to solve a simple problem: links die. URLs break, IPFS pins expire, storage nodes go offline. MURI lets you store multiple URIs per token and switch between them when one fails. Originally built for artwork permanency, but it works for any smart contract that needs resilient link storage.

First explored in the artwork [Off-Chain Art](https://x.com/YigitDuman/status/1957514000306246110) by [Yigit Duman](https://x.com/YigitDuman).

## What It Does

Store multiple URIs per token. Manage them with granular permissions. Keep things alive when links rot.

- Multiple URI storage per token
- Granular permission system for collaborative management
- Automatic URI switching when primary fails
- On-chain metadata and file hashes
- On-chain thumbnails (optional)
- Optional pay-per-upload storage over x402 (USDC on Base): Arweave via ar.io Turbo, IPFS via Pinata. Anything else can be paid in via a Relay swap or bridge
- No protocol fees: MURI takes nothing. Storage payments go straight to the providers, and you can always paste links you host yourself
- Manifold extension for ERC721/ERC1155 contracts

## Contracts

| Contract | Address |
|----------|---------|
| MURIProtocol (Mainnet, Base, Sepolia) | `0x0000000000C2A0B63ab4aA971B08B905E5875b01` |
| MURIProtocolManifoldExtension (Mainnet, Base, Sepolia) | `0x0FFc4A1906157248ae64F28fD259bB7a2790606C` |

### Core Components

- `MURIProtocol`: Main contract handling token data, permissions, and URI resolution
- `MURIProtocolManifoldExtension`: Manifold integration for seamless minting
- `IMURIProtocolCreator`: Interface for ownership verification

## Usage

### Frontend

Visit [muri.yigitduman.com](https://muri.yigitduman.com) to mint and manage tokens through the UI.

### Smart Contracts

Integrate MURI into your contract:

1. Implement `IMURIProtocolCreator`
2. Register: `MURIProtocol.registerContract()`
3. Initialize: `initializeTokenData()`
4. Manage: `addArtworkUris()`, `removeArtworkUris()`, `setSelectedUri()`

Or use the Manifold extension if you're already on ERC721/ERC1155.

## Development

Prerequisites: Node 22+, pnpm 10, and [Foundry](https://book.getfoundry.sh/getting-started/installation) for the contracts.

### Contracts

```bash
cd contract
pnpm install   # Solidity dependencies (Manifold, OpenZeppelin, Solady) resolve from node_modules
forge build
forge test
```

The Smart HTML page lives in `contract/html-template/template.html`. After editing it, run `node html-template/minify-template.js` and push the result to each network as the protocol owner:

```bash
forge script script/UpdateHTMLTemplate.s.sol --rpc-url <network> --account <keystore> --sender <owner> --broadcast
```

The script checks the signer is the owner, skips networks that are already up to date, and reads the template back afterwards. On a network that has activated Glamsterdam, Foundry's local simulation underestimates storage gas. Send the transaction from the script's dry run with `cast send` and an explicit `--gas-limit` there.

### Frontend

```bash
cd frontend
cp .env.example .env   # fill in the values below
pnpm install
pnpm dev
```

| Variable | Needed for |
|----------|-----------|
| `VITE_MURI_ADDRESS`, `VITE_MURI_EXTENSION_ADDRESS` | Everything (prefilled with the deployed addresses) |
| `VITE_WALLETCONNECT_PROJECT_ID` | The WalletConnect option (hidden without it) |
| `VITE_MANIFOLD_CLIENT_ID`, `VITE_MANIFOLD_APP_NAME` | Listing a creator's Manifold collections (pasting an address works without) |
| `RELAY_API_KEY` | Relay swaps and bridges. Server-side only, never `VITE_`-prefixed |

`pnpm build` type-checks the app, the Vercel function in `api/` and the Vite config, then writes `dist/` with one HTML file per page so link previews get the right title and image.

### Deploying

The frontend runs on Vercel with `frontend/` as the project root. `vercel.json` serves the pages by clean URL and routes `/api/relay/*` to `api/relay.ts`, which adds `RELAY_API_KEY` to Relay requests. Set the variables above in the Vercel project, `RELAY_API_KEY` included.

**Stack:**
- Contracts: Solidity 0.8.30, Foundry, Solady
- Frontend: React 19, TypeScript, Vite, Tailwind 4, wagmi 3 with our own connect modal

## Contributing

PRs welcome. Audits appreciated. Looking for maintainers.

Built with support from the [Pushers community](https://discord.gg/VmjjHSyWJ8).

## License

MIT - See LICENSE.md

## Links

- [Off-Chain Art](https://x.com/YigitDuman/status/1957514000306246110) — original inspiration
- [Pushers Community](https://discord.gg/VmjjHSyWJ8)
- [Manifold Creator Core](https://github.com/manifoldxyz/creator-core-solidity)