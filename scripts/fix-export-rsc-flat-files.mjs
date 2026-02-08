import fsp from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "out");

async function* walkDirs(rootDir) {
  const entries = await fsp.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(rootDir, entry.name);
    yield fullPath;
    yield* walkDirs(fullPath);
  }
}

async function* walkFiles(rootDir) {
  const entries = await fsp.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) yield* walkFiles(fullPath);
    else if (entry.isFile()) yield fullPath;
  }
}

async function exists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function flattenRelativePath(relativePath) {
  return relativePath.replace(/[\\/]+/g, ".");
}

async function createFlattenedRscFiles() {
  if (!(await exists(OUT_DIR))) return { created: 0, scanned: 0 };

  let created = 0;
  let scanned = 0;

  for await (const dirPath of walkDirs(OUT_DIR)) {
    const dirName = path.basename(dirPath);
    if (!dirName.startsWith("__next.")) continue;

    const parentDir = path.dirname(dirPath);
    for await (const filePath of walkFiles(dirPath)) {
      if (!filePath.endsWith(".txt")) continue;
      scanned += 1;

      const relativePath = path.relative(dirPath, filePath);
      const flattened = `${dirName}.${flattenRelativePath(relativePath)}`;
      const destPath = path.join(parentDir, flattened);
      if (await exists(destPath)) continue;

      await fsp.copyFile(filePath, destPath);
      created += 1;
    }
  }

  return { created, scanned };
}

const result = await createFlattenedRscFiles();
console.log(`[export-fix] scanned=${result.scanned} created=${result.created}`);

