import { wrapFetchWithPayment, type Signer } from 'x402-fetch';
import type { WalletClient } from 'viem';

const PINATA_X402_ENDPOINT = 'https://api.pinata.cloud/v3/x402/pin';

interface PinataX402Response {
	id: string;
	name?: string;
	cid: string;
	size: number;
	number_of_files: number;
	mime_type: string;
	user_id: string;
	group_id?: string;
	created_at: string;
	expires_at?: string;
}

interface PinToIPFSOptions {
	file: File;
	name?: string;
	walletClient: WalletClient;
}

/**
 * Pin a file to IPFS via Pinata's x402 endpoint for 12 months.
 * Uses the x402 protocol to handle payment automatically.
 * 
 * @param options - Configuration for pinning
 * @returns The Pinata response with CID and details
 * @throws Error if payment is rejected or pinning fails
 */
export async function pinToIPFSWithX402(options: PinToIPFSOptions): Promise<PinataX402Response> {
	const { file, name, walletClient } = options;

	// Create form data for the file
	const formData = new FormData();
	formData.append('file', file);
	
	if (name) {
		formData.append('name', name);
	}

	// Wrap fetch with payment handling
	// Max value set to 1 USDC (1000000 base units for USDC which has 6 decimals)
	// WalletClient from viem is compatible with the Signer interface
	const fetchWithPayment = wrapFetchWithPayment(
		fetch,
		walletClient as unknown as Signer,
		BigInt(1000000), // 1 USDC max
	);

	try {
		// Make the request - wrapFetchWithPayment will handle the 402 response and payment
		const response = await fetchWithPayment(PINATA_X402_ENDPOINT, {
			method: 'POST',
			body: formData,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Pinata pinning failed: ${response.status} ${errorText}`);
		}

		const data = await response.json() as PinataX402Response;
		return data;
	} catch (error) {
		if (error instanceof Error) {
			// User rejected payment or wallet interaction
			if (error.message.includes('rejected') || error.message.includes('denied')) {
				throw new Error('Payment was cancelled by user');
			}
			throw error;
		}
		throw new Error('Failed to pin to IPFS via Pinata x402');
	}
}

/**
 * Get the IPFS gateway URL for a given CID
 */
export function getIPFSUrl(cid: string, gateway: string = 'https://gateway.pinata.cloud'): string {
	return `${gateway}/ipfs/${cid}`;
}

/**
 * Estimate the cost for pinning (Pinata's x402 pricing)
 * Pinata charges $0.10/GB/month × 12 months = $1.20 per GB for 12 months
 * This is an approximation - actual cost is returned in the 402 response
 */
export function estimatePinningCost(fileSizeBytes: number): string {
	// Convert bytes to GB
	const sizeInGB = fileSizeBytes / (1024 * 1024 * 1024);
	
	// $0.10/GB/month × 12 months = $1.20 per GB
	const costUSD = sizeInGB * 1.2;
	
	// Format with minimum of $0.01 and 4 decimal places
	return `$${Math.max(0.01, costUSD).toFixed(4)}`;
}

