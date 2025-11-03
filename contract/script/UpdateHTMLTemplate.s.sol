// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27 <0.9.0;

import { BaseScript } from "./Base.s.sol";
import { MURIProtocol } from "../src/MURIProtocol.sol";
import { MURIProtocolManifoldExtension } from "../src/MURIProtocolManifoldExtension.sol";

contract UpdateHTMLTemplate is BaseScript {
    function run() public broadcast {
        // Read minified HTML template
        string memory htmlTemplate = vm.readFile("html-template/minified.html");
        MURIProtocol muriProtocol = MURIProtocol(0x42d7C2B7dF3EFfb6B2c9a22F9791b09F72C66d45);

        string[] memory templateParts = new string[](1);
        templateParts[0] = htmlTemplate;
        muriProtocol.setDefaultHtmlTemplate(templateParts, false);
    }
}
