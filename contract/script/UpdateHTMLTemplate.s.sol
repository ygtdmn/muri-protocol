// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27 <0.9.0;

import { Script, console2 as console } from "forge-std/Script.sol";
import { LibString } from "solady/utils/LibString.sol";
import { MURIProtocol } from "../src/MURIProtocol.sol";

/// @notice Splits a template into parts that each fit in one SSTORE2 contract
library TemplateParts {
    /// @dev SSTORE2 stores data as contract code with a leading STOP byte, so a part can hold at most
    /// 24,575 bytes; 24,000 leaves some margin
    uint256 internal constant MAX_PART_SIZE = 24_000;

    /// @dev Parts are concatenated on read, so the split points don't matter as long as no multi-byte
    /// character is cut in half. Requiring ASCII rules that out.
    function split(string memory template, uint256 maxPartSize) internal pure returns (string[] memory parts) {
        uint256 length = bytes(template).length;
        require(length > 0, "Template is empty");
        require(LibString.is7BitASCII(template), "Template must be ASCII");

        parts = new string[]((length + maxPartSize - 1) / maxPartSize);
        for (uint256 i = 0; i < parts.length; i++) {
            parts[i] = LibString.slice(template, i * maxPartSize, (i + 1) * maxPartSize);
        }
    }
}

/// @notice Replaces the default HTML template with html-template/minified.html.
/// @dev Signs with whatever wallet forge is given (--account, --ledger, --private-key), not $PRIVATE_KEY,
/// so the owner key never has to sit in .env. Checks ownership first and reads the template back after.
contract UpdateHTMLTemplate is Script {
    MURIProtocol constant MURI = MURIProtocol(0x0000000000C2A0B63ab4aA971B08B905E5875b01);

    function run() public {
        string memory htmlTemplate = vm.readFile("html-template/minified.html");
        require(MURI.owner() == msg.sender, "Signer is not the MURIProtocol owner; pass --sender and a matching wallet");

        if (keccak256(bytes(MURI.getDefaultHtmlTemplate())) == keccak256(bytes(htmlTemplate))) {
            console.log("Template already up to date on chain", block.chainid);
            return;
        }

        string[] memory templateParts = TemplateParts.split(htmlTemplate, TemplateParts.MAX_PART_SIZE);

        vm.startBroadcast();
        MURI.setDefaultHtmlTemplate(templateParts, false);
        vm.stopBroadcast();

        require(
            keccak256(bytes(MURI.getDefaultHtmlTemplate())) == keccak256(bytes(htmlTemplate)),
            "Template read back from the contract does not match"
        );
        console.log("Template updated on chain", block.chainid, bytes(htmlTemplate).length);
        console.log("Parts:", templateParts.length);
    }
}
