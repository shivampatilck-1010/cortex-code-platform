const fs = require('fs');

function inspectPE() {
  const filePath = 'release/windows/CortexLockdown-Hardened.exe';
  const buf = fs.readFileSync(filePath);
  const peOffset = buf.readUInt32LE(0x3c);
  const optHeaderOffset = peOffset + 24;
  const magic = buf.readUInt16LE(optHeaderOffset);
  const dataDirStart = magic === 0x20b ? optHeaderOffset + 112 : optHeaderOffset + 96;

  console.log('=== CLR & PE RESOURCE AUDIT ===');
  // Index 14: CLR Runtime Header
  const clrRva = buf.readUInt32LE(dataDirStart + (14 * 8));
  const clrSize = buf.readUInt32LE(dataDirStart + (14 * 8) + 4);
  console.log(`CLR Runtime Header: RVA=0x${clrRva.toString(16)}, Size=${clrSize}`);

  // Index 2: Resource Directory
  const rsrcRva = buf.readUInt32LE(dataDirStart + (2 * 8));
  const rsrcSize = buf.readUInt32LE(dataDirStart + (2 * 8) + 4);
  console.log(`Resource Directory: RVA=0x${rsrcRva.toString(16)}, Size=${rsrcSize}`);

  // Search for Assembly / Manifest / Version info strings in buffer
  const str = buf.toString('utf8');
  const manifestMatch = str.match(/<assembly[\s\S]*?<\/assembly>/i);
  if (manifestMatch) {
    console.log('\n--- Embedded Application Manifest ---');
    console.log(manifestMatch[0]);
  } else {
    console.log('\nNo XML assembly manifest found in plaintext');
  }

  // Look for Assembly metadata
  const metadataMatches = str.match(/(?:AssemblyTitle|AssemblyDescription|AssemblyCompany|AssemblyProduct|AssemblyCopyright|AssemblyVersion|FileVersion)Attribute[^\0]*/g);
  if (metadataMatches) {
    console.log('\n--- .NET Assembly Attributes ---');
    console.log(metadataMatches.slice(0, 10).join('\n'));
  }

  // Look for target framework
  const tfMatch = str.match(/\.NETFramework,Version=v[0-9.]+/);
  if (tfMatch) {
    console.log('\n--- Target Framework ---');
    console.log(tfMatch[0]);
  }
}

inspectPE();
