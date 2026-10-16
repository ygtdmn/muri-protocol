// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27 <0.9.0;

import { DeploymentParams } from "./DeploymentParams.sol";
import { console } from "forge-std/console.sol";

/**
 * @title ComputeInitCodeHash
 * @notice Compute the initCodeHash for contracts before running vanity search, and check that the pinned
 * deployment inputs still reproduce the deployed addresses
 * @dev Required for CREATE2 vanity search since address depends on initCode
 *
 * Usage:
 *   forge script script/ComputeInitCodeHash.s.sol                          # check both addresses
 *   forge script script/ComputeInitCodeHash.s.sol --sig "muriProtocol()"
 *   forge script script/ComputeInitCodeHash.s.sol --sig "extension(address)"  0x...
 */
contract ComputeInitCodeHash is DeploymentParams {
    /// @notice Check that the pinned constructor arguments and salts give the deployed addresses
    function run() public view {
        address muri = _createXAddress(MURI_SALT, _muriInitCode());
        address extensionAddress = _createXAddress(EXTENSION_SALT, _extensionInitCode(MURI_ADDRESS));
        console.log("MURIProtocol:", muri);
        console.log("Extension:   ", extensionAddress);
        require(muri == MURI_ADDRESS, "MURIProtocol address does not match the deployment");
        require(extensionAddress == EXTENSION_ADDRESS, "Extension address does not match the deployment");
        console.log("Both addresses match the deployment");
    }

    /// @notice Compute initCodeHash for MURIProtocol
    /// @dev Uses the pinned constructor template and OWNER
    function muriProtocol() public view returns (bytes32 initCodeHash) {
        initCodeHash = keccak256(_muriInitCode());

        console.log("initCodeHash: %s", vm.toString(initCodeHash));
        console.log(
            "To search: ./target/release/createxcrunch create2 --leading 5 --code-hash %s", vm.toString(initCodeHash)
        );
    }

    /// @notice Compute initCodeHash for MURIProtocolManifoldExtension
    /// @param muriProtocolAddress The address of the deployed MURIProtocol contract
    function extension(address muriProtocolAddress) public view returns (bytes32 initCodeHash) {
        initCodeHash = keccak256(_extensionInitCode(muriProtocolAddress));
        console.log("initCodeHash: %s", vm.toString(initCodeHash));
        console.log(
            "To search: ./target/release/createxcrunch create2 --matching 0ffc4a190XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX --code-hash %s",
            vm.toString(initCodeHash)
        );
    }
}
