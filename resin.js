// Format facts: Prusa SL1 config.ini, elegooOfficial/GOO's V1.2 specification,
// and cbiffle/catibo's documented CTB v2 layout. No vendor code is executed.
// Anycubic layouts: UVtools by sn4k3 and contributors, revision
// 2e3bad68174b9d5da06148a3b2d5d5220586f7a5. See THIRD_PARTY_NOTICES.md.
const MiB = 1024 * 1024;
const positive = (value, max = 1e9, min = 0) => Number.isFinite(value) && value > 0 && value >= min && value <= max ? value : null;
const text = bytes => new TextDecoder().decode(bytes).replace(/\0.*$/s, '').trim();
const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
export const photonWorkshopExtensions = ['pws', 'pw0', 'pwx', 'dlp', 'dl2p', 'pwmx', 'pmx2', 'pwmb', 'px6s',
  'pwmo', 'pm3n', 'pm4n', 'pwms', 'pwma', 'pmsq', 'pm3', 'pm3m', 'pm3r', 'pm5', 'pm5s', 'm5sp', 'pwc'];
export const photonWorkshopZipExtensions = ['pm4u', 'pm7', 'pm7m', 'pwsz', 'pp1', 'pp1m'];
const anycubicVersions = [1, 515, 516, 517, 518];
export const resinFormats = ['SL1', 'SL1S', 'CTB v2', 'CTB v3', 'GOO V3.0', 'Photon v1', 'Photon v2', 'PhotonS',
  ...anycubicVersions.map(version => `Anycubic v${version}`), ...[1, 2, 3].map(version => `Anycubic ZIP v${version}`)];
export const resinFileAccept = ['sl1', 'sl1s', 'goo', 'ctb', 'photon', 'photons', ...photonWorkshopExtensions, ...photonWorkshopZipExtensions].map(extension => `.${extension}`).join(',');
export const resinExtensions = new RegExp(`\\.(${resinFileAccept.replaceAll('.', '').replaceAll(',', '|')})$`, 'i');

async function bytes(file, offset, length) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > file.size) {
    throw new Error('Truncated resin file or invalid data offset.');
  }
  return new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
}
function geometry(widthMm, heightMm, pixelsX, pixelsY, layerHeightMm) {
  return { widthMm: positive(widthMm, 2000, 0.001), heightMm: positive(heightMm, 2000, 0.001),
    pixelsX: Number.isInteger(pixelsX) ? positive(pixelsX, 32768) : null,
    pixelsY: Number.isInteger(pixelsY) ? positive(pixelsY, 32768) : null,
    layerHeightMm: positive(layerHeightMm, 5, 0.000001) };
}
function result(format, hours, volumeMl, printerName, shape, layers, reconstruction, reason = '') {
  return { format, hours: positive(hours, 1e6), volumeMl: positive(volumeMl), printerName: printerName.slice(0, 200),
    geometry: shape, layers, reconstruction, reason };
}
function keyValues(source) {
  const parsed = Object.create(null);
  for (const line of source.split(/\r?\n/)) {
    const pair = line.trim().match(/^([a-zA-Z_]\w*)\s*=\s*(.*?)\s*$/);
    if (pair) parsed[pair[1].toLowerCase().replaceAll('_', '')] = pair[2].replace(/^"|"$/g, '');
  }
  return parsed;
}
function number(config, key) {
  const value = config[key];
  return typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
}
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
async function limitedStream(stream, limit) {
  const reader = stream.getReader(), chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) throw new Error('Expanded ZIP entry exceeds its safety limit.');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}
async function archive(file) {
  const tail = await bytes(file, Math.max(0, file.size - 65557), Math.min(file.size, 65557));
  const data = view(tail);
  let end = -1;
  for (let offset = tail.length - 22; offset >= 0; offset--) {
    if (data.getUint32(offset, true) === 0x06054b50 && offset + 22 + data.getUint16(offset + 20, true) === tail.length) { end = offset; break; }
  }
  if (end < 0) throw new Error('A complete ZIP archive is required.');
  const count = data.getUint16(end + 10, true), size = data.getUint32(end + 12, true), start = data.getUint32(end + 16, true);
  if (data.getUint16(end + 4, true) || data.getUint16(end + 6, true) || data.getUint16(end + 8, true) !== count ||
    count === 65535 || size > 16 * MiB || start + size !== file.size - tail.length + end) throw new Error('Split, ZIP64 or oversized resin ZIP directories are unsupported.');
  const directory = view(await bytes(file, start, size)), entries = new Map();
  let offset = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > size || directory.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid resin ZIP directory.');
    const nameSize = directory.getUint16(offset + 28, true), extraSize = directory.getUint16(offset + 30, true), commentSize = directory.getUint16(offset + 32, true);
    if (offset + 46 + nameSize + extraSize + commentSize > size) throw new Error('Truncated resin ZIP directory.');
    const name = new TextDecoder().decode(new Uint8Array(directory.buffer, offset + 46, nameSize));
    if (entries.has(name)) throw new Error('Duplicate resin ZIP entry.');
    entries.set(name, { name, flags: directory.getUint16(offset + 8, true), method: directory.getUint16(offset + 10, true),
      crc: directory.getUint32(offset + 16, true), compressed: directory.getUint32(offset + 20, true),
      expanded: directory.getUint32(offset + 24, true), offset: directory.getUint32(offset + 42, true) });
    offset += 46 + nameSize + extraSize + commentSize;
  }
  if (offset !== size) throw new Error('Unexpected resin ZIP directory data.');
  return { entries, async read(entry, limit = MiB) {
    if (entry.flags & 1 || ![0, 8].includes(entry.method)) throw new Error('Encrypted or unsupported ZIP compression.');
    if (entry.expanded > limit || entry.compressed > limit) throw new Error('Resin ZIP entry exceeds its safety limit.');
    const header = view(await bytes(file, entry.offset, 30));
    if (header.getUint32(0, true) !== 0x04034b50 || header.getUint16(8, true) !== entry.method) throw new Error('Invalid resin ZIP entry header.');
    const begin = entry.offset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
    if (begin + entry.compressed > start) throw new Error('Invalid resin ZIP entry bounds.');
    const compressed = await bytes(file, begin, entry.compressed);
    let output = compressed;
    if (entry.method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress resin ZIP archives. Use a current browser or copy metrics from your slicer.');
      let decompressor;
      try { decompressor = new DecompressionStream('deflate-raw'); }
      catch { throw new Error('This browser does not support resin ZIP decompression. Copy metrics from your slicer.'); }
      output = await limitedStream(new Blob([compressed]).stream().pipeThrough(decompressor), Math.min(limit, entry.expanded));
    }
    if (output.length !== entry.expanded || crc32(output) !== entry.crc) throw new Error('Resin ZIP entry failed its size/checksum check.');
    return output;
  } };
}
async function sl1(file) {
  const zip = await archive(file);
  const entry = zip.entries.get('config.ini');
  if (!entry) throw new Error('SL1 archive is missing config.ini.');
  const config = keyValues(new TextDecoder().decode(await zip.read(entry)));
  const printerEntry = zip.entries.get('prusaslicer.ini');
  const printer = printerEntry ? keyValues(new TextDecoder().decode(await zip.read(printerEntry))) : {};
  const shape = geometry(number(printer, 'displaywidth'), number(printer, 'displayheight'),
    number(printer, 'displaypixelsx'), number(printer, 'displaypixelsy'), number(config, 'layerheight'));
  const layers = [...zip.entries.values()].filter(item => /^[^/\\]*\d{5,}\.png$/i.test(item.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  const metadata = result(/\.sl1s$/i.test(file.name) ? 'SL1S' : 'SL1', number(config, 'printtime') / 3600,
    number(config, 'usedmaterial'), config.printermodel || printer.printermodel || '', shape, layers.length,
    layers.length ? 'sl1' : null, layers.length ? '' : 'No supported root-level layer PNGs were found.');
  metadata.firstLayerHeightMm = positive(number(printer, 'initiallayerheight'), 5, 0.000001);
  return { metadata, zip, layers };
}
async function ctb(file) {
  const header = view(await bytes(file, 0, 112));
  const version = header.getUint32(4, true);
  if (header.getUint32(0, true) !== 0x12fd0086 || ![2, 3].includes(version)) {
    throw new Error('Only standard CTB v2/v3 headers are supported. Copy metrics from your slicer for other CTB variants.');
  }
  const count = header.getUint32(68, true);
  if (!count || count > 100000) throw new Error('Invalid CTB layer count.');
  const table = header.getUint32(64, true);
  if (table < 112 || table + count * 36 > file.size) throw new Error('Invalid CTB layer table bounds.');
  const parameters = header.getUint32(84, true), parameterSize = header.getUint32(88, true);
  let volumeMl = null, printerName = '';
  if (parameters) {
    if (parameterSize < 24 || parameterSize > 4096) throw new Error('Invalid CTB print parameter record.');
    volumeMl = view(await bytes(file, parameters, parameterSize)).getFloat32(20, true);
  }
  const slicer = header.getUint32(104, true), slicerSize = header.getUint32(108, true);
  if (slicer) {
    if (slicerSize < 36 || slicerSize > 4096) throw new Error('Invalid CTB slicer record.');
    const info = view(await bytes(file, slicer, slicerSize));
    const length = info.getUint32(32, true);
    if (length > 200) throw new Error('CTB printer name is too long.');
    if (length) printerName = text(await bytes(file, info.getUint32(28, true), length));
  }
  const shape = geometry(header.getFloat32(8, true), header.getFloat32(12, true), header.getUint32(52, true),
    header.getUint32(56, true), header.getFloat32(32, true));
  const supported = version === 2 && header.getUint32(100, true) === 0 && header.getUint32(92, true) === 1;
  const metadata = result(`CTB v${version}`, header.getUint32(76, true) / 3600, volumeMl, printerName, shape, count,
    supported ? 'ctb2' : null, 'Reconstruction requires unencrypted CTB v2 with a single image plane. Copy missing volume from your slicer.');
  if (supported) metadata.reason = '';
  return { metadata, table };
}
async function goo(file) {
  const prefix = await bytes(file, 0, 124);
  if (text(prefix.slice(0, 4)) !== 'V3.0' || [...prefix.slice(4, 12)].join() !== '7,0,0,0,68,76,80,0') {
    throw new Error('Only GOO V3.0 is supported. Copy metrics from your slicer for other GOO versions.');
  }
  const header = view(await bytes(file, 195310, 167));
  const count = header.getUint32(0, false);
  if (!count || count > 100000) throw new Error('Invalid GOO layer count.');
  return { metadata: result('GOO V3.0', header.getUint32(136, false) / 3600, header.getFloat32(140, false) / 1000,
    text(prefix.slice(92, 124)), geometry(header.getFloat32(10, false), header.getFloat32(14, false),
      header.getUint16(4, false), header.getUint16(6, false), header.getFloat32(22, false)), count, null,
    'GOO layer reconstruction is not supported in this release. Copy missing volume from your slicer.') };
}
function layerCount(value) {
  if (!Number.isInteger(value) || value < 1 || value > 100000) throw new Error('Invalid resin layer count.');
  return value;
}
async function anycubicTable(file, offset, name, minimum, includesHeader = false) {
  if (offset < 48) throw new Error(`Invalid Anycubic ${name} offset.`);
  const header = view(await bytes(file, offset, 16));
  if (text(new Uint8Array(header.buffer, 0, 12)) !== name) throw new Error(`Invalid Anycubic ${name} section marker.`);
  const length = header.getUint32(12, true) - (includesHeader ? 16 : 0);
  if (length < minimum || offset + 16 + length > file.size) throw new Error(`Invalid Anycubic ${name} section bounds.`);
  return { offset: offset + 16, length };
}
async function anycubic(file) {
  const prefix = view(await bytes(file, 0, 48));
  if (text(new Uint8Array(prefix.buffer, 0, 12)) !== 'ANYCUBIC') throw new Error('Invalid Photon Workshop file signature.');
  const version = prefix.getUint32(12, true);
  if (!anycubicVersions.includes(version)) throw new Error(`Unsupported Photon Workshop version ${version}. Use slicer values.`);
  const markLength = version >= 518 ? 64 : version >= 517 ? 56 : version >= 516 ? 52 : 48;
  await bytes(file, 0, markLength);
  const section = await anycubicTable(file, prefix.getUint32(20, true), 'HEADER', 80);
  if (section.length > 4096) throw new Error('Oversized Anycubic header.');
  const header = view(await bytes(file, section.offset, 80));
  const layerSection = await anycubicTable(file, prefix.getUint32(36, true), 'LAYERDEF', 4);
  const count = layerCount(view(await bytes(file, layerSection.offset, 4)).getUint32(0, true));
  if (layerSection.length !== 4 + count * 32) throw new Error('Invalid Anycubic layer table length.');
  let name = '', width = NaN, height = NaN;
  if (version >= 516 && prefix.getUint32(40, true)) {
    const machine = await anycubicTable(file, prefix.getUint32(40, true), 'MACHINE', 140, true);
    if (machine.length > 4096) throw new Error('Oversized Anycubic machine record.');
    const data = await bytes(file, machine.offset, 140), settings = view(data);
    name = text(data.slice(0, 96));
    width = settings.getFloat32(120, true); height = settings.getFloat32(124, true);
  }
  return { metadata: result(`Anycubic v${version}`, header.getUint32(68, true) / 3600, header.getFloat32(36, true), name,
    geometry(width, height, header.getUint32(44, true), header.getUint32(48, true), header.getFloat32(4, true)), count, null,
    'Photon Workshop layer reconstruction is not implemented. Copy missing metrics from the slicer; renaming an extension does not convert its format.') };
}
function jsonObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label} object.`);
  return value;
}
async function anycubicZip(file) {
  const zip = await archive(file);
  const readJSON = async (name, required = true, limit = MiB) => {
    const entry = zip.entries.get(name);
    if (!entry) {
      if (required) throw new Error(`Photon Workshop archive is missing ${name}.`);
      return {};
    }
    let parsed;
    try { parsed = JSON.parse(new TextDecoder().decode(await zip.read(entry, limit))); }
    catch (error) { throw new Error(`Cannot read ${name}: ${error.message}`); }
    return jsonObject(parsed, name);
  };
  const settings = await readJSON('anycubic_photon_resins.pwsp');
  if (!['1', '2', '3'].includes(String(settings.version))) throw new Error('Unsupported Photon Workshop ZIP settings version.');
  const machine = jsonObject(settings.machine_type, 'Photon Workshop machine');
  const controller = await readJSON('layers_controller.conf', true, 16 * MiB);
  if (!Array.isArray(controller.paras)) throw new Error('Invalid Photon Workshop layer metadata.');
  const count = layerCount(controller.paras.length);
  if (controller.count !== undefined && controller.count !== count) throw new Error('Photon Workshop layer count does not match its metadata.');
  const info = await readJSON('print_info.json', false);
  if (info.model_layers_count !== undefined && info.model_layers_count !== count) throw new Error('Photon Workshop print information has a mismatched layer count.');
  const firstLayer = jsonObject(controller.paras[0], 'first layer');
  const normalLayer = jsonObject(controller.paras[1] || firstLayer, 'normal layer');
  const metadata = result(`Anycubic ZIP v${settings.version}`, typeof info.print_time === 'number' ? info.print_time / 3600 : null,
    info.volume, typeof machine.name === 'string' ? machine.name : '',
    geometry(machine.print_xsize, machine.print_ysize, machine.res_x, machine.res_y, normalLayer.layer_thickness), count, null,
    'Photon Workshop ZIP layer reconstruction is not implemented. Copy missing volume or time from the slicer.');
  metadata.firstLayerHeightMm = positive(firstLayer.layer_thickness, 5, 0.000001);
  return { metadata };
}
async function photon(file) {
  const raw = await bytes(file, 0, 84), header = view(raw);
  const version = header.getUint32(4, true);
  if (header.getUint32(0, true) !== 0x12fd0019 || ![1, 2].includes(version)) throw new Error('Unsupported legacy Photon header/version.');
  const count = layerCount(header.getUint32(68, true)), table = header.getUint32(64, true);
  if (table < 84 || table + count * 36 > file.size) throw new Error('Invalid Photon layer table bounds.');
  let volume = null;
  if (version === 2) {
    const extra = view(await bytes(file, 84, 28)), address = extra.getUint32(0, true), length = extra.getUint32(4, true);
    if (address) {
      if (length < 24 || length > 4096) throw new Error('Invalid Photon print parameter bounds.');
      volume = view(await bytes(file, address, length)).getFloat32(20, true);
    }
  }
  return { metadata: result(`Photon v${version}`, header.getUint32(76, true) / 3600, volume, '',
    geometry(header.getFloat32(8, true), header.getFloat32(12, true), header.getUint32(52, true), header.getUint32(56, true),
      header.getFloat32(32, true)), count, null, 'Legacy Photon volume may be absent. Use slicer values; legacy layer reconstruction is not implemented.') };
}
async function photonS(file) {
  const header = view(await bytes(file, 0, 98));
  if (header.getUint32(0, false) !== 2 || header.getUint16(4, false) !== 49) throw new Error('Invalid legacy PhotonS header.');
  const previewPixels = header.getUint32(82, false) * header.getUint32(90, false);
  if (previewPixels > 40000000) throw new Error('Invalid PhotonS preview dimensions.');
  const table = 98 + previewPixels * 2;
  const count = layerCount(view(await bytes(file, table, 4)).getUint32(0, false));
  if (table + 4 + count * 28 > file.size) throw new Error('Invalid PhotonS layer metadata bounds.');
  const layer = view(await bytes(file, table + 4, 28));
  const pixelsX = layer.getUint32(12, false), pixelsY = layer.getUint32(16, false), pitch = header.getFloat64(6, false);
  return { metadata: result('PhotonS', null, header.getFloat64(74, false), '',
    geometry(pitch * pixelsX, pitch * pixelsY, pixelsX, pixelsY, header.getFloat64(14, false)), count, null,
    'Legacy PhotonS has no stored total print time. Enter the slicer time; layer reconstruction is not implemented.') };
}
async function inspect(file) {
  if (!resinExtensions.test(file.name)) throw new Error('Unsupported resin extension. Use supported Photon Workshop, Photon/PhotonS, SL1/SL1S, GOO V3.0 or CTB v2/v3 files.');
  if (file.size > 2 * 1024 * MiB) throw new Error('Maximum resin file size is 2 GiB.');
  if (/\.sl1s?$/i.test(file.name)) return sl1(file);
  const extension = file.name.split('.').at(-1).toLowerCase();
  if (photonWorkshopExtensions.includes(extension)) return anycubic(file);
  if (photonWorkshopZipExtensions.includes(extension)) return anycubicZip(file);
  if (extension === 'photon') return photon(file);
  if (extension === 'photons') return photonS(file);
  return /\.ctb$/i.test(file.name) ? ctb(file) : goo(file);
}
export async function inspectResin(file) {
  return (await inspect(file)).metadata;
}
export function reconstructionGeometry(source) {
  const shape = geometry(Number(source.widthMm), Number(source.heightMm), Number(source.pixelsX),
    Number(source.pixelsY), Number(source.layerHeightMm));
  if (Object.values(shape).some(value => value === null)) throw new Error('Enter valid display dimensions, resolution and layer height before reconstruction.');
  if (shape.pixelsX * shape.pixelsY > 40000000) throw new Error('Reconstruction is limited to 40 million pixels per layer. Use slicer metrics for larger screens.');
  return shape;
}
export function ctbCoverage(data, pixels) {
  let offset = 0, count = 0, weighted = 0;
  while (offset < data.length) {
    const value = data[offset++], intensity = value & 127;
    let run = 1;
    if (value & 128) {
      if (offset >= data.length) throw new Error('Truncated CTB pixel run.');
      const lead = data[offset++];
      let extra;
      if (lead < 128) { run = lead; extra = 0; }
      else if (lead < 192) { run = lead & 63; extra = 1; }
      else if (lead < 224) { run = lead & 31; extra = 2; }
      else if (lead < 240) { run = lead & 15; extra = 3; }
      else throw new Error('Invalid CTB pixel run.');
      if (offset + extra > data.length) throw new Error('Truncated CTB pixel run.');
      for (let index = 0; index < extra; index++) run = run * 256 + data[offset++];
    }
    if (!run || count + run > pixels) throw new Error('CTB image runs exceed the declared resolution.');
    count += run; weighted += intensity / 127 * run;
  }
  if (count !== pixels) throw new Error('CTB layer does not fill the declared resolution.');
  return weighted;
}
export async function reconstructResin(file, suppliedGeometry, progress = () => {}) {
  const { metadata, zip, layers, table } = await inspect(file);
  if (!metadata.reconstruction) throw new Error(metadata.reason);
  const shape = reconstructionGeometry(suppliedGeometry);
  const pixels = shape.pixelsX * shape.pixelsY;
  const firstHeight = positive(Number(suppliedGeometry.firstLayerHeightMm), 5, 0.000001);
  if (!firstHeight) throw new Error('Enter the first-layer height from your slicer.');
  if (metadata.layers > 20000 || (layers && metadata.layers * pixels > 40000000000)) throw new Error('Reconstruction exceeds the browser work limit. Use slicer metrics instead.');
  const deadline = Date.now() + 120000;
  let volume = 0, previousZ = 0, readSize = 0;
  const records = table === undefined ? null : view(await bytes(file, table, metadata.layers * 36));
  for (let index = 0; index < metadata.layers; index++) {
    if (Date.now() > deadline) throw new Error('Reconstruction exceeded two minutes. Use slicer metrics instead.');
    let coverage, height = index ? shape.layerHeightMm : firstHeight;
    if (zip) {
      const image = await zip.read(layers[index], 16 * MiB);
      readSize += image.length;
      const png = view(image);
      if (image.length < 24 || png.getUint32(0) !== 0x89504e47 || png.getUint32(4) !== 0x0d0a1a0a ||
        png.getUint32(16) * png.getUint32(20) !== pixels) throw new Error('SL1 PNG dimensions do not match the confirmed printer resolution.');
      const bitmap = await createImageBitmap(new Blob([image], { type: 'image/png' }));
      try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('This browser cannot read layer images.');
        context.drawImage(bitmap, 0, 0);
        const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
        coverage = 0;
        for (let pixel = 0; pixel < rgba.length; pixel += 4) {
          if (rgba[pixel] !== rgba[pixel + 1] || rgba[pixel] !== rgba[pixel + 2] || rgba[pixel + 3] !== 255) {
            throw new Error('Reconstruction requires opaque grayscale layer PNGs.');
          }
          coverage += rgba[pixel] / 255;
        }
      } finally { bitmap.close(); }
    } else {
      const record = index * 36, z = records.getFloat32(record, true);
      height = index === 0 && z === 0 ? firstHeight : z - previousZ;
      if (!positive(height, 5)) throw new Error('CTB layer heights are invalid or not increasing.');
      previousZ = z;
      const length = records.getUint32(record + 16, true);
      if (length > 16 * MiB) throw new Error('CTB layer exceeds the reconstruction limit.');
      readSize += length;
      if (readSize > 512 * MiB) throw new Error('Reconstruction exceeds the data limit.');
      coverage = ctbCoverage(await bytes(file, records.getUint32(record + 12, true), length), pixels);
    }
    if (readSize > 512 * MiB) throw new Error('Reconstruction exceeds the data limit.');
    volume += coverage / pixels * shape.widthMm * shape.heightMm * height / 1000;
    progress(Math.round((index + 1) / metadata.layers * 100));
  }
  if (!positive(volume)) throw new Error('No positive resin volume could be reconstructed.');
  return volume;
}
