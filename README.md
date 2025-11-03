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
- x402 integration for decentralized storage uploads
- Manifold extension for ERC721/ERC1155 contracts

## Contracts

| Contract | Address |
|----------|---------|
| MURIProtocol (Sepolia) | `0x16717a3A721E30a139cB99D78eEE57b266114ACA` |
| MURIManifoldExtension (Sepolia) | `0x41f961a72E1E5F03D4176f428664A1236531B4Ed` |

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

```bash
# Contracts
cd contract && pnpm install && pnpm run build

# Frontend
cd frontend && pnpm install && pnpm run dev
```

**Stack:**
- Contracts: Solidity 0.8.30+, Foundry, Solady
- Frontend: React 19, TypeScript, Vite, Tailwind, Wagmi

## Contributing

PRs welcome. Audits appreciated. Looking for maintainers.

Built with support from the [Pushers community](https://discord.gg/VmjjHSyWJ8).

## License

MIT - See LICENSE.md

## Links

- [Off-Chain Art](https://x.com/YigitDuman/status/1957514000306246110) — original inspiration
- [Pushers Community](https://discord.gg/VmjjHSyWJ8)
- [Manifold Creator Core](https://github.com/manifoldxyz/creator-core-solidity)