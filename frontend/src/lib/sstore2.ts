import { concat, isHex, numberToHex } from "viem";
import type { Address, Hex } from "viem";
import { deployContract, getConnection, getPublicClient, waitForTransactionReceipt } from "wagmi/actions";
import { wagmiConfig } from "./wagmi";
import { planGas } from "./gas";
import { ensureWalletChain } from "./chains";
import type { AppChainId } from "./chains";

// Why this exists: MURIProtocol.updateThumbnail writes the new chunks, then assigns the whole
// thumbnail struct from calldata, which replaces the chunk list it just wrote with the one passed
// in. Passing an empty list (the obvious call) wipes the thumbnail. The contract is deployed, so
// instead the app stores the chunks itself, in the same format, and passes their addresses.

/**
 * Creation code for a Solady SSTORE2 data contract holding `data`: a 10-byte header that copies
 * the rest of the code into place and returns it, then 0x00 (a STOP, so the data can never run)
 * and the data. SSTORE2.read skips that first byte. Same layout MURIProtocol's own writes produce.
 */
export function pointerCreationCode(data: Hex): Hex {
	if (!isHex(data)) throw new Error("Chunk must be hex.");
	const length = (data.length - 2) / 2;
	if (length + 1 > 0xfffe) throw new Error("Chunk too large for one data contract.");
	return concat(["0x61", numberToHex(length + 1, { size: 2 }), "0x80600a3d393df3", "0x00", data]);
}

/**
 * Deploy one data contract holding `data` from the connected wallet, and return its address once
 * it's confirmed and its code checks out.
 */
export async function deployPointer(chainId: AppChainId, data: Hex): Promise<Address> {
	await ensureWalletChain(chainId);
	const { address: account } = getConnection(wagmiConfig);
	const bytecode = pointerCreationCode(data);
	const plan = await planGas(chainId, (client) => client.estimateGas({ account, data: bytecode }));
	if ("error" in plan) throw new Error(plan.error);

	const hash = await deployContract(wagmiConfig, {
		abi: [],
		bytecode,
		chainId,
		gas: "gas" in plan ? plan.gas : undefined,
	});
	const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId });
	if (receipt.status !== "success" || !receipt.contractAddress) {
		throw new Error("Storing the thumbnail data failed on-chain.");
	}

	const code = await getPublicClient(wagmiConfig, { chainId }).getCode({ address: receipt.contractAddress });
	if (code?.toLowerCase() !== concat(["0x00", data]).toLowerCase()) {
		throw new Error("The stored thumbnail data doesn't match what was sent.");
	}
	return receipt.contractAddress;
}
