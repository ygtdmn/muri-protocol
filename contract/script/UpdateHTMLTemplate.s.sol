// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27 <0.9.0;

import { BaseScript } from "./Base.s.sol";
import { MURIProtocol } from "../src/MURIProtocol.sol";

contract UpdateHTMLTemplate is BaseScript {
  function run() public broadcast {
    // Read minified HTML template
    string memory htmlTemplate = vm.readFile("html-template/minified.html");
    MURIProtocol muriProtocol = MURIProtocol(0x0000000000C2A0B63ab4aA971B08B905E5875b01);

    string[] memory templateParts = new string[](1);
    templateParts[0] = htmlTemplate;
    muriProtocol.setDefaultHtmlTemplate(templateParts, false);
  }
}
