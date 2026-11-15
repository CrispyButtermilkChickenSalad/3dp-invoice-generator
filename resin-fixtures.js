import { crc32 } from './resin.js';

const encode = value => new TextEncoder().encode(value);
export function ctbFixture({ version = 2, volume = 12.5, encrypted = false, corruptRun = false } = {}) {
  const output = new Uint8Array(1024), data = new DataView(output.buffer);
  data.setUint32(0, 0x12fd0086, true); data.setUint32(4, version, true);
  data.setFloat32(8, 100, true); data.setFloat32(12, 50, true); data.setFloat32(32, 0.05, true);
  data.setUint32(52, 2, true); data.setUint32(56, 2, true);
  data.setUint32(64, 512, true); data.setUint32(68, 2, true); data.setUint32(76, 3600, true);
  data.setUint32(84, 112, true); data.setUint32(88, 60, true); data.setUint32(92, 1, true);
  data.setUint32(100, encrypted ? 123 : 0, true); data.setUint32(104, 172, true); data.setUint32(108, 80, true);
  data.setFloat32(132, volume, true);
  const name = encode('Test resin printer');
  data.setUint32(200, 300, true); data.setUint32(204, name.length, true); output.set(name, 300);
  for (let layer = 0; layer < 2; layer++) {
    const record = 512 + layer * 36;
    data.setFloat32(record, (layer + 1) * 0.05, true);
    data.setUint32(record + 12, 800 + layer * 4, true); data.setUint32(record + 16, 4, true);
    output.set([255, corruptRun ? 5 : 2, 128, 2], 800 + layer * 4);
  }
  return new File([output], 'test.ctb');
}
export function gooFixture({ volume = 12500, time = 5400, version = 'V3.0' } = {}) {
  const output = new Uint8Array(195500), data = new DataView(output.buffer);
  output.set(encode(version)); output.set([7, 0, 0, 0, 68, 76, 80, 0], 4); output.set(encode('Test GOO printer'), 92);
  data.setUint32(195310, 100, false); data.setUint16(195314, 4098, false); data.setUint16(195316, 2560, false);
  data.setFloat32(195320, 143.43, false); data.setFloat32(195324, 89.6, false); data.setFloat32(195332, 0.05, false);
  data.setUint32(195446, time, false); data.setFloat32(195450, volume, false);
  return new File([output], 'test.goo');
}
export async function zipFixture(items, name = 'test.sl1', compressed = false) {
  const records = [], parts = [];
  let offset = 0;
  for (const [filename, value] of Object.entries(items)) {
    const original = typeof value === 'string' ? encode(value) : value, path = encode(filename);
    const data = compressed ? new Uint8Array(await new Response(new Blob([original]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()) : original;
    const header = new Uint8Array(30 + path.length), local = new DataView(header.buffer);
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(8, compressed ? 8 : 0, true);
    local.setUint32(14, crc32(original), true); local.setUint32(18, data.length, true); local.setUint32(22, original.length, true);
    local.setUint16(26, path.length, true); header.set(path, 30);
    const record = new Uint8Array(46 + path.length), central = new DataView(record.buffer);
    central.setUint32(0, 0x02014b50, true); central.setUint16(4, 20, true); central.setUint16(6, 20, true);
    central.setUint16(10, compressed ? 8 : 0, true); central.setUint32(16, crc32(original), true);
    central.setUint32(20, data.length, true); central.setUint32(24, original.length, true); central.setUint16(28, path.length, true);
    central.setUint32(42, offset, true); record.set(path, 46); records.push(record);
    parts.push(header, data); offset += header.length + data.length;
  }
  const end = new Uint8Array(22), footer = new DataView(end.buffer);
  footer.setUint32(0, 0x06054b50, true); footer.setUint16(8, records.length, true); footer.setUint16(10, records.length, true);
  footer.setUint32(12, records.reduce((sum, item) => sum + item.length, 0), true); footer.setUint32(16, offset, true);
  return new File([...parts, ...records, end], name);
}
export async function sl1Fixture({ volume = 1.25, time = 7200, compressed = false, images = false, name = 'test.sl1' } = {}) {
  const items = {
    'config.ini': `printerModel = Test resin printer\nprintTime = ${time}\nusedMaterial = ${volume}\nlayerHeight = 0.05`,
    'prusaslicer.ini': 'display_width = 10\ndisplay_height = 20\ndisplay_pixels_x = 2\ndisplay_pixels_y = 2\ninitial_layer_height = 0.05',
  };
  if (images) {
    const canvas = new OffscreenCanvas(2, 2), context = canvas.getContext('2d');
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255, 128, 128, 128, 255, 0, 0, 0, 255]);
    context.putImageData(new ImageData(rgba, 2, 2), 0, 0);
    items['test00000.png'] = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
    context.fillStyle = 'white'; context.fillRect(0, 0, 2, 2);
    items['test00001.png'] = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
  }
  return zipFixture(items, name, compressed);
}
export function anycubicFixture({ version = 518, extension = 'm5sp', volume = 12.5, time = 5400 } = {}) {
  const output = new Uint8Array(1024), data = new DataView(output.buffer);
  const section = (offset, marker, size) => { output.set(encode(marker), offset); data.setUint32(offset + 12, size, true); };
  output.set(encode('ANYCUBIC'));
  data.setUint32(12, version, true); data.setUint32(16, 11, true);
  data.setUint32(20, 128, true); data.setUint32(36, 512, true);
  if (version >= 516) data.setUint32(40, 256, true);
  section(128, 'HEADER', 80);
  data.setFloat32(144, 16.8, true); data.setFloat32(148, 0.05, true);
  data.setFloat32(180, volume, true); data.setUint32(188, 13312, true); data.setUint32(192, 5120, true);
  data.setUint32(212, time, true);
  if (version >= 516) {
    section(256, 'MACHINE', 156);
    output.set(encode('Anycubic Photon Mono M5s Pro'), 272);
    data.setFloat32(392, 223.6416, true); data.setFloat32(396, 126.976, true);
  }
  section(512, 'LAYERDEF', 68); data.setUint32(528, 2, true);
  for (let layer = 0; layer < 2; layer++) {
    data.setUint32(532 + layer * 32, 900 + layer, true);
    data.setUint32(536 + layer * 32, 1, true);
  }
  return new File([output], `fixture.${extension}`);
}
export async function anycubicZipFixture({ extension = 'pwsz', version = '3', volume = 25.75, time = 7200, missingInfo = false, compressed = true, layers = 2 } = {}) {
  const items = {
    'anycubic_photon_resins.pwsp': JSON.stringify({ version, machine_type: { name: 'Anycubic Photon Mono M7 Pro',
      res_x: 13312, res_y: 5120, print_xsize: 223.6416, print_ysize: 126.976 } }),
    'layers_controller.conf': JSON.stringify({ count: layers, paras: Array.from({ length: layers }, (_, index) =>
      ({ layer_index: index, layer_thickness: index ? 0.05 : 0.1 })) }),
    'layer_images/1.pwszImg': new Uint8Array([0]),
  };
  if (!missingInfo) items['print_info.json'] = JSON.stringify({ model_layers_count: layers, print_time: time, volume });
  return zipFixture(items, `fixture.${extension}`, compressed);
}
export async function photonFixture(version = 1) {
  const bytes = new Uint8Array(await ctbFixture().arrayBuffer()), data = new DataView(bytes.buffer);
  data.setUint32(0, 0x12fd0019, true); data.setUint32(4, version, true);
  return new File([bytes], 'legacy.photon');
}
export function photonSFixture() {
  const output = new Uint8Array(512), data = new DataView(output.buffer);
  data.setUint32(0, 2); data.setUint16(4, 49); data.setFloat64(6, 0.04725);
  data.setFloat64(14, 0.05); data.setFloat64(74, 15.5);
  data.setUint32(82, 1); data.setUint32(90, 1);
  data.setUint32(100, 2);
  data.setUint32(116, 1440); data.setUint32(120, 2560);
  return new File([output], 'legacy.photons');
}
