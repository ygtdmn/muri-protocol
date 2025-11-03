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

  // Remove JavaScript comments (single line)
  minified = minified.replace(/\/\/.*$/gm, "");

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

function escapeForSolidity(str) {
  // Escape backslashes first
  str = str.replace(/\\/g, "\\\\");

  // Escape double quotes
  str = str.replace(/"/g, '\\"');

  // Escape newlines (though we shouldn't have any after minification)
  str = str.replace(/\n/g, "\\n");

  // Escape carriage returns
  str = str.replace(/\r/g, "\\r");

  // Escape tabs
  str = str.replace(/\t/g, "\\t");

  return str;
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
  html-template/minified.html - Escaped, single-line minified HTML

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

    // Escape for Solidity
    const escapedHTML = escapeForSolidity(minifiedHTML);

    // Save minified and escaped HTML as one-liner
    const outputFile = "minified.html";
    const outputPath = path.join(__dirname, outputFile);
    fs.writeFileSync(outputPath, escapedHTML, "utf8");
    console.log(`💾 Minified and escaped HTML saved to: html-template/${outputFile}`);
    console.log(`📏 Original length: ${minifiedHTML.length.toLocaleString()} characters`);
    console.log(`📏 Escaped length: ${escapedHTML.length.toLocaleString()} characters`);

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
      console.log(`   1. Copy the contents of html-template/minified.html`);
      console.log(`   2. Paste into your Solidity contract as a string constant`);
      console.log(`   3. Use string replacement for template variables:`);
      console.log(`      - {{FILE_URIS}}`);
      console.log(`      - {{FILE_HASH}}`);
    }

    console.log("✅ Minification complete!");
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Open html-template/minified.html`);
    console.log(`   2. Copy the entire content (it's a single line)`);
    console.log(`   3. Use it in your Solidity contract`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
