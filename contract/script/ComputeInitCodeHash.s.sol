// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27 <0.9.0;

import { BaseScript } from "./Base.s.sol";
import { MURIProtocol } from "../src/MURIProtocol.sol";
import { MURIProtocolManifoldExtension } from "../src/MURIProtocolManifoldExtension.sol";
import { console } from "forge-std/console.sol";

/**
 * @title ComputeInitCodeHash
 * @notice Compute the initCodeHash for contracts before running vanity search
 * @dev Required for CREATE2 vanity search since address depends on initCode
 *
 * Usage:
 *   forge script script/ComputeInitCodeHash.s.sol --sig "muriProtocol()"
 *   forge script script/ComputeInitCodeHash.s.sol --sig "extension(address)"  0x...
 */
contract ComputeInitCodeHash is BaseScript {
    /// @notice Compute initCodeHash for MURIProtocol
    /// @dev Uses the actual HTML template and broadcaster from environment
    function muriProtocol() public view returns (bytes32 initCodeHash) {
        string memory htmlTemplate = vm.readFile("html-template/minified.html");

        bytes memory creationCode = type(MURIProtocol).creationCode;
        bytes memory constructorArgs = abi.encode(htmlTemplate, false, broadcaster);
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);
        initCodeHash = keccak256(initCode);

        console.log("initCodeHash: %s", vm.toString(initCodeHash));
        console.log(
            "To search: ./target/release/createxcrunch create2 --leading 5 --code-hash %s", vm.toString(initCodeHash)
        );
    }

    /// @notice Compute initCodeHash for MURIProtocolManifoldExtension
    /// @param muriProtocolAddress The address of the deployed MURIProtocol contract
    function extension(address muriProtocolAddress) public view returns (bytes32 initCodeHash) {
        bytes memory creationCode = type(MURIProtocolManifoldExtension).creationCode;
        bytes memory constructorArgs = abi.encode(muriProtocolAddress, broadcaster);
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);
        initCodeHash = keccak256(initCode);
        console.log("initCodeHash: %s", vm.toString(initCodeHash));
        console.log(
            "To search: ./target/release/createxcrunch create2 --matching 0ffc4a190XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX --code-hash %s",
            vm.toString(initCodeHash)
        );
    }
}

