import {
	BaseError,
	ContractFunctionRevertedError,
	HttpRequestError,
	LimitExceededRpcError,
	MethodNotFoundRpcError,
	MethodNotSupportedRpcError,
	TimeoutError,
	UserRejectedRequestError,
	WebSocketRequestError,
} from "viem";

export function getErrorMessage(error: unknown): string {
	if (error instanceof BaseError) return error.shortMessage;
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Unknown error";
}

/**
 * The RPC itself failed (unreachable, timed out, rate limited, method unavailable), as opposed to the
 * call failing. Judged by viem's error classes, never by searching the message: viem's messages
 * include the call's arguments and calldata, where a fragment like "429" turns up by chance.
 */
export function isRpcTransportError(error: unknown): boolean {
	if (error instanceof BaseError) {
		if (error.walk((e) => e instanceof ContractFunctionRevertedError)) return false;
		return Boolean(
			error.walk(
				(e) =>
					e instanceof HttpRequestError ||
					e instanceof WebSocketRequestError ||
					e instanceof TimeoutError ||
					e instanceof LimitExceededRpcError ||
					e instanceof MethodNotFoundRpcError ||
					e instanceof MethodNotSupportedRpcError
			)
		);
	}
	// A bare fetch failure that never went through viem.
	return error instanceof TypeError && /fetch|network|load failed/i.test(error.message);
}

export function isUserRejection(error: unknown): boolean {
	if (error instanceof BaseError) {
		return Boolean(error.walk((e) => e instanceof UserRejectedRequestError));
	}
	return /user (rejected|denied)/i.test(getErrorMessage(error));
}

// Custom errors from IMURIProtocol.sol, phrased for people.
const REVERT_REASONS: Record<string, string> = {
	WalletNotAdmin: "Your wallet is not an admin of this collection.",
	NotTokenOwner: "Your wallet does not own this token.",
	NotTokenOwnerOrAdmin: "Only the collection admin or the token owner can do this.",
	InvalidIndexRange: "That URI index does not exist anymore. Reload and try again.",
	ContractNotRegistered: "This collection is not registered with MURI yet.",
	UnauthorizedOperator: "The MURI extension is not allowed to operate on this collection.",
	ArtistPermissionRevoked: "The artist permission for this action has been revoked.",
	CollectorPermissionDenied: "Collectors are not allowed to do this on this token.",
	InvalidThumbnailKind: "Invalid thumbnail type for this action.",
	OnChainThumbnailEmpty: "The on-chain thumbnail is empty.",
	InvalidMetadata: "The metadata is not valid.",
	InvalidArtworkUris: "Add at least one artwork URI.",
	InvalidMimeType: "The artwork file type could not be detected.",
	InvalidFileHash: "The artwork hash is missing.",
	InvalidSelectedArtistUriIndex: "The selected artwork URI is out of range.",
	InvalidSelectedThumbnailUriIndex: "The selected thumbnail URI is out of range.",
	InvalidInterface: "This contract is not a Manifold ERC721 or ERC1155 Creator Core.",
};

export function describeContractError(error: unknown): string {
	if (isUserRejection(error)) return "Transaction cancelled in your wallet.";
	if (error instanceof BaseError) {
		const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
		if (revert instanceof ContractFunctionRevertedError) {
			const name = revert.data?.errorName;
			if (name) return REVERT_REASONS[name] ?? `The contract rejected this: ${name}.`;
			// Solady SSTORE2's DeploymentFailed: storing a chunk of on-chain data ran out of gas.
			if (revert.signature === "0x30116425") {
				return "Storing the on-chain data ran out of gas. The gas limit was set too low for its size; try again, or use a smaller on-chain thumbnail.";
			}
			if (revert.reason) return revert.reason;
		}
	}
	return getErrorMessage(error).split("\n")[0];
}
