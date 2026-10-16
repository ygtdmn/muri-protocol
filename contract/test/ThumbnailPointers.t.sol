// SPDX-License-Identifier: MIT
pragma solidity >=0.8.30 <0.9.0;

import { Test } from "forge-std/Test.sol";
import { Base64 } from "solady/utils/Base64.sol";
import { LibZip } from "solady/utils/LibZip.sol";
import { SSTORE2 } from "solady/utils/SSTORE2.sol";
import { MURIProtocol } from "src/MURIProtocol.sol";
import { IMURIProtocol } from "src/interfaces/IMURIProtocol.sol";
import { MockAdminControl } from "test/mocks/MockAdminControl.sol";
import { MockMURIProtocolExtension } from "test/mocks/MockMURIProtocolExtension.sol";

/// @notice updateThumbnail stores thumbnailChunks with SSTORE2, then overwrites the chunk list with
/// thumbnail.onChain.chunks from calldata (`token.thumbnail = thumbnail`), so chunks passed the normal way
/// are lost. The deployed contract can't be changed, so the frontend works around it: it deploys its own
/// SSTORE2 pointer contracts and passes their addresses as thumbnail.onChain.chunks, with a 1-byte dummy
/// in thumbnailChunks to pass the length check. These tests check that this works.
contract ThumbnailPointersTest is Test {
    address owner = address(0x01);
    address artist = address(0x02);
    uint256 constant TOKEN_ID = 1;
    uint256 constant CHUNK_SIZE = 20_000;
    uint16 constant ARTIST_UPDATE_THUMB = 2 ** 0;

    MURIProtocol muri;
    MockAdminControl creator;
    MockMURIProtocolExtension operator;

    function setUp() public {
        vm.startPrank(owner);
        muri = new MURIProtocol("<html></html>", false, owner);
        creator = new MockAdminControl();
        creator.approveAdmin(artist);
        operator = new MockMURIProtocolExtension(address(muri), owner);
        operator.setAdmin(artist, true);
        vm.stopPrank();

        vm.prank(artist);
        muri.registerContract(address(creator), address(operator));

        IMURIProtocol.InitConfig memory config;
        config.metadata = '"name":"Thumbnail test"';
        config.artwork.artistUris = new string[](1);
        config.artwork.artistUris[0] = "ipfs://artwork";
        config.artwork.mimeType = "image/png";
        config.artwork.fileHash = "0x00";
        config.permissions.flags = ARTIST_UPDATE_THUMB;
        config.thumbnail.kind = IMURIProtocol.ThumbnailKind.OFF_CHAIN;
        config.thumbnail.offChain.uris = new string[](1);
        config.thumbnail.offChain.uris[0] = "https://thumbnail";

        vm.prank(artist);
        operator.initializeTokenData(address(creator), TOKEN_ID, config, new bytes[](0), new string[](0));
    }

    /*//////////////////////////////////////////////////////////////
                                HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @dev What the frontend does: a plain CREATE whose init code returns 0x00 ‖ data as the runtime code,
    /// the format SSTORE2.read expects. Init code: 0x61 ‖ uint16(len + 1) ‖ 0x80600a3d393df3 ‖ 0x00 ‖ data.
    function _deployPointer(bytes memory data) internal returns (address pointer) {
        bytes memory initCode = abi.encodePacked(hex"61", uint16(data.length + 1), hex"80600a3d393df3", hex"00", data);
        assembly {
            pointer := create(0, add(initCode, 0x20), mload(initCode))
        }
        require(pointer != address(0), "pointer deployment failed");
        assertEq(pointer.code, abi.encodePacked(hex"00", data), "pointer runtime code");
        assertEq(SSTORE2.read(pointer), data, "SSTORE2.read of pointer");
    }

    /// @dev Compress, split into chunks of at most CHUNK_SIZE bytes and deploy one pointer per chunk
    function _deployCompressed(bytes memory original) internal returns (address[] memory pointers) {
        bytes memory compressed = LibZip.flzCompress(original);
        pointers = new address[]((compressed.length + CHUNK_SIZE - 1) / CHUNK_SIZE);
        for (uint256 i = 0; i < pointers.length; i++) {
            uint256 start = i * CHUNK_SIZE;
            uint256 end = start + CHUNK_SIZE < compressed.length ? start + CHUNK_SIZE : compressed.length;
            bytes memory chunk = new bytes(end - start);
            for (uint256 j = 0; j < chunk.length; j++) {
                chunk[j] = compressed[start + j];
            }
            pointers[i] = _deployPointer(chunk);
        }
    }

    function _updateWithPointers(address[] memory pointers, string memory mimeType) internal {
        IMURIProtocol.Thumbnail memory thumbnail;
        thumbnail.kind = IMURIProtocol.ThumbnailKind.ON_CHAIN;
        thumbnail.onChain = IMURIProtocol.OnChainThumbnail({ mimeType: mimeType, chunks: pointers, zipped: true });

        bytes[] memory dummy = new bytes[](1);
        dummy[0] = hex"00";

        vm.prank(artist);
        muri.updateThumbnail(address(creator), TOKEN_ID, thumbnail, dummy);
    }

    /// @dev Image-like test data: a PNG signature, incompressible noise and some repetitive runs
    function _testImage(uint256 noiseBytes, uint256 repeatedBytes, uint256 seed) internal pure returns (bytes memory) {
        bytes memory noise = new bytes(noiseBytes);
        for (uint256 i = 0; i < noiseBytes; i += 32) {
            bytes32 word = keccak256(abi.encode(seed, i));
            for (uint256 j = 0; j < 32 && i + j < noiseBytes; j++) {
                noise[i + j] = word[j];
            }
        }
        bytes memory repeated = new bytes(repeatedBytes);
        for (uint256 i = 0; i < repeatedBytes; i++) {
            repeated[i] = bytes1(uint8((i / 64) % 7));
        }
        return abi.encodePacked(hex"89504e470d0a1a0a", noise, repeated);
    }

    /*//////////////////////////////////////////////////////////////
                                 TESTS
    //////////////////////////////////////////////////////////////*/

    function test_updateThumbnail_withOwnPointers_multiChunk() public {
        bytes memory original = _testImage(45_000, 30_000, 1);
        address[] memory pointers = _deployCompressed(original);
        assertEq(pointers.length, 3, "compressed thumbnail should take 3 chunks");

        _updateWithPointers(pointers, "image/png");

        assertEq(muri.renderRawImage(address(creator), TOKEN_ID), original, "renderRawImage");
        assertEq(
            muri.renderImage(address(creator), TOKEN_ID),
            string.concat("data:image/png;base64,", Base64.encode(original)),
            "renderImage"
        );
        (IMURIProtocol.ThumbnailKind kind,) = muri.getThumbnailInfo(address(creator), TOKEN_ID);
        assertEq(uint8(kind), uint8(IMURIProtocol.ThumbnailKind.ON_CHAIN));
    }

    function test_updateThumbnail_withOwnPointers_twice() public {
        bytes memory first = _testImage(45_000, 30_000, 1);
        _updateWithPointers(_deployCompressed(first), "image/png");
        assertEq(muri.renderRawImage(address(creator), TOKEN_ID), first, "first update");

        // A second update replaces the whole chunk list, including the number of chunks
        bytes memory second = _testImage(52_000, 1000, 2);
        address[] memory pointers = _deployCompressed(second);
        assertEq(pointers.length, 3, "second thumbnail should take 3 chunks");
        _updateWithPointers(pointers, "image/webp");

        assertEq(muri.renderRawImage(address(creator), TOKEN_ID), second, "second update");
        assertEq(
            muri.renderImage(address(creator), TOKEN_ID),
            string.concat("data:image/webp;base64,", Base64.encode(second)),
            "renderImage after second update"
        );

        // And back to a single chunk
        bytes memory third = _testImage(5000, 5000, 3);
        pointers = _deployCompressed(third);
        assertEq(pointers.length, 1);
        _updateWithPointers(pointers, "image/png");
        assertEq(muri.renderRawImage(address(creator), TOKEN_ID), third, "third update");
    }

    /// @dev Documents the bug the workaround avoids: chunks passed in thumbnailChunks are written but the
    /// stored chunk list is replaced by the (empty) list from calldata
    function test_updateThumbnail_chunksPassedNormallyAreLost() public {
        bytes memory original = _testImage(1000, 1000, 4);
        bytes[] memory chunks = new bytes[](1);
        chunks[0] = LibZip.flzCompress(original);

        IMURIProtocol.Thumbnail memory thumbnail;
        thumbnail.kind = IMURIProtocol.ThumbnailKind.ON_CHAIN;
        thumbnail.onChain =
            IMURIProtocol.OnChainThumbnail({ mimeType: "image/png", chunks: new address[](0), zipped: true });

        vm.prank(artist);
        muri.updateThumbnail(address(creator), TOKEN_ID, thumbnail, chunks);

        assertEq(muri.renderRawImage(address(creator), TOKEN_ID).length, 0);
    }
}
