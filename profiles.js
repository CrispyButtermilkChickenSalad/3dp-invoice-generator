import { calculate, uid, currencies } from './core.js';
import { resinFormats } from './resin.js';

export const printerCatalogue = [
  ['Bambu Lab', ['A1 mini', 'A1', 'P1P', 'P1S', 'P2S', 'X1 Carbon', 'X1E', 'H2D', 'H2S']],
  ['Prusa', ['MINI+', 'MK3S+', 'MK3.5S', 'MK4', 'MK4S', 'CORE One', 'XL']],
  ['Creality', ['Ender-3 V2', 'Ender-3 S1', 'Ender-3 V3 SE', 'Ender-3 V3 KE', 'Ender-3 V3', 'K1', 'K1C', 'K1 Max', 'K2 Plus']],
  ['Elegoo', ['Neptune 3 Pro', 'Neptune 4', 'Neptune 4 Pro', 'Neptune 4 Plus', 'Neptune 4 Max', 'Centauri Carbon']],
  ['Anycubic', ['Kobra 2', 'Kobra 2 Pro', 'Kobra 2 Max', 'Kobra 3']],
  ['Flashforge', ['Adventurer 5M', 'Adventurer 5M Pro']],
  ['QIDI', ['Q1 Pro', 'Plus4', 'X-Max 3']],
  ['Sovol', ['SV06', 'SV07', 'SV08']],
  ['Voron', ['0.2', 'Trident', '2.4']],
].flatMap(([brand, models]) => models.map(model => ({ id: `${brand} ${model}`, name: `${brand} ${model}`, brand, technology: 'fdm' }))).concat([
  ['Elegoo', ['Mars 4', 'Mars 5 Ultra', 'Saturn 3 Ultra', 'Saturn 4 Ultra']],
  ['Anycubic', ['Photon Mono M5s', 'Photon Mono M7 Pro']],
  ['Phrozen', ['Sonic Mini 8K S', 'Sonic Mighty 8K']],
  ['Formlabs', ['Form 4']],
].flatMap(([brand, models]) => models.map(model => ({ id: `${brand} ${model}`, name: `${brand} ${model}`, brand, technology: 'resin' }))));

const first = value => Array.isArray(value) ? value[0] : value;
function presetMetadata(data, fallback) {
  const identity = first(data.printer_model) || first(data.printer_settings_id) || data.name || fallback;
  const name = String(data.name || first(data.printer_settings_id) || identity).replace(/^"|"$/g, '').trim();
  if (!name || name.length > 200) throw new Error('Printer preset name is missing or too long.');
  const nozzle = Number.parseFloat(first(data.nozzle_diameter));
  const model = String(first(data.printer_model) || identity).replace(/^"|"$/g, '').trim();
  if (model.length > 200) throw new Error('Printer model name is too long.');
  const parts = [model];
  if (Number.isFinite(nozzle) && nozzle > 0 && nozzle <= 3) parts.push(`${nozzle} mm nozzle`);
  const area = data.printable_area || data.bed_shape;
  if (area) {
    const points = (Array.isArray(area) ? area : String(area).split(',')).map(point => String(point).split('x').map(Number));
    if (points.length >= 3 && points.every(point => point.length === 2 && point.every(Number.isFinite))) {
      const width = Math.max(...points.map(point => point[0])) - Math.min(...points.map(point => point[0]));
      const depth = Math.max(...points.map(point => point[1])) - Math.min(...points.map(point => point[1]));
      if (width > 0 && depth > 0) parts.push(`${width} × ${depth} mm bed`);
    }
  }
  const geometry = Object.fromEntries(['display_width', 'display_height', 'display_pixels_x', 'display_pixels_y']
    .map((key, index) => [['widthMm', 'heightMm', 'pixelsX', 'pixelsY'][index], Number(first(data[key]))]));
  return { name, model: parts.join(' · '), source: 'Slicer preset', technology: /^(SLA|MSLA|DLP)$/i.test(String(data.printer_technology || '')) ? 'resin' : 'fdm',
    ...(Object.values(geometry).every(value => Number.isFinite(value) && value > 0) ? { geometry: printerGeometry(geometry) } : {}) };
}

export function parsePrinterPresets(text, filename = 'printer.json') {
  let candidates;
  if (/\.json$/i.test(filename)) {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Invalid JSON. Export a printer preset as JSON or INI, not a ZIP or 3MF bundle.'); }
    candidates = Array.isArray(data) ? data : Array.isArray(data?.machine) ? data.machine : [data];
    candidates = candidates.filter(item => item && typeof item === 'object' && !Array.isArray(item) &&
      (!item.type || item.type === 'machine') && (item.type === 'machine' || item.printer_model || item.printer_settings_id || (item.nozzle_diameter && (item.bed_shape || item.printable_area))));
  } else if (/\.(ini|cfg)$/i.test(filename)) {
    candidates = [];
    let section = {};
    let sectionName = '';
    const push = () => {
      if (/^printer(?::|$)/i.test(sectionName) && !/^printer:\*/i.test(sectionName) && (/^printer:.+/i.test(sectionName) || section.printer_model || section.printer_settings_id)) candidates.push({ ...section, name: sectionName.replace(/^printer:*/i, '') || section.printer_settings_id || section.printer_model });
    };
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || /^[;#]/.test(line)) continue;
      const heading = line.match(/^\[([^\]]+)\]$/);
      if (heading) { push(); sectionName = heading[1]; section = {}; continue; }
      const pair = line.match(/^([a-z_]+)\s*=\s*(.*)$/i);
      if (pair && ['printer_model', 'printer_settings_id', 'nozzle_diameter', 'bed_shape', 'printer_technology', 'display_width', 'display_height', 'display_pixels_x', 'display_pixels_y'].includes(pair[1])) section[pair[1]] = pair[2].replace(/^"|"$/g, '');
    }
    push();
    if (!sectionName && (section.printer_model || section.printer_settings_id)) candidates.push(section);
  } else {
    throw new Error('Use an OrcaSlicer/Bambu Studio printer JSON or a PrusaSlicer/SuperSlicer INI file.');
  }
  if (!candidates.length) throw new Error('No printer presets found. Filament and process presets are not printer profiles.');
  if (candidates.length > 500) throw new Error('Import at most 500 printer presets at once.');
  return candidates.map(item => presetMetadata(item, filename.replace(/\.[^.]+$/, '')));
}

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}
function string(value, label, max = 10000) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} must be text of at most ${max} characters.`);
  return value;
}
function identifier(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new Error('Invalid record ID.');
  return value;
}
function number(value, label, min = 0, max = 1e9) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${label}.`);
  return value;
}
function boolean(value, label) {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${label}.`);
  return value;
}
function list(value, label, reader, min = 0, max = 1000) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`Invalid ${label} list.`);
  const items = value.map(reader);
  const ids = items.filter(item => item.id).map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate IDs in ${label}.`);
  return items;
}
function date(value, label, optional = false) {
  if (optional && value === '') return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error(`Invalid ${label}.`);
  return value;
}
function color(value) {
  if (typeof value !== 'string' || !/^#[a-f\d]{6}$/i.test(value)) throw new Error('Invalid colour.');
  return value;
}
function customer(value) {
  record(value, 'Customer');
  const result = {};
  for (const key of ['name', 'email', 'company', 'address', 'abn']) result[key] = string(value[key], `Customer ${key}`);
  if (value.id !== undefined) result.id = identifier(value.id);
  return result;
}
function studio(value) {
  record(value, 'Studio');
  const currency = value.currency ?? 'AUD';
  if (!currencies.includes(currency)) throw new Error('Unsupported studio currency.');
  return { ...Object.fromEntries(['name', 'email', 'address', 'abn'].map(key => [key, string(value[key], `Studio ${key}`)])), currency };
}
function printerGeometry(value) {
  record(value, 'Printer geometry');
  const parsed = { widthMm: number(value.widthMm, 'display width', 0.001, 2000), heightMm: number(value.heightMm, 'display height', 0.001, 2000),
    pixelsX: number(value.pixelsX, 'display resolution X', 1, 32768), pixelsY: number(value.pixelsY, 'display resolution Y', 1, 32768) };
  if (!Number.isInteger(parsed.pixelsX) || !Number.isInteger(parsed.pixelsY)) throw new Error('Display resolution must be whole pixels.');
  return parsed;
}
function resinImport(value) {
  record(value, 'Resin metadata');
  if (!resinFormats.includes(value.format)) throw new Error('Invalid resin format.');
  if (![null, 'sl1', 'ctb2'].includes(value.reconstruction)) throw new Error('Invalid reconstruction method.');
  for (const key of ['volumeSource', 'hoursSource']) {
    if (!(key === 'volumeSource' ? ['slicer', 'manual', 'missing', 'reconstructed'] : ['slicer', 'manual', 'missing']).includes(value[key])) throw new Error('Invalid resin metric source.');
  }
  record(value.geometry, 'Resin geometry');
  const geometry = Object.fromEntries(['widthMm', 'heightMm', 'pixelsX', 'pixelsY', 'layerHeightMm'].map(key =>
    [key, value.geometry[key] === null ? null : number(value.geometry[key], key, key.startsWith('pixels') ? 1 : key === 'layerHeightMm' ? 0.000001 : 0.001, key.startsWith('pixels') ? 32768 : key === 'layerHeightMm' ? 5 : 2000)]));
  if (['pixelsX', 'pixelsY'].some(key => geometry[key] !== null && !Number.isInteger(geometry[key]))) throw new Error('Invalid resin image resolution.');
  return { format: value.format, printerName: string(value.printerName, 'Slicer printer name', 200), geometry,
    layers: number(value.layers, 'resin layer count', 0, 100000), reconstruction: value.reconstruction,
    reason: string(value.reason, 'Reconstruction availability', 1000), volumeSource: value.volumeSource, hoursSource: value.hoursSource,
    fileSize: number(value.fileSize, 'resin file size', 0, 2 * 1024 ** 3),
    firstLayerHeightMm: value.firstLayerHeightMm == null ? null : number(value.firstLayerHeightMm, 'first layer height', 0.000001, 5) };
}
function printer(value) {
  record(value, 'Printer');
  const technology = value.technology ?? 'fdm';
  if (!['fdm', 'resin'].includes(technology)) throw new Error('Invalid printer technology.');
  return { id: identifier(value.id), name: string(value.name, 'Printer name', 200), model: string(value.model, 'Printer description'),
    watts: number(value.watts, 'wattage'), price: number(value.price, 'printer price'), lifetime: number(value.lifetime, 'printer lifetime', 1),
    maintenance: number(value.maintenance, 'maintenance'), color: color(value.color), technology,
    favourite: value.favourite === undefined ? false : boolean(value.favourite, 'printer favourite'),
    ...(value.geometry === undefined ? {} : { geometry: printerGeometry(value.geometry) }),
    ...Object.fromEntries(['fepPerPlate', 'ipaPerPlate', 'ppePerPlate', 'lcdPerHour', 'washWatts', 'cureWatts'].map(key => [key, value[key] === undefined ? 0 : number(value[key], key)])),
    ...(value.source !== undefined ? { source: string(value.source, 'Preset source', 200) } : {}) };
}
function filament(value) {
  record(value, 'Filament');
  const kind = value.kind ?? 'filament';
  if (!['filament', 'resin'].includes(kind)) throw new Error('Invalid material type.');
  return { id: identifier(value.id), name: string(value.name, 'Material name', 200), brand: string(value.brand, 'Brand', 200),
    color: color(value.color), colorName: string(value.colorName, 'Colour name', 200), price: number(value.price, 'spool price'),
    kind, favourite: value.favourite === undefined ? false : boolean(value.favourite, 'material favourite'),
    ...(kind === 'resin' ? { bottleVolume: number(value.bottleVolume, 'bottle volume', 1), wastePercent: number(value.wastePercent ?? 0, 'resin residue allowance') } :
      { spoolWeight: number(value.spoolWeight, 'spool weight', 1), density: number(value.density, 'density', 0.01), diameter: number(value.diameter, 'diameter', 0.1) }) };
}
function job(value) {
  record(value, 'Invoice');
  const result = { id: identifier(value.id), customer: customer(value.customer), sections: {}, plates: [], sample: boolean(value.sample, 'example flag') };
  result.currency = value.currency ?? 'AUD';
  if (!currencies.includes(result.currency)) throw new Error('Unsupported invoice currency.');
  for (const key of ['name', 'number', 'notes', 'payment']) result[key] = string(value[key], `Invoice ${key}`);
  if (result.sample && result.name === 'A little more organised') result.name = 'Desktop organiser set';
  result.date = date(value.date, 'invoice date');
  result.dueDate = date(value.dueDate, 'due date', true);
  if (!['individual', 'business'].includes(value.customerType)) throw new Error('Invalid customer type.');
  result.customerType = value.customerType;
  for (const key of ['prepMinutes', 'finishMinutes', 'labourRate', 'energyRate', 'markup', 'packaging', 'other', 'shipping']) result[key] = number(value[key], key);
  result.failureRate = number(value.failureRate, 'failure allowance', 0, 95);
  result.taxRate = number(value.taxRate, 'GST rate', 0, 100);
  result.taxEnabled = boolean(value.taxEnabled, 'GST setting');
  record(value.sections, 'Invoice sections');
  for (const key of ['address', 'business', 'metrics', 'payment', 'notes']) result.sections[key] = boolean(value.sections[key], `${key} section`);
  result.sections.processing = value.sections.processing === undefined ? true : boolean(value.sections.processing, 'processing section');
  result.prepDescription = value.prepDescription === undefined ? 'Model checks, orientation and slicing.' : string(value.prepDescription, 'Pre-processing description', 1000);
  result.finishDescription = value.finishDescription === undefined ? 'Support removal and surface cleanup.' : string(value.finishDescription, 'Post-processing description', 1000);
  result.otherDescription = value.otherDescription === undefined ? '' : string(value.otherDescription, 'Other job costs description', 1000);
  const modelling = value.modelling ?? { enabled: false, mode: 'hourly', hours: 0, rate: 50, fixedFee: 0, description: '' };
  record(modelling, 'Modelling');
  if (!['hourly', 'fixed'].includes(modelling.mode)) throw new Error('Invalid modelling fee mode.');
  result.modelling = { enabled: boolean(modelling.enabled, 'modelling setting'), mode: modelling.mode,
    hours: number(modelling.hours, 'modelling hours'), rate: number(modelling.rate, 'modelling rate'),
    fixedFee: number(modelling.fixedFee, 'fixed modelling fee'), description: string(modelling.description, 'modelling description', 1000) };
  if (result.sample && result.notes === 'Thank you for supporting a small print studio. Made layer by layer, just for you.') result.notes = '';
  result.plates = list(value.plates, 'plates', plate => {
    record(plate, 'Plate');
    const quantity = number(plate.quantity, 'plate quantity', 1);
    if (!Number.isInteger(quantity)) throw new Error('Plate quantity must be a whole number.');
    const technology = plate.technology ?? 'fdm';
    if (!['fdm', 'resin'].includes(technology)) throw new Error('Invalid plate technology.');
    return { id: identifier(plate.id), name: string(plate.name, 'Plate name'), detail: string(plate.detail, 'Plate filename'),
      hours: number(plate.hours, 'print time'), grams: number(plate.grams, 'filament weight'), quantity,
      technology, volumeMl: number(plate.volumeMl ?? 0, 'resin volume'), washMinutes: number(plate.washMinutes ?? 0, 'wash time'), cureMinutes: number(plate.cureMinutes ?? 0, 'cure time'),
      printerId: identifier(plate.printerId), filamentId: identifier(plate.filamentId), verified: boolean(plate.verified, 'plate review flag'),
      ...(plate.lengthMm !== undefined && plate.lengthMm !== null ? { lengthMm: number(plate.lengthMm, 'filament length', 0, Number.MAX_SAFE_INTEGER) } : {}),
      ...(plate.resinImport === undefined ? {} : { resinImport: resinImport(plate.resinImport) }) };
  });
  return result;
}
function snapshot(value) {
  record(value, 'Invoice snapshot');
  const result = { job: job(value.job), printers: list(value.printers, 'printers', printer, 0, 500), filaments: list(value.filaments, 'filaments', filament, 0, 500), studio: studio(value.studio) };
  calculate(result.job, result.printers, result.filaments);
  return result;
}

export function removeProfile(workspace, type, id) {
  if (!['printer', 'filament'].includes(type)) throw new Error('Invalid profile type.');
  const collection = type === 'printer' ? workspace.printers : workspace.filaments;
  const index = collection.findIndex(item => item.id === id);
  if (index < 0) throw new Error('This profile no longer exists.');
  const reference = type === 'printer' ? 'printerId' : 'filamentId';
  if (workspace.job.plates.some(plate => plate[reference] === id)) {
    throw new Error('Reassign or remove plates using this profile before removing it.');
  }
  collection.splice(index, 1);
}

export function rememberCustomer(workspace, invoice) {
  if (!invoice.customer.name.trim()) return null;
  const details = invoice.customer;
  const normalized = value => value.trim().toLowerCase();
  let existing = workspace.customers.find(item => details.id && item.id === details.id);
  if (!existing) existing = workspace.customers.find(item =>
    normalized(item.company) === normalized(details.company) &&
    (details.email.trim() ? normalized(item.email) === normalized(details.email) : normalized(item.name) === normalized(details.name)));
  const saved = { ...details, id: existing?.id || uid(), type: invoice.customerType,
    lastInvoiceDate: existing?.lastInvoiceDate > invoice.date ? existing.lastInvoiceDate : invoice.date,
    invoiceIds: [...new Set([...(existing?.invoiceIds || []), invoice.id])] };
  if (existing) workspace.customers[workspace.customers.indexOf(existing)] = saved;
  else workspace.customers.push(saved);
  invoice.customer.id = saved.id;
  return saved;
}

export function readWorkspace(input) {
  record(input, 'Backup');
  if (input.format !== undefined && (input.format !== 'layer-workspace' || ![2, 3].includes(input.schemaVersion))) throw new Error('Unsupported backup format or schema version.');
  const raw = input.format === 'layer-workspace' ? input.state : input;
  record(raw, 'Workspace');
  if (![1, 2, 3].includes(raw.version)) throw new Error('Unsupported workspace version.');
  const current = snapshot(raw);
  const result = { version: 3, ...current, saved: list(raw.saved, 'invoices', snapshot),
    customers: [], settings: { theme: 'dark', libraryViews: { customers: 'list', printers: 'grid', filaments: 'grid' } } };
  const savedIds = result.saved.map(item => item.job.id);
  if (new Set(savedIds).size !== savedIds.length) throw new Error('Duplicate saved invoice IDs.');
  if (raw.version >= 2) {
    result.customers = list(raw.customers, 'customers', value => {
      const parsed = customer(value);
      parsed.id = identifier(value.id);
      if (!['individual', 'business'].includes(value.type)) throw new Error('Invalid saved customer type.');
      return { ...parsed, type: value.type, lastInvoiceDate: date(value.lastInvoiceDate, 'customer invoice date'),
        invoiceIds: list(value.invoiceIds, 'customer invoice IDs', identifier) };
    });
    if (!['dark', 'light'].includes(raw.settings?.theme)) throw new Error('Invalid theme setting.');
    result.settings.theme = raw.settings.theme;
    if (raw.settings.libraryViews !== undefined) {
      record(raw.settings.libraryViews, 'Library views');
      for (const key of ['customers', 'printers', 'filaments']) {
        if (!['grid', 'list'].includes(raw.settings.libraryViews[key])) throw new Error('Invalid library view.');
        result.settings.libraryViews[key] = raw.settings.libraryViews[key];
      }
    }
  } else {
    for (const item of [...result.saved].reverse()) rememberCustomer(result, item.job);
  }
  return result;
}

export function workspaceBackup(workspace) {
  return { format: 'layer-workspace', schemaVersion: 3, exportedAt: new Date().toISOString(), state: readWorkspace(workspace) };
}
