// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27 <0.9.0;

import { BaseScript } from "./Base.s.sol";
import { MURIProtocol } from "../src/MURIProtocol.sol";
import { ICreateX } from "./interfaces/ICreateX.sol";
import { MURIProtocolManifoldExtension } from "../src/MURIProtocolManifoldExtension.sol";

contract Deploy is BaseScript {
    ICreateX constant CREATEX_FACTORY = ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);

    function run() public broadcast returns (MURIProtocol muriProtocol, MURIProtocolManifoldExtension extension) {
        // Read minified HTML template
        string memory htmlTemplate = vm.readFile("html-template/minified.html");

        // Generate deterministic salts for each contract
        bytes32 muriSalt = 0x8bff22fae026dc021e2573000000000000000000000000000000000000000000;
        bytes32 extensionSalt = 0x16a3b43ce973fb01c4baf0000000000000000000000000000000000000000000;

        // Deploy MURIProtocol via CREATE2 for deterministic deployment
        bytes memory muriCreationCode =
            abi.encodePacked(type(MURIProtocol).creationCode, abi.encode(htmlTemplate, false, broadcaster));
        muriProtocol = MURIProtocol(CREATEX_FACTORY.deployCreate2(muriSalt, muriCreationCode));

        // Deploy MURIProtocolManifoldExtension via CREATE2 for deterministic deployment
        bytes memory extensionCreationCode = abi.encodePacked(
            type(MURIProtocolManifoldExtension).creationCode, abi.encode(address(muriProtocol), broadcaster)
        );
        extension = MURIProtocolManifoldExtension(CREATEX_FACTORY.deployCreate2(extensionSalt, extensionCreationCode));

        // Configure the extension
        extension.setMURIProtocol(address(muriProtocol));
    }
}
