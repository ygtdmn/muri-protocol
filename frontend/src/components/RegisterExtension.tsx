import { useEffect } from "react";
import {
	useWriteContract,
	useWaitForTransactionReceipt,
	useReadContract,
	useSimulateContract,
} from "wagmi";
import type { Address } from "viem";
import { ierc721CreatorCoreAbi } from "../abis/IERC721CreatorCore-abi";
import { ierc1155CreatorCoreAbi } from "../abis/IERC1155CreatorCore-abi";
import { useTheme } from "../hooks/useTheme";
import { RefreshCw } from "lucide-react";

interface RegisterExtensionProps {
	creator: Address;
	type: "ERC721" | "ERC1155";
	onSuccess?: () => void;
}

export default function RegisterExtension({
	creator,
	type,
	onSuccess,
}: RegisterExtensionProps) {
	const { isDarkMode } = useTheme();
	const baseURI = "";
	const wayfinderExtensionAddress = import.meta.env
		.VITE_WAYFINDER_EXTENSION_ADDRESS as Address;

	const coreAbi =
		type === "ERC721" ? ierc721CreatorCoreAbi : ierc1155CreatorCoreAbi;

	const { data: hash, isPending, writeContract } = useWriteContract();
	const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
		hash,
	});

	// Check if extension is already registered
	const { data: extensions } = useReadContract({
		abi: coreAbi,
		address: creator,
		functionName: "getExtensions",
		args: [],
		query: { enabled: !!creator },
	});

	const isExtensionRegistered =
		extensions && Array.isArray(extensions)
			? extensions.includes(wayfinderExtensionAddress)
			: false;

	// Simulate the registration to catch errors
	const { error: simulateError } = useSimulateContract({
		abi: coreAbi,
		address: creator,
		functionName: "registerExtension",
		args: [wayfinderExtensionAddress, baseURI],
		query: { enabled: !!creator && !isExtensionRegistered },
	});

	const handleRegister = () => {
		writeContract({
			abi: coreAbi,
			address: creator,
			functionName: "registerExtension",
			args: [wayfinderExtensionAddress, baseURI],
		});
	};

	// Call onSuccess callback when transaction is successful
	useEffect(() => {
		if (isSuccess && onSuccess) {
			onSuccess();
		}
	}, [isSuccess, onSuccess]);

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
					✓ Wayfinder extension registered successfully!
				</p>
			</div>
		);
	}

	// Show already registered status
	if (isExtensionRegistered) {
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
					✓ Wayfinder extension is already registered
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
					1. Register Wayfinder Extension
				</h4>
				<p
					className={`
						text-sm
						${isDarkMode ? "text-text-secondary-dark" : "text-text-secondary-light"}
					`}
				>
					This allows Wayfinder to work with your Manifold collection
				</p>
			</div>

			<button
				onClick={handleRegister}
				className={`
					w-full px-6 py-3 rounded-lg font-semibold
					transition-all duration-200
					${
						isPending || isConfirming || !creator || isExtensionRegistered || !!simulateError
							? "opacity-50 cursor-not-allowed bg-surface-hover-light dark:bg-surface-hover-dark text-text-tertiary-light dark:text-text-tertiary-dark"
							: "bg-primary hover:bg-primary-hover dark:bg-primary-dark dark:hover:bg-primary-dark-hover text-white shadow-soft hover:shadow-medium"
					}
				`}
				disabled={
					isPending ||
					isConfirming ||
					!creator ||
					isExtensionRegistered ||
					!!simulateError
				}
			>
				{isPending || isConfirming ? (
					<span className="flex items-center justify-center gap-2">
						<RefreshCw className="w-4 h-4 animate-spin" />
						{isPending ? "Registering..." : "Confirming..."}
					</span>
				) : isExtensionRegistered ? (
					"✓ Already Registered"
				) : (
					"Register Extension"
				)}
			</button>

			{simulateError && (
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
						Transaction will fail: {simulateError.message}
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
