#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * HTML Template Minifier for Solidity Smart Contracts
 *
 * This script minifies the HTML template to fit into a Solidity string literal
 * by removing whitespace, comments, and optimizing the code structure.
 */

function minifyHTML(html) {
  let minified = html;

  // Remove HTML comments
  minified = minified.replace(/<!--[\s\S]*?-->/g, "");

  // Remove JavaScript comments (single line) - BUT preserve URLs
  // Don't remove // if it's preceded by : or " (likely a URL)
  minified = minified.replace(/(?<!:)(?<!")\/\/(?!\/)[^\n]*/gm, "");

  // Remove JavaScript comments (multi-line) - be careful with regex literals
  minified = minified.replace(/\/\*[\s\S]*?\*\//g, "");

  // Remove unnecessary whitespace between tags
  minified = minified.replace(/>\s+</g, "><");

  // Remove leading/trailing whitespace from lines
  minified = minified.replace(/^\s+|\s+$/gm, "");

  // Remove empty lines
  minified = minified.replace(/\n\s*\n/g, "\n");

  // Compress CSS - remove spaces around CSS operators
  minified = minified.replace(/\s*{\s*/g, "{");
  minified = minified.replace(/\s*}\s*/g, "}");
  minified = minified.replace(/\s*:\s*/g, ":");
  minified = minified.replace(/\s*;\s*/g, ";");
  minified = minified.replace(/\s*,\s*/g, ",");

  // Compress JavaScript - remove spaces around operators (careful with strings)
  minified = minified.replace(/\s*=\s*/g, "=");
  minified = minified.replace(/\s*\+\s*/g, "+");
  minified = minified.replace(/\s*-\s*/g, "-");
  minified = minified.replace(/\s*\*\s*/g, "*");
  minified = minified.replace(/\s*\/\s*/g, "/");
  minified = minified.replace(/\s*\(\s*/g, "(");
  minified = minified.replace(/\s*\)\s*/g, ")");
  minified = minified.replace(/\s*\[\s*/g, "[");
  minified = minified.replace(/\s*\]\s*/g, "]");

  // Remove extra spaces
  minified = minified.replace(/\s{2,}/g, " ");

  // Remove newlines and make it a single line
  minified = minified.replace(/\n/g, "");

  // Final cleanup - remove any remaining extra spaces
  minified = minified.trim();

  return minified;
}


function generateStats(original, minified) {
  const originalSize = original.length;
  const minifiedSize = minified.length;
  const savings = originalSize - minifiedSize;
  const percentage = ((savings / originalSize) * 100).toFixed(2);

  return {
    originalSize,
    minifiedSize,
    savings,
    percentage,
  };
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🗜️  MURI Protocol HTML Template Minifier

Usage:
  pnpm minify                 # Minify template to one-liner
  pnpm minify --stats         # Show detailed statistics

Description:
  Minifies template.html into a single-line string saved to minified.html
  This one-liner can be copied directly into your Solidity contract.

Options:
  --stats         Show detailed compression statistics
  --help, -h      Show this help message

Output:
  html-template/minified.html - Single-line minified HTML

Template Variables (for Solidity):
  {{FILE_URIS}}     - Comma-separated quoted URIs
  {{FILE_HASH}}     - SHA256 hash (without 0x prefix)

Examples:
  pnpm minify
  pnpm minify --stats
`);
    process.exit(0);
  }

  try {
    // Read the template file
    const templatePath = path.join(__dirname, "template.html");
    const originalHTML = fs.readFileSync(templatePath, "utf8");

    console.log("🗜️  Minifying HTML template...");

    // Minify the HTML
    const minifiedHTML = minifyHTML(originalHTML);

    // Generate statistics
    const stats = generateStats(originalHTML, minifiedHTML);

    console.log(`📊 Compression Statistics:`);
    console.log(`   Original size: ${stats.originalSize.toLocaleString()} characters`);
    console.log(`   Minified size: ${stats.minifiedSize.toLocaleString()} characters`);
    console.log(`   Space saved: ${stats.savings.toLocaleString()} characters (${stats.percentage}%)`);

    // Save minified HTML as one-liner
    const outputFile = "minified.html";
    const outputPath = path.join(__dirname, outputFile);
    fs.writeFileSync(outputPath, minifiedHTML, "utf8");
    console.log(`💾 Minified HTML saved to: html-template/${outputFile}`);
    console.log(`📏 Length: ${minifiedHTML.length.toLocaleString()} characters`);

    if (args.includes("--stats")) {
      console.log(`\n📈 Detailed Statistics:`);
      console.log(`   Template supports: Images, Videos, Audio, 3D Models, HTML, JSON, Text`);
      console.log(`   Three.js integration: Yes (hardcoded, dynamically loaded)`);
      console.log(`   Hash verification: SHA256`);
      console.log(`   Cross-browser compatible: Yes`);
      console.log(`   Mobile responsive: Yes`);

      // Estimate gas cost (rough approximation)
      const gasPerByte = 16; // Approximate gas cost per byte for contract storage
      const estimatedGas = stats.minifiedSize * gasPerByte;
      console.log(`   Estimated deployment gas: ~${estimatedGas.toLocaleString()} gas`);

      // Show how to use in Solidity
      console.log(`\n💡 Usage in Solidity:`);
      console.log(`   Use vm.readFile to read the template in your deployment scripts:`);
      console.log(`   string memory htmlTemplate = vm.readFile("html-template/minified.html");`);
      console.log(`   `);
      console.log(`   Template variables to replace:`);
      console.log(`      - {{FILE_URIS}}`);
      console.log(`      - {{FILE_HASH}}`);
    }

    console.log("✅ Minification complete!");
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Use vm.readFile("html-template/minified.html") in your deployment script`);
    console.log(`   2. Deploy with: forge script script/Deploy.s.sol --broadcast`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
