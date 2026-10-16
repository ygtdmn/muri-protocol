#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * HTML Template Minifier for the MURI Protocol default template.
 *
 * Every byte of the template costs gas each time tokenURI is read, so template.html is
 * minified into minified.html, which is what gets stored on chain. The minifier understands
 * just enough HTML, CSS and JavaScript to never touch string literals, regular expressions or
 * the token data section:
 *
 * - The `<plaintext ...>` element at the end of the template, with the {{FILE_HASH}} and
 *   {{FILE_URIS}} placeholders, is copied byte for byte (including the newline that separates
 *   the hash from the URIs). Nothing is appended after it.
 * - <script> bodies are tokenized: comments are dropped and whitespace is removed unless it
 *   separates two words or is needed for automatic semicolon insertion after return/throw/etc.
 * - <style> bodies lose comments and whitespace around punctuation (strings are kept).
 * - Markup loses comments and whitespace between tags.
 */

const DATA_SECTION = /<plaintext\b[^>]*>/gi;

function minifyCSS(css) {
  // Spaces around `:` would matter in a selector like `a :hover`; the template doesn't use that form
  const compact = (code) => code.replace(/\s+/g, " ").replace(/ ?([{}:;,>]) ?/g, "$1").replace(/;}/g, "}");
  let out = "";
  let code = "";
  for (let i = 0; i < css.length; ) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      if (end < 0) throw new Error("Unterminated CSS comment");
      code += " ";
      i = end + 2;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (css[j] !== c) {
        if (j >= css.length) throw new Error("Unterminated CSS string");
        j += css[j] === "\\" ? 2 : 1;
      }
      out += compact(code) + css.slice(i, j + 1);
      code = "";
      i = j + 1;
    } else {
      code += c;
      i++;
    }
  }
  return (out + compact(code)).trim();
}

const PUNCTUATORS = [
  ">>>=", "...", "===", "!==", "**=", "<<=", ">>=", ">>>", "&&=", "||=", "??=",
  "=>", "==", "!=", "<=", ">=", "&&", "||", "??", "?.", "++", "--", "+=", "-=", "*=", "/=", "%=",
  "&=", "|=", "^=", "<<", ">>", "**",
];
const KEYWORDS_BEFORE_EXPRESSION = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await",
]);
// A line break after these ends the statement (restricted productions), so it must be kept
const RESTRICTED = new Set(["return", "throw", "break", "continue", "yield"]);

/** Split JavaScript into tokens, keeping track of whether whitespace before a token had a newline. */
function tokenizeJS(src) {
  const tokens = [];
  let i = 0;
  let newlineBefore = false;
  let spaceBefore = false;
  const isWordChar = (c) => c !== undefined && /[A-Za-z0-9_$\\\u0080-\uffff]/.test(c);

  const push = (type, value) => {
    tokens.push({ type, value, newlineBefore, spaceBefore });
    newlineBefore = false;
    spaceBefore = false;
  };

  // A `/` starts a regular expression unless it follows something that ends an expression
  const regexAllowed = () => {
    const prev = tokens[tokens.length - 1];
    if (!prev) return true;
    if (prev.type === "word") return KEYWORDS_BEFORE_EXPRESSION.has(prev.value);
    if (prev.type === "string" || prev.type === "regex" || prev.type === "template") return false;
    return !/^[)\]}]$/.test(prev.value);
  };

  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      if (c === "\n" || c === "\r" || c === "\u2028" || c === "\u2029") newlineBefore = true;
      spaceBefore = true;
      i++;
    } else if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) throw new Error("Unterminated JS comment");
      if (/[\n\r]/.test(src.slice(i, end))) newlineBefore = true;
      spaceBefore = true;
      i = end + 2;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (src[j] !== c) {
        if (j >= src.length || src[j] === "\n") throw new Error("Unterminated JS string at " + i);
        j += src[j] === "\\" ? 2 : 1;
      }
      push("string", src.slice(i, j + 1));
      i = j + 1;
    } else if (c === "`") {
      // Template literals are kept verbatim; ${} with nested backticks is not supported
      let j = i + 1;
      while (src[j] !== "`") {
        if (j >= src.length) throw new Error("Unterminated template literal at " + i);
        j += src[j] === "\\" ? 2 : 1;
      }
      push("template", src.slice(i, j + 1));
      i = j + 1;
    } else if (c === "/" && regexAllowed()) {
      let j = i + 1;
      let inClass = false;
      while (inClass || src[j] !== "/") {
        if (j >= src.length || src[j] === "\n") throw new Error("Unterminated regex at " + i);
        if (src[j] === "\\") j++;
        else if (src[j] === "[") inClass = true;
        else if (src[j] === "]") inClass = false;
        j++;
      }
      j++;
      while (isWordChar(src[j])) j++; // flags
      push("regex", src.slice(i, j));
      i = j;
    } else if (isWordChar(c) || (c === "." && /[0-9]/.test(src[i + 1]))) {
      let j = i + 1;
      // Numbers like 1e-5 or 0.5 stay one token
      while (
        isWordChar(src[j]) ||
        (src[j] === "." && /[0-9.]/.test(src[i])) ||
        (/[+-]/.test(src[j]) && /^[0-9.]+[eE]$/.test(src.slice(i, j)))
      ) {
        j++;
      }
      push("word", src.slice(i, j));
      i = j;
    } else {
      const op = PUNCTUATORS.find((p) => src.startsWith(p, i)) || c;
      push("punct", op);
      i += op.length;
    }
  }
  return tokens;
}

function minifyJS(src) {
  const tokens = tokenizeJS(src);
  let out = "";
  let prev = null;
  for (const token of tokens) {
    if (prev) {
      const a = prev.value;
      const b = token.value;
      const last = a[a.length - 1];
      const first = b[0];
      const wordy = (s) => /[A-Za-z0-9_$\\\u0080-\uffff]/.test(s);
      if (token.newlineBefore && prev.type === "word" && RESTRICTED.has(a)) {
        out += "\n";
      } else if (token.spaceBefore) {
        const needsSpace =
          (wordy(last) && wordy(first)) ||
          // `a + +b`, `a - -b`, `a / /re/`, a number followed by `.`
          ((last === "+" || last === "-") && first === last) ||
          (last === "/" && (first === "/" || first === "*")) ||
          (prev.type === "word" && /^[0-9]/.test(a) && first === ".");
        if (needsSpace) out += token.newlineBefore ? "\n" : " ";
      }
    }
    out += token.value;
    prev = token;
  }
  return out;
}

function minifyMarkup(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .replace(/> </g, "><")
    .replace(/ \/>/g, ">")
    .trim();
}

function minifyHTML(html) {
  // The data section must be the last thing in the file, and is copied unchanged
  const tags = [...html.matchAll(DATA_SECTION)];
  if (tags.length === 0) throw new Error("template.html must end with the <plaintext> data section");
  const dataStart = tags[tags.length - 1].index;
  const data = html.slice(dataStart).replace(/\s+$/, "");
  const page = html.slice(0, dataStart);

  if (!/^<plaintext\b[^>]*>\{\{FILE_HASH\}\}\n\{\{FILE_URIS\}\}$/.test(data)) {
    throw new Error("Data section must be `<plaintext ...>{{FILE_HASH}}` + newline + `{{FILE_URIS}}`, with nothing after it");
  }

  // Minify the page in pieces: markup, <style> bodies and <script> bodies
  let out = "";
  const blocks = /(<(style|script)>)([\s\S]*?)(<\/\2>)/g;
  let last = 0;
  for (const m of page.matchAll(blocks)) {
    out += minifyMarkup(page.slice(last, m.index)) + m[1];
    const body = m[2] === "style" ? minifyCSS(m[3]) : minifyJS(m[3]);
    // Inside <script>/<style> these would end the element early or change how it is parsed
    if (/<\/(script|style)|<!--/i.test(body)) throw new Error("Minified " + m[2] + " contains </" + m[2] + " or <!--");
    out += body + m[4];
    last = m.index + m[0].length;
  }
  out += minifyMarkup(page.slice(last));

  if (out.includes("{{FILE_HASH}}") || out.includes("{{FILE_URIS}}")) {
    throw new Error("Placeholders may only appear in the data section");
  }
  return out + data;
}

function generateStats(original, minified) {
  const originalSize = Buffer.byteLength(original);
  const minifiedSize = Buffer.byteLength(minified);
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
  pnpm minify                 # Minify template.html into minified.html
  pnpm minify --stats         # Show detailed statistics

Options:
  --stats         Show detailed compression statistics
  --help, -h      Show this help message

Output:
  html-template/minified.html - Minified HTML, stored on chain with setDefaultHtmlTemplate
                                (script/UpdateHTMLTemplate.s.sol)

Template Variables (replaced by the contract, inside the final <plaintext> element):
  {{FILE_HASH}}     - SHA-256 of the artwork, 0x-prefixed or not (first line)
  {{FILE_URIS}}     - Comma-separated quoted URIs (following lines)
`);
    process.exit(0);
  }

  try {
    const templatePath = path.join(__dirname, "template.html");
    const originalHTML = fs.readFileSync(templatePath, "utf8");

    console.log("🗜️  Minifying HTML template...");
    const minifiedHTML = minifyHTML(originalHTML);

    // The template is stored as ASCII so it can be split into chunks at any byte
    if (!/^[\x00-\x7f]*$/.test(minifiedHTML)) throw new Error("Minified template must be ASCII");

    const stats = generateStats(originalHTML, minifiedHTML);
    console.log(`📊 Compression Statistics:`);
    console.log(`   Original size: ${stats.originalSize.toLocaleString()} bytes`);
    console.log(`   Minified size: ${stats.minifiedSize.toLocaleString()} bytes`);
    console.log(`   Space saved: ${stats.savings.toLocaleString()} bytes (${stats.percentage}%)`);

    const outputPath = path.join(__dirname, "minified.html");
    fs.writeFileSync(outputPath, minifiedHTML, "utf8");
    console.log(`💾 Minified HTML saved to: html-template/minified.html`);

    if (args.includes("--stats")) {
      // Rough cost of reading the template in tokenURI: SSTORE2 read, placeholder replacement and base64
      console.log(`\n📈 Estimated renderRawHTML gas for the template alone: ~${(stats.minifiedSize * 175).toLocaleString()}`);
      console.log(`   Chunks of up to 24,000 bytes: ${Math.ceil(stats.minifiedSize / 24000)}`);
    }

    console.log("✅ Minification complete!");
    console.log(`\n📝 Next step: forge script script/UpdateHTMLTemplate.s.sol (see the script for flags)`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { minifyHTML, minifyJS, minifyCSS };
