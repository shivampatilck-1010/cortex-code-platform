const fs = require('fs');

function inspectPE(filePath) {
  const buf = fs.readFileSync(filePath);
  console.log('=== PE INSPECTION: ' + filePath + ' ===');
  console.log('File size:', buf.length, 'bytes');

  if (buf.readUInt16LE(0) !== 0x5a4d) {
    console.log('Error: Not a PE file');
    return;
  }

  const peOffset = buf.readUInt32LE(0x3c);
  const peSig = buf.readUInt32LE(peOffset);
  console.log('PE Offset: 0x' + peOffset.toString(16), 'Signature: 0x' + peSig.toString(16));

  const machine = buf.readUInt16LE(peOffset + 4);
  const numSections = buf.readUInt16LE(peOffset + 6);
  const timeDateStamp = buf.readUInt32LE(peOffset + 8);
  const optHeaderSize = buf.readUInt16LE(peOffset + 20);
  const characteristics = buf.readUInt16LE(peOffset + 22);

  console.log('Machine: 0x' + machine.toString(16) + (machine === 0x8664 ? ' (x64 / AMD64)' : ''));
  console.log('Sections count:', numSections);
  console.log('TimeDateStamp:', new Date(timeDateStamp * 1000).toISOString());
  console.log('Characteristics: 0x' + characteristics.toString(16));

  const optHeaderOffset = peOffset + 24;
  const magic = buf.readUInt16LE(optHeaderOffset);
  console.log('Optional Header Magic: 0x' + magic.toString(16) + (magic === 0x20b ? ' (PE32+ / 64-bit)' : ''));

  const subsystem = buf.readUInt16LE(optHeaderOffset + 68);
  console.log('Subsystem: 0x' + subsystem.toString(16) + (subsystem === 2 ? ' (Windows GUI)' : subsystem === 3 ? ' (Windows Console)' : ''));

  const dllCharacteristics = buf.readUInt16LE(optHeaderOffset + 70);
  console.log('DllCharacteristics: 0x' + dllCharacteristics.toString(16));
  console.log(' - High Entropy VA (ASLR 64):', !!(dllCharacteristics & 0x0020));
  console.log(' - Dynamic Base (ASLR):', !!(dllCharacteristics & 0x0040));
  console.log(' - NX Compatible (DEP):', !!(dllCharacteristics & 0x0100));
  console.log(' - No Isolation:', !!(dllCharacteristics & 0x0200));
  console.log(' - No SEH:', !!(dllCharacteristics & 0x0400));
  console.log(' - Control Flow Guard (Guard CF):', !!(dllCharacteristics & 0x4000));

  // Security Directory (Index 4 in Data Directories)
  // Data directories start at optHeaderOffset + 112 (for PE32+)
  const dataDirOffset = optHeaderOffset + 112;
  const certTableRva = buf.readUInt32LE(dataDirOffset + (4 * 8));
  const certTableSize = buf.readUInt32LE(dataDirOffset + (4 * 8) + 4);
  console.log('Authenticode Security Directory: Offset=0x' + certTableRva.toString(16) + ', Size=' + certTableSize);
  if (certTableRva === 0 || certTableSize === 0) {
    console.log('Authenticode Signature: NONE (Unsigned binary)');
  } else {
    console.log('Authenticode Signature: PRESENT');
  }

  // Sections
  const sectionTableOffset = optHeaderOffset + optHeaderSize;
  console.log('\n--- Section Table ---');
  const sections = [];
  for (let i = 0; i < numSections; i++) {
    const sOffset = sectionTableOffset + (i * 40);
    const name = buf.toString('utf8', sOffset, sOffset + 8).replace(/\0/g, '');
    const virtSize = buf.readUInt32LE(sOffset + 8);
    const virtAddr = buf.readUInt32LE(sOffset + 12);
    const rawSize = buf.readUInt32LE(sOffset + 16);
    const rawOffset = buf.readUInt32LE(sOffset + 20);
    const chars = buf.readUInt32LE(sOffset + 36);
    sections.push({ name, virtSize, virtAddr, rawSize, rawOffset, chars });
    console.log(`[${i}] ${name.padEnd(8)} VirtAddr: 0x${virtAddr.toString(16).padStart(6, '0')} VirtSize: ${virtSize.toString().padStart(6)} RawOffset: 0x${rawOffset.toString(16).padStart(6, '0')} RawSize: ${rawSize.toString().padStart(6)} Chars: 0x${chars.toString(16)}`);
  }

  // Import Directory (Index 1 in Data Directories)
  const importRva = buf.readUInt32LE(dataDirOffset + (1 * 8));
  const importSize = buf.readUInt32LE(dataDirOffset + (1 * 8) + 4);
  console.log('\n--- Import Table ---');
  console.log(`Import RVA: 0x${importRva.toString(16)}, Size: ${importSize}`);

  function rvaToOffset(rva) {
    for (const sec of sections) {
      if (rva >= sec.virtAddr && rva < sec.virtAddr + sec.virtSize) {
        return sec.rawOffset + (rva - sec.virtAddr);
      }
    }
    return 0;
  }

  if (importRva > 0) {
    let descOffset = rvaToOffset(importRva);
    while (descOffset < buf.length) {
      const origFirstThunk = buf.readUInt32LE(descOffset);
      const timeDate = buf.readUInt32LE(descOffset + 4);
      const forwarderChain = buf.readUInt32LE(descOffset + 8);
      const nameRva = buf.readUInt32LE(descOffset + 12);
      const firstThunk = buf.readUInt32LE(descOffset + 16);

      if (origFirstThunk === 0 && nameRva === 0 && firstThunk === 0) break;

      const nameOffset = rvaToOffset(nameRva);
      let dllName = '';
      for (let j = nameOffset; j < buf.length && buf[j] !== 0; j++) {
        dllName += String.fromCharCode(buf[j]);
      }

      console.log(`\nImport DLL: ${dllName}`);

      const thunkRva = origFirstThunk !== 0 ? origFirstThunk : firstThunk;
      let thunkOffset = rvaToOffset(thunkRva);
      const importedFuncs = [];

      while (thunkOffset < buf.length) {
        const thunkVal = buf.readBigUInt64LE(thunkOffset);
        if (thunkVal === 0n) break;

        if (thunkVal & 0x8000000000000000n) {
          // Ordinal
          importedFuncs.push(`Ordinal: ${(thunkVal & 0xffffn).toString()}`);
        } else {
          const hintNameRva = Number(thunkVal & 0x7fffffffn);
          const hintNameOffset = rvaToOffset(hintNameRva);
          if (hintNameOffset > 0 && hintNameOffset < buf.length) {
            const hint = buf.readUInt16LE(hintNameOffset);
            let funcName = '';
            for (let k = hintNameOffset + 2; k < buf.length && buf[k] !== 0; k++) {
              funcName += String.fromCharCode(buf[k]);
            }
            importedFuncs.push(funcName);
          }
        }
        thunkOffset += 8;
      }
      console.log(`  Functions (${importedFuncs.length}): ${importedFuncs.join(', ')}`);
      descOffset += 20;
    }
  }

  // Check strings in executable for suspicious terms / endpoints
  console.log('\n--- String Artifact Analysis ---');
  const str = buf.toString('binary');
  const suspiciousKeywords = [
    'WH_KEYBOARD_LL', 'SetWindowsHookEx', 'SetWindowDisplayAffinity',
    'TerminateProcess', 'CreateRemoteThread', 'WriteProcessMemory',
    'VirtualAllocEx', 'RegSetValueEx', 'OpenProcess', 'EnumProcesses',
    'Taskmgr', 'ProcessHacker', 'Wireshark', 'cortex-lockdown://',
    'http://', 'https://', 'cmd.exe', 'powershell.exe'
  ];

  for (const kw of suspiciousKeywords) {
    const count = (str.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    console.log(`Keyword '${kw}': ${count} occurrences`);
  }
}

inspectPE('release/windows/CortexLockdown-Hardened.exe');
