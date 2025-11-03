#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const http = require("http");

// Configuration - Edit these values to test different scenarios
const config = {
  fileUris: [
    "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Embedded/Duck.gltf",
  ],
  fileHash: "b69c34f30ec2803a37c6546c890a202f4db618745a3fefa3e5ac360bff211931", // SHA256 of test file
};

// Read template
function loadTemplate() {
  const templatePath = path.join(__dirname, "template.html");
  return fs.readFileSync(templatePath, "utf8");
}

// Replace placeholders
function fillTemplate(template, config) {
  return template
    .replace(/\{\{FILE_URIS\}\}/g, config.fileUris.map((uri) => `"${uri}"`).join(", "))
    .replace(/\{\{FILE_HASH\}\}/g, config.fileHash);
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
  const outputPath = path.join(__dirname, filename);
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

Configuration:
  Edit the 'config' object in this file to change test parameters:
  - fileUris: Array of media URLs to test
  - fileHash: Expected SHA256 hash (without 0x prefix)

Examples:
  pnpm test:template
  pnpm test:template --save --file=my-test.html
`);
  process.exit(0);
}

main();
