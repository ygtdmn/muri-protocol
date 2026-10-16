// SPDX-License-Identifier: MIT
pragma solidity >=0.8.30 <0.9.0;

import { Test } from "forge-std/Test.sol";
import { LibString } from "solady/utils/LibString.sol";
import { MURIProtocol } from "src/MURIProtocol.sol";
import { IMURIProtocol } from "src/interfaces/IMURIProtocol.sol";
import { MockAdminControl } from "test/mocks/MockAdminControl.sol";
import { MockMURIProtocolExtension } from "test/mocks/MockMURIProtocolExtension.sol";
import { TemplateParts } from "script/UpdateHTMLTemplate.s.sol";

/// @notice Renders tokens with html-template/minified.html as the default template, stored in several
/// SSTORE2 chunks the way UpdateHTMLTemplate stores a template too big for one.
contract DefaultTemplateTest is Test {
    address owner = address(0x01);
    address artist = address(0x02);
    address collector = address(0x03);
    uint256 constant TOKEN_ID = 1;
    uint256 constant SIMPLE_TOKEN_ID = 2;
    uint16 constant COLLECTOR_ADD_REMOVE = 2 ** 8;

    string constant DATA_TAG = '<plaintext hidden id="muri-data">';
    string constant HASH = "0x9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2";
    string constant ARTIST_URI_1 = "ipfs://bafybeidkvmhsidcrkq45bncf2lfyiesszy4d3cbgsargqcyvss5hmmkzhy/three.min.js";
    string constant ARTIST_URI_2 = "ar://OZFWATgVxm_xRAxj-pC9RUwJjCC0zdVyBB6cDZMa21Q";
    // Collector URIs trying to break out of the data section
    string constant PAYLOAD_1 = '",globalThis.PWNED=1,"';
    string constant PAYLOAD_2 = "</script><script>globalThis.PWNED=1</script>";
    string constant PAYLOAD_3 = "</plaintext><script>globalThis.PWNED=1</script>";
    string constant PAYLOAD_4 = "<img src=x onerror=globalThis.PWNED=1>";

    MURIProtocol muri;
    MockAdminControl creator;
    MockMURIProtocolExtension operator;
    string template;
    uint256 partCount;

    function setUp() public {
        template = vm.readFile("html-template/minified.html");

        vm.startPrank(owner);
        muri = new MURIProtocol(vm.readFile("html-template/deployed-constructor.html"), false, owner);
        string[] memory parts = TemplateParts.split(template, 5000);
        partCount = parts.length;
        muri.setDefaultHtmlTemplate(parts, false);

        creator = new MockAdminControl();
        creator.approveAdmin(artist);
        operator = new MockMURIProtocolExtension(address(muri), owner);
        operator.setAdmin(artist, true);
        operator.setTokenOwner(address(creator), collector, TOKEN_ID, true);
        vm.stopPrank();

        vm.prank(artist);
        muri.registerContract(address(creator), address(operator));

        string[] memory artistUris = new string[](2);
        artistUris[0] = ARTIST_URI_1;
        artistUris[1] = ARTIST_URI_2;
        _initToken(TOKEN_ID, artistUris);

        string[] memory collectorUris = new string[](4);
        collectorUris[0] = PAYLOAD_1;
        collectorUris[1] = PAYLOAD_2;
        collectorUris[2] = PAYLOAD_3;
        collectorUris[3] = PAYLOAD_4;
        vm.prank(collector);
        muri.addArtworkUris(address(creator), TOKEN_ID, collectorUris);

        string[] memory simpleUris = new string[](1);
        simpleUris[0] = ARTIST_URI_1;
        _initToken(SIMPLE_TOKEN_ID, simpleUris);
    }

    function _initToken(uint256 tokenId, string[] memory artistUris) internal {
        IMURIProtocol.InitConfig memory config;
        config.metadata = '"name":"Template test"';
        config.displayMode = IMURIProtocol.DisplayMode.HTML;
        config.artwork.artistUris = artistUris;
        config.artwork.mimeType = "text/javascript";
        config.artwork.fileHash = HASH;
        config.permissions.flags = COLLECTOR_ADD_REMOVE;
        config.thumbnail.kind = IMURIProtocol.ThumbnailKind.OFF_CHAIN;
        config.thumbnail.offChain.uris = new string[](1);
        config.thumbnail.offChain.uris[0] = "https://thumbnail";

        vm.prank(artist);
        operator.initializeTokenData(address(creator), tokenId, config, new bytes[](0), new string[](0));
    }

    function test_defaultTemplate_storedInSeveralChunks() public view {
        assertGt(partCount, 1, "template should span several chunks");
        assertEq(muri.getDefaultHtmlTemplate(), template);
    }

    function test_renderRawHTML_fillsDataSection() public {
        string memory html = muri.renderRawHTML(address(creator), TOKEN_ID);
        emit log_string(html);

        assertEq(LibString.indexOf(html, "{{FILE_URIS}}"), LibString.NOT_FOUND, "FILE_URIS replaced");
        assertEq(LibString.indexOf(html, "{{FILE_HASH}}"), LibString.NOT_FOUND, "FILE_HASH replaced");

        // The page up to the data section is the template unchanged, and the data section is the only
        // <plaintext and comes last, holding the hash, a newline and every URI (artist's, then collectors')
        uint256 dataStart = LibString.indexOf(html, "<plaintext");
        assertEq(dataStart, LibString.indexOf(template, DATA_TAG), "data section position");
        assertEq(LibString.slice(html, 0, dataStart), LibString.slice(template, 0, dataStart), "page unchanged");
        assertEq(
            LibString.slice(html, dataStart),
            string.concat(
                DATA_TAG,
                HASH,
                "\n",
                string.concat('"', ARTIST_URI_1, '","', ARTIST_URI_2, '",'),
                string.concat('"', PAYLOAD_1, '","', PAYLOAD_2, '","', PAYLOAD_3, '","', PAYLOAD_4, '"')
            ),
            "data section"
        );
        assertTrue(LibString.endsWith(html, string.concat(PAYLOAD_4, '"')), "nothing after the URIs");
    }

    function test_renderHTML_isBase64DataUri() public view {
        string memory uri = muri.renderHTML(address(creator), SIMPLE_TOKEN_ID);
        assertTrue(LibString.startsWith(uri, "data:text/html;charset=UTF-8;base64,"));
    }

    /// @dev Gas of rendering a token with one URI. On chain the template fits in a single chunk.
    function test_renderRawHTML_gas() public {
        vm.prank(owner);
        muri.setDefaultHtmlTemplate(TemplateParts.split(template, TemplateParts.MAX_PART_SIZE), false);

        uint256 gasBefore = gasleft();
        muri.renderRawHTML(address(creator), SIMPLE_TOKEN_ID);
        uint256 rawGas = gasBefore - gasleft();

        gasBefore = gasleft();
        muri.renderHTML(address(creator), SIMPLE_TOKEN_ID);
        uint256 dataUriGas = gasBefore - gasleft();

        emit log_named_uint("template bytes", bytes(template).length);
        emit log_named_uint("renderRawHTML gas", rawGas);
        emit log_named_uint("renderHTML gas", dataUriGas);
    }
}
