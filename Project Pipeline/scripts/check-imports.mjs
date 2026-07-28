#!/usr/bin/env node
/**
 * Memastikan setiap impor alias `@/...` menunjuk file yang benar-benar ada.
 *
 * Dibuat setelah seluruh aplikasi gagal build karena folder bernama
 * `src/component/` sementara 22 file mengimpor `@/components/`. Vite baru
 * mengeluh saat build, dan `tsc` diam saja karena impor yang tak terselesaikan
 * jatuh menjadi `any`. Pemeriksaan kecil ini menangkapnya dalam hitungan milidetik.
 *
 * Jalankan: npm run check:imports
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const SOURCE_EXT = [".js", ".jsx", ".ts", ".tsx"];
// Ekstensi yang dicoba saat impor ditulis tanpa ekstensi (mis. "@/lib/format").
const RESOLVE_EXT = ["", ...SOURCE_EXT, "/index.js", "/index.jsx", "/index.ts", "/index.tsx"];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (SOURCE_EXT.some((ext) => entry.name.endsWith(ext))) yield path;
  }
}

function resolvesToFile(target) {
  return RESOLVE_EXT.some((ext) => {
    const candidate = target + ext;
    return existsSync(candidate) && statSync(candidate).isFile();
  });
}

const problems = [];
let checked = 0;

for (const file of walk(SRC)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    // Menangkap: import ... from "@/x", export ... from "@/x", import("@/x")
    for (const match of line.matchAll(/from\s+["'](@\/[^"']+)["']|import\(\s*["'](@\/[^"']+)["']/g)) {
      const specifier = match[1] ?? match[2];
      checked += 1;
      if (!resolvesToFile(join(SRC, specifier.slice(2)))) {
        problems.push({ file: file.replace(`${ROOT}/`, ""), line: i + 1, specifier });
      }
    }
  });
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} impor alias tidak terselesaikan:\n`);
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}  ->  ${p.specifier}`);
  }
  console.error("");
  process.exit(1);
}

console.log(`✓ ${checked} impor alias terselesaikan.`);
