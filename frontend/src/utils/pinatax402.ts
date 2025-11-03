import { wrapFetchWithPayment, type Signer } from 'x402-fetch';
import type { WalletClient } from 'viem';

const PINATA_X402_ENDPOINT = 'https://402.pinata.cloud/v1/pin/public';

interface PinataX402PresignedResponse {
	url: string;
}

interface PinataUploadData {
	id: string;
	name?: string;
	cid: string;
	size: number;
	number_of_files: number;
	mime_type: string;
	user_id: string;
	group_id?: string;
	created_at: string;
	updated_at?: string;
	vectorized?: boolean;
	network?: string;
	keyvalues?: Record<string, string>;
	is_duplicate?: boolean;
	cid_version?: string;
}

interface PinataUploadResponse {
	data: PinataUploadData;
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
export async function pinToIPFSWithX402(options: PinToIPFSOptions): Promise<PinataUploadData> {
	const { file, name, walletClient } = options;

	// Wrap fetch with payment handling
	// Max value set to 10 USDC (1000000 base units for USDC which has 6 decimals)
	// WalletClient from viem is compatible with the Signer interface
	const fetchWithPayment = wrapFetchWithPayment(
		fetch,
		walletClient as unknown as Signer,
		BigInt(10000000), // 10 USDC max
	);

	try {
		// Step 1: Request a presigned URL from x402 endpoint
		// This will trigger payment via the x402 protocol
		const presignedResponse = await fetchWithPayment(PINATA_X402_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				fileSize: file.size,
			}),
		});

		if (!presignedResponse.ok) {
			const errorText = await presignedResponse.text();
			throw new Error(`Failed to get presigned URL: ${presignedResponse.status} ${errorText}`);
		}

		const { url: presignedUrl } = await presignedResponse.json() as PinataX402PresignedResponse;

		// Step 2: Upload the file to the presigned URL
		const formData = new FormData();
		formData.append('file', file);
		
		if (name) {
			formData.append('name', name);
		}

		const uploadResponse = await fetch(presignedUrl, {
			method: 'POST',
			body: formData,
		});

		if (!uploadResponse.ok) {
			const errorText = await uploadResponse.text();
			throw new Error(`File upload failed: ${uploadResponse.status} ${errorText}`);
		}

		// Try to parse the response
		const responseText = await uploadResponse.text();
		console.log('Upload response:', responseText);
		
		let response: PinataUploadResponse;
		try {
			response = JSON.parse(responseText) as PinataUploadResponse;
		} catch {
			console.error('Failed to parse upload response:', responseText);
			throw new Error('Invalid JSON response from upload');
		}
		
		// Validate response has required fields
		if (!response?.data?.cid) {
			console.error('Invalid upload response - missing CID:', response);
			throw new Error('Upload succeeded but no CID was returned. Check console for details.');
		}

		console.log('Successfully pinned to IPFS:', response.data.cid);
		return response.data;
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
 * Pinata charges $0.10/GB × 12 months = $1.20 per GB for 12 months
 * Minimum charge is $0.0001 per request
 * This is an approximation - actual cost is returned in the 402 response
 */
export function estimatePinningCost(fileSizeBytes: number): string {
	const PRICE_PER_GB = 0.1;
	const MONTHS = 12;
	const MIN_PRICE = 0.0001;
	
	// Convert bytes to GB
	const sizeInGB = fileSizeBytes / (1024 * 1024 * 1024);
	
	// Calculate price: $0.10/GB × 12 months
	const price = sizeInGB * PRICE_PER_GB * MONTHS;
	const priceToUse = price >= MIN_PRICE ? price : MIN_PRICE;
	
	// Format with 4 decimal places
	return `$${priceToUse.toFixed(4)}`;
}

