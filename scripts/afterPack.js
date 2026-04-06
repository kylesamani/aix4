const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function codesign(target, identity, entitlements) {
  const args = `codesign --sign "${identity}" --force --timestamp --options runtime`;
  const entArg = entitlements ? ` --entitlements "${entitlements}"` : '';
  execSync(`${args}${entArg} "${target}"`, { shell: '/bin/bash', stdio: 'pipe' });
}

// Recursively find all Mach-O binaries and nested bundles inside a directory.
// Returns { binaries: string[], bundles: string[] } where bundles are .app/.framework
// dirs that must be signed as bundles (after their own contents are signed).
function findSignables(dir) {
  const binaries = [];
  const bundles = [];
  if (!fs.existsSync(dir)) return { binaries, bundles };

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    // Resolve symlinks to determine if target is a file or directory
    let stat;
    try {
      stat = fs.statSync(fullPath); // follows symlinks (unlike lstatSync)
    } catch (e) {
      continue; // broken symlink
    }

    if (stat.isDirectory()) {
      if (entry.name.endsWith('.framework') || entry.name.endsWith('.app')) {
        // Nested bundle — recurse into it, sign its contents, then sign the bundle itself
        const nested = findSignables(fullPath);
        binaries.push(...nested.binaries);
        bundles.push(...nested.bundles);
        bundles.push(fullPath); // sign the bundle last
      } else {
        const nested = findSignables(fullPath);
        binaries.push(...nested.binaries);
        bundles.push(...nested.bundles);
      }
    } else if (stat.isFile() && !entry.isSymbolicLink()) {
      // Only sign real files, not symlinks (signing a symlink breaks the framework structure)
      if (entry.name.endsWith('.dylib') || entry.name.endsWith('.so')) {
        binaries.push(fullPath);
      } else if (!entry.name.includes('.')) {
        // Extensionless files might be Mach-O executables
        try {
          const fileType = execSync(`file "${fullPath}"`, { encoding: 'utf8', stdio: 'pipe' });
          if (fileType.includes('Mach-O')) {
            binaries.push(fullPath);
          }
        } catch (e) {
          // skip
        }
      }
    }
  }
  return { binaries, bundles };
}

exports.default = async function (context) {
  // Code signing is macOS-only
  if (process.platform !== 'darwin') {
    console.log('  • skipping macOS code signing on', process.platform);
    return;
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const identity = 'D13654CCEF08FC176FD95415B3885BCC00190FFD';
  const entitlements = path.resolve(__dirname, '..', 'entitlements.mac.plist');
  const childEntitlements = path.resolve(__dirname, '..', 'entitlements.child.plist');
  const fwDir = path.join(appPath, 'Contents', 'Frameworks');

  // Move to /tmp to escape iCloud file provider adding FinderInfo xattrs
  const tmpApp = `/tmp/aix4-sign/${context.packager.appInfo.productFilename}.app`;
  const tmpDir = path.dirname(tmpApp);
  if (fs.existsSync(tmpDir)) execSync(`rm -rf "${tmpDir}"`);
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log(`  • moving to /tmp for signing`);
  execSync(`mv "${appPath}" "${tmpApp}"`);
  execSync(`xattr -cr "${tmpApp}"`);

  // Sign inside-out
  const tmpFwDir = path.join(tmpApp, 'Contents', 'Frameworks');

  // 1. Sign all frameworks — findSignables recurses into nested .app/.framework bundles
  for (const fw of fs.readdirSync(tmpFwDir).filter(f => f.endsWith('.framework'))) {
    const fwPath = path.join(tmpFwDir, fw);
    const { binaries, bundles } = findSignables(fwPath);
    // Sign individual binaries first (inside-out)
    for (const bin of binaries) {
      codesign(bin, identity, childEntitlements);
      console.log(`    ✓ ${path.relative(tmpFwDir, bin)}`);
    }
    // Sign nested bundles (already ordered inside-out by findSignables)
    for (const bundle of bundles) {
      codesign(bundle, identity, childEntitlements);
      console.log(`    ✓ ${path.relative(tmpFwDir, bundle)}`);
    }
    // Sign the framework bundle itself
    codesign(fwPath, identity, childEntitlements);
    console.log(`    ✓ ${fw}`);
  }

  // 2. Sign helper apps at the top level of Frameworks/
  for (const helper of fs.readdirSync(tmpFwDir).filter(f => f.endsWith('.app'))) {
    const helperPath = path.join(tmpFwDir, helper);
    const { binaries, bundles } = findSignables(helperPath);
    for (const bin of binaries) {
      codesign(bin, identity, childEntitlements);
      console.log(`    ✓ ${path.relative(tmpFwDir, bin)}`);
    }
    for (const bundle of bundles) {
      codesign(bundle, identity, childEntitlements);
      console.log(`    ✓ ${path.relative(tmpFwDir, bundle)}`);
    }
    codesign(helperPath, identity, childEntitlements);
    console.log(`    ✓ ${helper}`);
  }

  // 3. Sign the main binary with entitlements, then the app bundle
  const mainBin = path.join(tmpApp, 'Contents', 'MacOS', context.packager.appInfo.productFilename);
  codesign(mainBin, identity, entitlements);
  codesign(tmpApp, identity, entitlements);
  console.log(`    ✓ AIx4.app signed`);

  // Verify signing
  execSync(`codesign --verify --deep --strict "${tmpApp}"`, { stdio: 'pipe' });
  console.log(`    ✓ verification passed`);

  // Notarize
  console.log(`  • submitting for notarization (this takes 1-5 minutes)...`);
  const zipPath = `/tmp/aix4-sign/AIx4.zip`;
  execSync(`ditto -c -k --keepParent "${tmpApp}" "${zipPath}"`, { stdio: 'pipe' });

  execSync(
    `xcrun notarytool submit "${zipPath}" ` +
    `--key "/Users/kylesamani/private_keys/AuthKey_F857MZAC93.p8" ` +
    `--key-id "F857MZAC93" ` +
    `--issuer "69a6de74-c6b3-47e3-e053-5b8c7c11a4d1" ` +
    `--wait`,
    { stdio: 'inherit', shell: '/bin/bash', timeout: 600000 }
  );

  // Staple the notarization ticket to the app
  execSync(`xcrun stapler staple "${tmpApp}"`, { stdio: 'inherit' });
  console.log(`    ✓ notarization complete`);

  // Move back using ditto (strips xattrs) instead of mv (preserves them)
  // Then immediately strip any xattrs iCloud re-adds
  execSync(`rm -rf "${appPath}"`);
  execSync(`ditto --noextattr --norsrc "${tmpApp}" "${appPath}"`);
  execSync(`xattr -cr "${appPath}"`);
  execSync(`rm -rf "${tmpDir}"`);
};
