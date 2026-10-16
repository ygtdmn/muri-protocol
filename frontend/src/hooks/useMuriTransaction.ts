import { useCallback, useEffect, useRef, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { getConnection } from "wagmi/actions";
import type { Abi, Address, ContractFunctionArgs, ContractFunctionName, Hash } from "viem";
import { wagmiConfig } from "../lib/wagmi";
import { planGas } from "../lib/gas";
import { ensureWalletChain, isAppChain } from "../lib/chains";
import type { AppChainId } from "../lib/chains";
import { describeContractError } from "../utils/rpcErrors";
import { requireTerms } from "../lib/terms";

type Mutability = "nonpayable" | "payable";

export interface ContractCall<
	TAbi extends Abi,
	TName extends ContractFunctionName<TAbi, Mutability>,
> {
	abi: TAbi;
	address: Address;
	functionName: TName;
	args: ContractFunctionArgs<TAbi, Mutability, TName>;
	value?: bigint;
}

export type TxPhase = "idle" | "checking" | "signing" | "confirming" | "confirmed" | "failed";

export interface TxState {
	action: string | null;
	phase: TxPhase;
	hash?: Hash;
	/** The network the transaction was sent on. */
	chainId?: AppChainId;
	error?: string;
	/** Preflight could not reach the RPC; we sent the transaction anyway. */
	warning?: string;
}

/**
 * Estimate, send and confirm one contract call at a time, on the page's network (`chainId`; the
 * wallet's network if not given). The wallet is asked to switch first if it's elsewhere, and the
 * receipt is watched on the network the transaction went to, whatever the wallet does next.
 * A revert found while estimating stops before the wallet prompt; an RPC outage does not.
 */
export function useMuriTransaction(onConfirmed?: (action: string, hash: Hash) => void, chainId?: AppChainId) {
	const { mutateAsync: writeContractAsync } = useWriteContract();
	const [state, setState] = useState<TxState>({ action: null, phase: "idle" });
	const receipt = useWaitForTransactionReceipt({ hash: state.hash, chainId: state.chainId });
	const reported = useRef<Hash | undefined>(undefined);
	const onConfirmedRef = useRef(onConfirmed);
	useEffect(() => {
		onConfirmedRef.current = onConfirmed;
	});

	useEffect(() => {
		if (state.phase !== "confirming" || !state.hash) return;
		if (receipt.isSuccess && reported.current !== state.hash) {
			reported.current = state.hash;
			if (receipt.data.status === "reverted") {
				setState((s) => ({ ...s, phase: "failed", error: "The transaction reverted on-chain." }));
				return;
			}
			setState((s) => ({ ...s, phase: "confirmed" }));
			if (state.action) onConfirmedRef.current?.(state.action, state.hash);
		}
		if (receipt.isError) {
			setState((s) => ({ ...s, phase: "failed", error: describeContractError(receipt.error) }));
		}
	}, [receipt.isSuccess, receipt.isError, receipt.data, receipt.error, state.phase, state.hash, state.action]);

	const run = useCallback(
		async <TAbi extends Abi, TName extends ContractFunctionName<TAbi, Mutability>>(
			action: string,
			call: ContractCall<TAbi, TName>
		) => {
			if (!(await requireTerms())) return;
			const target = chainId ?? getConnection(wagmiConfig).chainId;
			if (!isAppChain(target)) {
				setState({ action, phase: "failed", error: "Switch your wallet to Ethereum, Base or Sepolia." });
				return;
			}
			setState({ action, phase: "checking", chainId: target });
			try {
				await ensureWalletChain(target);
			} catch (error) {
				setState({ action, phase: "failed", chainId: target, error: (error as Error).message });
				return;
			}

			const { address: account } = getConnection(wagmiConfig);
			const plan = await planGas(target, (client) =>
				client.estimateContractGas({ ...(call as never as object), account } as never)
			);
			if ("error" in plan) {
				setState({ action, phase: "failed", chainId: target, error: plan.error });
				return;
			}
			const warning = "warning" in plan ? plan.warning : undefined;
			const gas = "gas" in plan ? plan.gas : undefined;

			setState({ action, phase: "signing", chainId: target, warning });
			try {
				// With chainId set, wagmi refuses to send if the wallet moved to another network meanwhile.
				const hash = await writeContractAsync({ ...(call as never as object), gas, chainId: target } as never);
				setState({ action, phase: "confirming", chainId: target, hash, warning });
			} catch (error) {
				setState({ action, phase: "failed", chainId: target, error: describeContractError(error), warning });
			}
		},
		[writeContractAsync, chainId]
	);

	const reset = useCallback(() => setState({ action: null, phase: "idle" }), []);

	const busy = state.phase === "checking" || state.phase === "signing" || state.phase === "confirming";

	return { state, run, reset, busy, receipt: state.phase === "confirmed" ? receipt.data : undefined };
}

export const phaseLabel: Record<TxPhase, string> = {
	idle: "",
	checking: "Checking",
	signing: "Confirm in wallet",
	confirming: "Confirming",
	confirmed: "Confirmed",
	failed: "Failed",
};
