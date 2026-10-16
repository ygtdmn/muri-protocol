#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const http = require("http");

// Configuration - Edit these values to test different scenarios
const config = {
  fileUris: [
    "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Embedded/Duck.gltf",
  ],
  fileHash: "0xb69c34f30ec2803a37c6546c890a202f4db618745a3fefa3e5ac360bff211931", // SHA256 of test file
};

// Read template (--minified uses the version stored on chain)
function loadTemplate() {
  const file = process.argv.includes("--minified") ? "minified.html" : "template.html";
  return fs.readFileSync(path.join(__dirname, file), "utf8");
}

// Replace placeholders the way MURIProtocol.renderRawHTML does: every occurrence, URIs first, then the
// hash. The URI list is each URI in double quotes joined with commas, with no escaping.
// split/join rather than String.replace, which would treat `$&` etc. in a URI as patterns.
function fillTemplate(template, config) {
  const uriList = config.fileUris.map((uri) => `"${uri}"`).join(",");
  return template.split("{{FILE_URIS}}").join(uriList).split("{{FILE_HASH}}").join(config.fileHash);
}

// Create test server
function createServer(filledTemplate) {
  const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(filledTemplate);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  const port = 3000;
  server.listen(port, () => {
    console.log(`🚀 Test server running at http://localhost:${port}`);
    console.log(`🖼️  Testing ${config.fileUris.length} media URIs`);
    console.log(`🔒 Expected hash: ${config.fileHash}`);
    console.log("\n💡 Press Ctrl+C to stop the server");
  });

  return server;
}

// Save to file option
function saveToFile(filledTemplate, filename = "test-output.html") {
  const outputPath = path.resolve(__dirname, filename);
  fs.writeFileSync(outputPath, filledTemplate, "utf8");
  console.log(`💾 Template saved to: ${outputPath}`);
  console.log("📂 Open this file in your browser to test");
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  try {
    const template = loadTemplate();
    const filledTemplate = fillTemplate(template, config);

    if (args.includes("--save") || args.includes("-s")) {
      // Save to file
      const filename = args.find((arg) => arg.startsWith("--file="))?.split("=")[1] || "test-output.html";
      saveToFile(filledTemplate, filename);
    } else {
      // Start server (default)
      const server = createServer(filledTemplate);

      // Graceful shutdown
      process.on("SIGINT", () => {
        console.log("\n👋 Shutting down test server...");
        server.close();
        process.exit(0);
      });
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// CLI help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
🎨 MURI Protocol HTML Template Tester

Usage:
  pnpm test:template              # Start local server (default)
  pnpm test:template --save       # Save filled template to file
  pnpm test:template --save --file=custom.html  # Save with custom filename
  pnpm test:template --minified   # Use minified.html (what is stored on chain) instead of template.html

Configuration:
  Edit the 'config' object in this file to change test parameters:
  - fileUris: Array of media URLs to test
  - fileHash: Expected SHA256 hash (0x prefix optional)

Examples:
  pnpm test:template
  pnpm test:template --save --file=my-test.html
`);
  process.exit(0);
}

main();
