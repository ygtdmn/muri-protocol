// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27 <0.9.0;

import { console2 as console } from "forge-std/Script.sol";
import { DeploymentParams } from "./DeploymentParams.sol";
import { MURIProtocol } from "../src/MURIProtocol.sol";
import { MURIProtocolManifoldExtension } from "../src/MURIProtocolManifoldExtension.sol";

/// @notice Deploys MURIProtocol and MURIProtocolManifoldExtension with CreateX at the same addresses as on
/// Ethereum, Base and Sepolia. Contracts already present on the chain are skipped.
/// @dev Signs with whatever wallet forge is given (--account, --ledger, --private-key), which must be OWNER:
///   forge script script/Deploy.s.sol --rpc-url <chain> --sender 0x28996f7DECe7E058EBfC56dFa9371825fBfa515A \
///     --account <keystore> [--broadcast]
contract Deploy is DeploymentParams {
    function run() public returns (MURIProtocol muriProtocol, MURIProtocolManifoldExtension extension) {
        require(msg.sender == OWNER, "Signer is not OWNER; pass --sender and a matching wallet");

        bytes memory muriInitCode = _muriInitCode();
        bytes memory extensionInitCode = _extensionInitCode(MURI_ADDRESS);
        require(
            _createXAddress(MURI_SALT, muriInitCode) == MURI_ADDRESS,
            "MURIProtocol init code changed: it would not deploy to MURI_ADDRESS"
        );
        require(
            _createXAddress(EXTENSION_SALT, extensionInitCode) == EXTENSION_ADDRESS,
            "Extension init code changed: it would not deploy to EXTENSION_ADDRESS"
        );

        muriProtocol = MURIProtocol(MURI_ADDRESS);
        extension = MURIProtocolManifoldExtension(EXTENSION_ADDRESS);

        vm.startBroadcast();
        if (MURI_ADDRESS.code.length == 0) {
            require(CREATEX.deployCreate2(MURI_SALT, muriInitCode) == MURI_ADDRESS, "MURIProtocol address mismatch");
        } else {
            console.log("MURIProtocol already deployed on chain", block.chainid);
        }
        if (EXTENSION_ADDRESS.code.length == 0) {
            require(
                CREATEX.deployCreate2(EXTENSION_SALT, extensionInitCode) == EXTENSION_ADDRESS,
                "Extension address mismatch"
            );
            extension.setMURIProtocol(MURI_ADDRESS);
        } else {
            console.log("Extension already deployed on chain", block.chainid);
        }
        vm.stopBroadcast();
    }
}
