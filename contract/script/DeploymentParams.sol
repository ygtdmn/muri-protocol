// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27 <0.9.0;

import { Script } from "forge-std/Script.sol";
import { MURIProtocol } from "../src/MURIProtocol.sol";
import { MURIProtocolManifoldExtension } from "../src/MURIProtocolManifoldExtension.sol";
import { ICreateX } from "./interfaces/ICreateX.sol";

/// @notice Inputs of the original CREATE2 deployment on Ethereum, Base and Sepolia.
/// @dev The deployed addresses depend on the init code, which includes the constructor arguments, so every
/// input is pinned here instead of being read from the current template or the environment. Changing any of
/// them (or the contracts' bytecode) changes the addresses. The live default template is replaced after
/// deployment with UpdateHTMLTemplate, so html-template/minified.html is free to change.
abstract contract DeploymentParams is Script {
    ICreateX internal constant CREATEX = ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);

    /// @dev Owner given to both constructors
    address internal constant OWNER = 0x28996f7DECe7E058EBfC56dFa9371825fBfa515A;

    /// @dev Byte-exact template given to the MURIProtocol constructor, recovered from the deployment calldata
    string internal constant CONSTRUCTOR_TEMPLATE_PATH = "html-template/deployed-constructor.html";

    bytes32 internal constant MURI_SALT = 0x8bff22fae026dc021e2573000000000000000000000000000000000000000000;
    bytes32 internal constant EXTENSION_SALT = 0x16a3b43ce973fb01c4baf0000000000000000000000000000000000000000000;

    address internal constant MURI_ADDRESS = 0x0000000000C2A0B63ab4aA971B08B905E5875b01;
    address internal constant EXTENSION_ADDRESS = 0x0FFc4A1906157248ae64F28fD259bB7a2790606C;

    function _muriInitCode() internal view returns (bytes memory) {
        string memory constructorTemplate = vm.readFile(CONSTRUCTOR_TEMPLATE_PATH);
        return abi.encodePacked(type(MURIProtocol).creationCode, abi.encode(constructorTemplate, false, OWNER));
    }

    function _extensionInitCode(address muriProtocol) internal pure returns (bytes memory) {
        return abi.encodePacked(type(MURIProtocolManifoldExtension).creationCode, abi.encode(muriProtocol, OWNER));
    }

    /// @dev Address CreateX's deployCreate2(salt, initCode) deploys to. Both salts start with 20 bytes that are
    /// neither the caller nor zero, so CreateX._guard uses keccak256(abi.encode(salt)) as the CREATE2 salt.
    function _createXAddress(bytes32 salt, bytes memory initCode) internal pure returns (address) {
        require(
            bytes20(salt) != bytes20(0) && bytes20(salt) != bytes20(OWNER), "Salt kind not handled by _createXAddress"
        );
        return vm.computeCreate2Address(keccak256(abi.encode(salt)), keccak256(initCode), address(CREATEX));
    }
}
