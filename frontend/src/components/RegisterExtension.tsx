import { useEffect, useRef, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { simulateContract } from "wagmi/actions";
import type { Address } from "viem";
import { ierc721CreatorCoreAbi } from "../abis/IERC721CreatorCore-abi";
import { ierc1155CreatorCoreAbi } from "../abis/IERC1155CreatorCore-abi";
import { wagmiConfig } from "../lib/wagmi";
import { useTheme } from "../hooks/useTheme";
import { RefreshCw } from "lucide-react";
import { getPreflightMessage, isRpcTransportError } from "../utils/rpcErrors";

interface RegisterExtensionProps {
	creator: Address;
	type: "ERC721" | "ERC1155";
	isRegistered: boolean;
	onSuccess?: () => void;
}

export default function RegisterExtension({
	creator,
	type,
	isRegistered,
	onSuccess,
}: RegisterExtensionProps) {
	const { isDarkMode } = useTheme();
	const baseURI = "";
	const muriExtensionAddress = import.meta.env
		.VITE_MURI_EXTENSION_ADDRESS as Address;

	const coreAbi =
		type === "ERC721" ? ierc721CreatorCoreAbi : ierc1155CreatorCoreAbi;

	const { data: hash, isPending, writeContract } = useWriteContract();
	const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
		hash,
	});
	const [isPreflighting, setIsPreflighting] = useState(false);
	const [preflightMessage, setPreflightMessage] = useState<string | null>(null);
	const reportedSuccessHash = useRef<`0x${string}` | undefined>(undefined);

	const handleRegister = async () => {
		setPreflightMessage(null);
		setIsPreflighting(true);
		try {
			await simulateContract(wagmiConfig, {
				abi: coreAbi,
				address: creator,
				functionName: "registerExtension",
				args: [muriExtensionAddress, baseURI],
			});
		} catch (error) {
			setPreflightMessage(getPreflightMessage(error));
			if (!isRpcTransportError(error)) {
				return;
			}
		} finally {
			setIsPreflighting(false);
		}

		writeContract({
			abi: coreAbi,
			address: creator,
			functionName: "registerExtension",
			args: [muriExtensionAddress, baseURI],
		});
	};

	// Call onSuccess callback when transaction is successful
	useEffect(() => {
		if (isSuccess && hash && reportedSuccessHash.current !== hash) {
			reportedSuccessHash.current = hash;
			onSuccess?.();
		}
	}, [hash, isSuccess, onSuccess]);

	useEffect(() => {
		setPreflightMessage(null);
	}, [creator, type]);

	// Show success message for recent transaction
	if (isSuccess) {
		return (
			<div
				className={`
					p-4 rounded-lg
					${
						isDarkMode
							? "bg-success-dark-subtle border border-success-dark/20"
							: "bg-success-subtle border border-success/20"
					}
				`}
			>
				<p
					className={`
						text-sm font-medium
						${isDarkMode ? "text-success-dark" : "text-success"}
					`}
				>
					✓ MURI extension registered successfully!
				</p>
			</div>
		);
	}

	// Show already registered status
	if (isRegistered) {
		return (
			<div
				className={`
					p-4 rounded-lg
					${
						isDarkMode
							? "bg-success-dark-subtle border border-success-dark/20"
							: "bg-success-subtle border border-success/20"
					}
				`}
			>
				<p
					className={`
						text-sm font-medium
						${isDarkMode ? "text-success-dark" : "text-success"}
					`}
				>
					✓ MURI extension is already registered
				</p>
			</div>
		);
	}

	return (
		<div
			className={`
				p-5 rounded-lg
				${
					isDarkMode
						? "bg-surface-hover-dark border border-border-dark"
						: "bg-surface-hover-light border border-border-light"
				}
			`}
		>
			<div className="mb-4">
				<h4
					className={`
						font-semibold text-base mb-1
						${isDarkMode ? "text-text-primary-dark" : "text-text-primary-light"}
					`}
				>
					1. Register MURI Extension
				</h4>
				<p
					className={`
						text-sm
						${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
					`}
				>
					This allows MURI to work with your Manifold collection
				</p>
			</div>

			<button
				onClick={() => void handleRegister()}
				className={`
					w-full px-6 py-3 rounded-lg font-semibold
					transition-all duration-200
					${
						isPending || isConfirming || isPreflighting || !creator || isRegistered
							? "opacity-50 cursor-not-allowed bg-surface-hover-light dark:bg-surface-hover-dark text-text-tertiary-light dark:text-text-tertiary-dark"
							: "bg-primary hover:bg-primary-hover dark:bg-primary-dark dark:hover:bg-primary-dark-hover text-white shadow-soft hover:shadow-medium"
					}
				`}
				disabled={
					isPending || isConfirming || isPreflighting || !creator || isRegistered
				}
			>
				{isPending || isConfirming || isPreflighting ? (
					<span className="flex items-center justify-center gap-2">
						<RefreshCw className="w-4 h-4 animate-spin" />
						{isPreflighting
							? "Checking..."
							: isPending
							? "Registering..."
							: "Confirming..."}
					</span>
				) : isRegistered ? (
					"✓ Already Registered"
				) : (
					"Register Extension"
				)}
			</button>

			{preflightMessage && (
				<div
					className={`
						mt-3 p-3 rounded-lg
						${
							isDarkMode
								? "bg-warning-dark-subtle border border-warning-dark/30"
								: "bg-warning-subtle border border-warning/30"
						}
					`}
				>
					<p
						className={`
							text-sm font-medium
							${isDarkMode ? "text-warning-dark" : "text-warning"}
						`}
					>
						{preflightMessage}
					</p>
				</div>
			)}

			{hash && !isSuccess && (
				<p
					className={`
						text-sm mt-2
						${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
					`}
				>
					Transaction submitted. Waiting for confirmation...
				</p>
			)}
		</div>
	);
}
