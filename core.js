export const currencies = ['AUD', 'USD', 'EUR', 'GBP', 'CAD', 'NZD', 'SGD', 'JPY', 'CNY', 'INR', 'CHF', 'SEK', 'NOK', 'DKK', 'ZAR'];
export const currencyDigits = (currency = 'AUD') => new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
export const money = (value, currency = 'AUD') => new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(value);
export const printerTechnology = printer => printer.technology || 'fdm';
export const materialKind = material => material.kind || 'filament';
export const favouritesFirst = items => [...items].sort((a, b) => Number(Boolean(b.favourite)) - Number(Boolean(a.favourite)) || a.name.localeCompare(b.name));
export function normalizeHex(value) {
  const hex = String(value).trim().replace(/^#/, '');
  if (!/^(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(hex)) return null;
  return '#' + (hex.length === 3 ? [...hex].map(char => char + char).join('') : hex).toLowerCase();
}
export const uid = () => crypto.randomUUID();
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const duration = hours => {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
const roundMoney = (value, digits = 2) => {
  const [base, exponent = '0'] = String(value).split('e');
  const [rounded, shiftedExponent = '0'] = String(Math.round(Number(`${base}e${Number(exponent) + digits}`))).split('e');
  return Number(`${rounded}e${Number(shiftedExponent) - digits}`);
};
function requireNumber(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be a number between ${min} and ${max}.`);
}

export function calculate(job, printers, filaments) {
  const currency = job.currency || 'AUD';
  if (!currencies.includes(currency)) throw new Error('Unsupported invoice currency.');
  const cents = value => roundMoney(value, currencyDigits(currency));
  for (const key of ['energyRate', 'prepMinutes', 'finishMinutes', 'labourRate', 'packaging', 'other', 'markup', 'shipping']) requireNumber(job[key], key);
  requireNumber(job.failureRate, 'Failure allowance', 0, 95);
  requireNumber(job.taxRate, 'GST rate', 0, 100);
  const lines = job.plates.map(plate => {
    const printer = printers.find(item => item.id === plate.printerId);
    const filament = filaments.find(item => item.id === plate.filamentId);
    if (!printer || !filament) throw new Error(`Choose a valid printer and material for ${plate.name}.`);
    const technology = printerTechnology(printer);
    const resin = technology === 'resin';
    if ((plate.technology || 'fdm') !== technology || (materialKind(filament) === 'resin') !== resin) throw new Error(`Printer, material and plate technology must match for ${plate.name}.`);
    requireNumber(plate.hours, 'Print time');
    requireNumber(plate.grams, 'Filament weight');
    if (resin) requireNumber(plate.volumeMl, 'Resin volume');
    requireNumber(plate.quantity, 'Plate quantity', 1);
    if (!Number.isInteger(plate.quantity)) throw new Error('Plate quantity must be a whole number.');
    requireNumber(printer.watts, 'Printer wattage');
    requireNumber(printer.price, 'Printer price');
    requireNumber(printer.lifetime, 'Printer lifetime', 1);
    requireNumber(printer.maintenance, 'Printer upkeep');
    requireNumber(filament.price, 'Spool price');
    requireNumber(resin ? filament.bottleVolume : filament.spoolWeight, resin ? 'Bottle volume' : 'Spool weight', 1);
    const hours = plate.hours * plate.quantity;
    const grams = resin ? 0 : plate.grams * plate.quantity;
    const volumeMl = resin ? plate.volumeMl * plate.quantity : 0;
    let consumables = 0, auxiliaryEnergy = 0;
    if (resin) {
      for (const key of ['fepPerPlate', 'ipaPerPlate', 'ppePerPlate', 'lcdPerHour', 'washWatts', 'cureWatts']) requireNumber(printer[key] ?? 0, key);
      for (const key of ['washMinutes', 'cureMinutes']) requireNumber(plate[key] ?? 0, key);
      requireNumber(filament.wastePercent ?? 0, 'Resin residue allowance');
      consumables = plate.quantity * ((printer.fepPerPlate || 0) + (printer.ipaPerPlate || 0) + (printer.ppePerPlate || 0)) + hours * (printer.lcdPerHour || 0);
      auxiliaryEnergy = plate.quantity / 60 * ((plate.washMinutes || 0) * (printer.washWatts || 0) + (plate.cureMinutes || 0) * (printer.cureWatts || 0)) / 1000;
    }
    const material = resin ? volumeMl * (1 + (filament.wastePercent || 0) / 100) * filament.price / filament.bottleVolume : grams * filament.price / filament.spoolWeight;
    const electricity = (hours * printer.watts / 1000 + auxiliaryEnergy) * job.energyRate;
    const machine = hours * (printer.price / printer.lifetime + printer.maintenance);
    const cost = material + electricity + machine + consumables;
    const amount = cents(cost / (1 - job.failureRate / 100) * (1 + job.markup / 100));
    return { ...plate, printer, filament, technology, hours, grams, volumeMl, material, electricity, machine, consumables, cost, amount };
  });
  const material = lines.reduce((sum, line) => sum + line.material, 0);
  const electricity = lines.reduce((sum, line) => sum + line.electricity, 0);
  const machine = lines.reduce((sum, line) => sum + line.machine, 0);
  const consumables = lines.reduce((sum, line) => sum + line.consumables, 0);
  const production = material + electricity + machine + consumables;
  const failure = production / (1 - job.failureRate / 100) - production;
  const labour = (job.prepMinutes + job.finishMinutes) / 60 * job.labourRate;
  const cost = production + failure + labour + job.packaging + job.other;
  const serviceAmount = cents((labour + job.packaging + job.other) * (1 + job.markup / 100));
  let modelling = 0;
  if (job.modelling?.enabled) {
    if (!['hourly', 'fixed'].includes(job.modelling.mode)) throw new Error('Choose an hourly or fixed modelling fee.');
    for (const key of ['hours', 'rate', 'fixedFee']) requireNumber(job.modelling[key], `Modelling ${key}`);
    modelling = cents(job.modelling.mode === 'fixed' ? job.modelling.fixedFee : job.modelling.hours * job.modelling.rate);
  }
  const quotedProduction = cents(lines.reduce((sum, line) => sum + line.amount, 0) + serviceAmount);
  const markup = quotedProduction - cost;
  const shipping = cents(job.shipping);
  const subtotal = cents(quotedProduction + modelling + shipping);
  const tax = job.taxEnabled ? cents(subtotal * job.taxRate / 100) : 0;
  const schedules = {};
  for (const line of lines) schedules[line.printerId] = (schedules[line.printerId] || 0) + line.hours;
  return { lines, material, electricity, machine, consumables, modelling, shipping, currency, failure, labour, cost, markup, subtotal, tax, serviceAmount, total: cents(subtotal + tax),
    grams: lines.reduce((sum, line) => sum + line.grams, 0), hours: lines.reduce((sum, line) => sum + line.hours, 0),
    volumeMl: lines.reduce((sum, line) => sum + line.volumeMl, 0),
    elapsed: Math.max(0, ...Object.values(schedules)), schedules };
}

function parseTime(value) {
  const units = [...value.matchAll(/([\d.]+)\s*(d|h|m|s)/gi)];
  if (!units.length) return null;
  return units.reduce((sum, [, number, unit]) => sum + Number(number) * ({ d: 24, h: 1, m: 1 / 60, s: 1 / 3600 })[unit.toLowerCase()], 0);
}

export function parseGcode(text, density = 1.24, diameter = 1.75) {
  if (text.includes('\0')) throw new Error('This looks like binary G-code. Export a plain-text .gcode file from your slicer.');
  let hours = null;
  let grams = null;
  const estimated = text.match(/;\s*total estimated time\s*[:=]\s*([^\r\n;]+)/i) || text.match(/;\s*(?:estimated printing time(?:\s*\(normal mode\))?|model printing time)\s*[:=]\s*([^\r\n;]+)/i);
  if (estimated) hours = parseTime(estimated[1]);
  if (hours === null) {
    const seconds = text.match(/^;\s*TIME:\s*([\d.]+)/mi);
    if (seconds) hours = Number(seconds[1]) / 3600;
  }
  const weight = text.match(/;\s*(?:total filament (?:used\s*)?\[g\]|filament (?:used\s*)?\[g\]|filament used grams|filament weight)\s*[:=]\s*([\d., \t]+)/i);
  if (weight) grams = weight[1].split(',').reduce((sum, value) => sum + Number(value.trim() || 0), 0);
  let lengthMm = null;
  if (grams === null) {
    const length = text.match(/;\s*filament used\s*(?:\[(mm|m)\])?\s*[:=]\s*([\d., \t]+)\s*(mm|m)?/i);
    if (length) {
      lengthMm = length[2].split(',').reduce((sum, value) => sum + Number(value.trim() || 0), 0) * ((length[1] || length[3] || 'mm').toLowerCase() === 'm' ? 1000 : 1);
      grams = lengthMm * Math.PI * (diameter / 2) ** 2 / 1000 * density;
    }
  }
  return { hours: hours !== null && Number.isFinite(hours) && hours > 0 && hours <= Number.MAX_SAFE_INTEGER ? hours : null,
    grams: grams !== null && Number.isFinite(grams) && grams > 0 && grams <= Number.MAX_SAFE_INTEGER ? grams : null, lengthMm };
}

export function invoiceCSV(job, totals) {
  const currency = job.currency || 'AUD';
  const amount = value => value.toFixed(currencyDigits(currency));
  const cell = value => {
    const text = String(value ?? '');
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`;
  };
  const rows = [['Invoice', job.number], ['Customer', job.customer.name], ['Project', job.name], [],
    ['Description', 'Quantity', `Amount (${currency})`],
    ...totals.lines.map(line => [[line.name, resinEstimateNote(line)].filter(Boolean).join('\n'), line.quantity, amount(line.amount)]),
    [['Preparation, finishing and sundries', ...processingDescriptions(job)].join('\n'), '', amount(totals.serviceAmount)],
    ...(job.modelling?.enabled ? [[['3D modelling', job.modelling.description].filter(Boolean).join('\n'), 1, amount(totals.modelling)]] : []),
    ['Shipping', '', amount(totals.shipping)], ['Subtotal', '', amount(totals.subtotal)],
    ...(job.taxEnabled ? [['GST', '', amount(totals.tax)]] : []), [`Total ${currency}`, '', amount(totals.total)]];
  return rows.map(row => row.map(cell).join(',')).join('\r\n');
}
export function resinEstimateNote(plate) {
  return plate.resinImport?.volumeSource === 'reconstructed' ? 'Resin volume reconstructed (potentially inaccurate).' : '';
}

export function processingDescriptions(job) {
  if (job.sections?.processing === false) return [];
  return [
    ...(job.prepMinutes > 0 && job.prepDescription?.trim() ? [`Pre-processing: ${job.prepDescription.trim()}`] : []),
    ...(job.finishMinutes > 0 && job.finishDescription?.trim() ? [`Post-processing: ${job.finishDescription.trim()}`] : []),
    ...(job.other > 0 && job.otherDescription?.trim() ? [`Other job costs: ${job.otherDescription.trim()}`] : []),
  ];
}
