import fs from 'node:fs';
import path from 'node:path';

const [, , releasePathArg, readmePathArg] = process.argv;

if (!releasePathArg || !readmePathArg) {
  console.error('Usage: node scripts/sync-readme-release-assets.mjs <release.json> <README.md>');
  process.exit(1);
}

const releasePath = path.resolve(releasePathArg);
const readmePath = path.resolve(readmePathArg);

const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
const readmeOriginal = fs.readFileSync(readmePath, 'utf8');

if (!Array.isArray(release.assets) || release.assets.length === 0) {
  throw new Error('Release payload does not contain any assets.');
}

const matchers = {
  dmg: (name) => name.endsWith('.dmg'),
  exe: (name) => name.endsWith('-setup.exe'),
  msi: (name) => name.endsWith('.msi'),
  appimage: (name) => name.endsWith('.AppImage'),
  deb: (name) => name.endsWith('.deb'),
  rpm: (name) => name.endsWith('.rpm'),
};

function findAsset(label, matcher) {
  const matches = release.assets.filter((asset) => matcher(asset.name));

  if (matches.length !== 1) {
    const names = matches.map((asset) => asset.name).join(', ') || 'none';
    throw new Error(`Expected exactly one ${label} asset, found ${matches.length}: ${names}`);
  }

  return matches[0];
}

const assets = {
  dmg: findAsset('macOS DMG', matchers.dmg),
  exe: findAsset('Windows setup EXE', matchers.exe),
  msi: findAsset('Windows MSI', matchers.msi),
  appimage: findAsset('Linux AppImage', matchers.appimage),
  deb: findAsset('Linux DEB', matchers.deb),
  rpm: findAsset('Linux RPM', matchers.rpm),
};

function replaceReferenceUrl(content, refName, url) {
  const pattern = new RegExp(`^\\[${refName}\\]: .*$`, 'm');
  if (!pattern.test(content)) {
    throw new Error(`Reference URL [${refName}] not found in README.`);
  }
  return content.replace(pattern, `[${refName}]: ${url}`);
}

function replaceReferenceLabel(content, refName, label) {
  const pattern = new RegExp(`\\[[^\\]]+\\]\\[${refName}\\]`);
  if (!pattern.test(content)) {
    throw new Error(`Reference label for [${refName}] not found in README.`);
  }
  return content.replace(pattern, `[${label} ↓][${refName}]`);
}

function replaceCommandFilename(content, prefix, filename) {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}\\S+$`, 'm');
  if (!pattern.test(content)) {
    throw new Error(`Command line starting with "${prefix}" not found in README.`);
  }
  return content.replace(pattern, `${prefix}${filename}`);
}

let readmeNext = readmeOriginal;

readmeNext = replaceReferenceLabel(readmeNext, 'dmg-url', assets.dmg.name);
readmeNext = replaceReferenceLabel(readmeNext, 'exe-url', assets.exe.name);
readmeNext = replaceReferenceLabel(readmeNext, 'msi-url', assets.msi.name);
readmeNext = replaceReferenceLabel(readmeNext, 'appimage-url', assets.appimage.name);
readmeNext = replaceReferenceLabel(readmeNext, 'deb-url', assets.deb.name);
readmeNext = replaceReferenceLabel(readmeNext, 'rpm-url', assets.rpm.name);

readmeNext = replaceCommandFilename(readmeNext, 'chmod +x ', assets.appimage.name);
readmeNext = replaceCommandFilename(readmeNext, './', assets.appimage.name);
readmeNext = replaceCommandFilename(readmeNext, 'sudo dpkg -i ', assets.deb.name);
readmeNext = replaceCommandFilename(readmeNext, 'sudo rpm -i ', assets.rpm.name);

readmeNext = replaceReferenceUrl(readmeNext, 'dmg-url', assets.dmg.browser_download_url);
readmeNext = replaceReferenceUrl(readmeNext, 'exe-url', assets.exe.browser_download_url);
readmeNext = replaceReferenceUrl(readmeNext, 'msi-url', assets.msi.browser_download_url);
readmeNext = replaceReferenceUrl(readmeNext, 'appimage-url', assets.appimage.browser_download_url);
readmeNext = replaceReferenceUrl(readmeNext, 'deb-url', assets.deb.browser_download_url);
readmeNext = replaceReferenceUrl(readmeNext, 'rpm-url', assets.rpm.browser_download_url);

if (readmeNext !== readmeOriginal) {
  fs.writeFileSync(readmePath, readmeNext);
}

console.log(`README synced for release ${release.tag_name ?? 'unknown'}`);
