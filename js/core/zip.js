/* Lightweight, dependency-free Standard ZIP Builder for Titan Quest II Save Exports */
(function() {
  'use strict';

  const CRC32_TABLE = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    CRC32_TABLE[i] = c >>> 0;
  }

  function crc32(uint8Array) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < uint8Array.length; i++) {
      c = CRC32_TABLE[(c ^ uint8Array[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function buildZip(files) {
    // files: Array of { name: string, data: Uint8Array }
    const encoder = new TextEncoder();
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    const localChunks = [];
    const centralChunks = [];
    let offset = 0;

    for (const f of files) {
      const nameBytes = encoder.encode(f.name);
      const dataBytes = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
      const crc = crc32(dataBytes);
      const size = dataBytes.length;

      // 1. Local File Header
      const lh = new Uint8Array(30 + nameBytes.length + size);
      const dvLh = new DataView(lh.buffer);
      dvLh.setUint32(0, 0x04034b50, true);  // Local file header signature
      dvLh.setUint16(4, 20, true);          // Version needed: 2.0
      dvLh.setUint16(6, 0x0800, true);       // Flags: Bit 11 (UTF-8 filename encoding)
      dvLh.setUint16(8, 0, true);            // Compression: Stored (no compression)
      dvLh.setUint16(10, dosTime, true);     // Last mod file time
      dvLh.setUint16(12, dosDate, true);     // Last mod file date
      dvLh.setUint32(14, crc, true);         // CRC-32
      dvLh.setUint32(18, size, true);        // Compressed size
      dvLh.setUint32(22, size, true);        // Uncompressed size
      dvLh.setUint16(26, nameBytes.length, true); // File name length
      dvLh.setUint16(28, 0, true);           // Extra field length
      lh.set(nameBytes, 30);
      lh.set(dataBytes, 30 + nameBytes.length);
      localChunks.push(lh);

      // 2. Central Directory File Header
      const ch = new Uint8Array(46 + nameBytes.length);
      const dvCh = new DataView(ch.buffer);
      dvCh.setUint32(0, 0x02014b50, true);  // Central file header signature
      dvCh.setUint16(4, 20, true);          // Version made by (DOS / 2.0)
      dvCh.setUint16(6, 20, true);          // Version needed: 2.0
      dvCh.setUint16(8, 0x0800, true);       // Flags: UTF-8
      dvCh.setUint16(10, 0, true);           // Compression: Stored
      dvCh.setUint16(12, dosTime, true);     // Last mod file time
      dvCh.setUint16(14, dosDate, true);     // Last mod file date
      dvCh.setUint32(16, crc, true);         // CRC-32
      dvCh.setUint32(20, size, true);        // Compressed size
      dvCh.setUint32(24, size, true);        // Uncompressed size
      dvCh.setUint16(28, nameBytes.length, true); // File name length
      dvCh.setUint16(30, 0, true);           // Extra field length
      dvCh.setUint16(32, 0, true);           // Comment length
      dvCh.setUint16(34, 0, true);           // Disk number start
      dvCh.setUint16(36, 0, true);           // Internal file attributes
      dvCh.setUint32(38, 0x00000000, true);  // External file attributes
      dvCh.setUint32(42, offset, true);     // Relative offset of local header
      ch.set(nameBytes, 46);
      centralChunks.push(ch);

      offset += lh.length;
    }

    const centralDirOffset = offset;
    let centralDirSize = 0;
    for (const c of centralChunks) centralDirSize += c.length;

    // 3. End of Central Directory Record (EOCD)
    const eocd = new Uint8Array(22);
    const dvEocd = new DataView(eocd.buffer);
    dvEocd.setUint32(0, 0x06054b50, true);   // EOCD signature
    dvEocd.setUint16(4, 0, true);            // Disk number
    dvEocd.setUint16(6, 0, true);            // Start disk
    dvEocd.setUint16(8, files.length, true); // Entries on disk
    dvEocd.setUint16(10, files.length, true);// Total entries
    dvEocd.setUint32(12, centralDirSize, true);   // Size of central directory
    dvEocd.setUint32(16, centralDirOffset, true); // Offset of central directory
    dvEocd.setUint16(20, 0, true);           // Comment length

    const totalSize = centralDirOffset + centralDirSize + 22;
    const out = new Uint8Array(totalSize);
    let p = 0;
    for (const lh of localChunks) { out.set(lh, p); p += lh.length; }
    for (const ch of centralChunks) { out.set(ch, p); p += ch.length; }
    out.set(eocd, p);

    return out;
  }

  const API = { buildZip, crc32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.TQ2Zip = API;
  if (typeof globalThis !== 'undefined') globalThis.TQ2Zip = API;
})();
