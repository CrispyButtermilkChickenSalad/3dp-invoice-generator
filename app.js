import { money as formatMoney, uid, escapeHTML as e, duration, calculate, parseGcode, invoiceCSV, processingDescriptions, currencies, printerTechnology, materialKind, favouritesFirst, normalizeHex, resinEstimateNote } from './core.js';
import { printerCatalogue, parsePrinterPresets, readWorkspace, workspaceBackup, rememberCustomer, removeProfile } from './profiles.js';
import { inspectResin, resinExtensions, resinFileAccept, reconstructionGeometry } from './resin.js';

const icons = {
  layers: '<path d="m3 7 9-5 9 5-9 5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  invoice: '<path d="M6 3h12v19l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/>',
  printer: '<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v8H6zM17 11h1"/>',
  spool: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="m5.6 5.6 4.3 4.3m4.2 4.2 4.3 4.3m0-12.8-4.3 4.3m-4.2 4.2-4.3 4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  leaf: '<path d="M20 3C8 2 2 7 5 15s16 5 15-12ZM5 20l10-12"/>',
  settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  edit: '<path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  customer: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  moon: '<path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  list: '<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.layers}</svg>`;
const today = () => new Date().toLocaleDateString('en-CA');
const initialPrinters = [
  { id: 'p1', name: 'Bambu Lab P1S', model: 'Enclosed · CoreXY', watts: 150, price: 999, lifetime: 6000, maintenance: 0.18, color: '#596c58' },
  { id: 'p2', name: 'Prusa MK4S', model: 'Open frame · Bedslinger', watts: 120, price: 1399, lifetime: 7000, maintenance: 0.15, color: '#bd764b' },
];
const initialFilaments = [
  { id: 'f1', name: 'PLA Matte', brand: 'Bambu Lab', color: '#c4b8a0', colorName: 'Latte brown', price: 32, spoolWeight: 1000, density: 1.24, diameter: 1.75 },
  { id: 'f2', name: 'PETG', brand: 'Prusament', color: '#738474', colorName: 'Sage green', price: 39, spoolWeight: 1000, density: 1.27, diameter: 1.75 },
  { id: 'f3', name: 'PLA Basic', brand: 'eSUN', color: '#e5dfd3', colorName: 'Ivory white', price: 26, spoolWeight: 1000, density: 1.24, diameter: 1.75 },
];
function newJob(sample = false, currency = 'AUD') {
  return { id: uid(), name: sample ? 'Desktop organiser set' : 'Untitled print project', number: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`, date: today(), dueDate: '',
    customer: { name: sample ? 'Alex Morgan' : '', email: '', company: '', address: '', abn: '' },
    plates: sample ? [
      { id: uid(), name: 'Desktop organiser', detail: 'organiser_base.gcode', hours: 4.2, grams: 86.4, quantity: 1, printerId: 'p1', filamentId: 'f1', verified: true },
      { id: uid(), name: 'Pen & accessory tray', detail: 'accessory_tray.gcode', hours: 2.75, grams: 42, quantity: 1, printerId: 'p2', filamentId: 'f1', verified: true },
    ] : [], prepMinutes: 15, finishMinutes: 10, labourRate: 30, energyRate: 0.30, failureRate: 5, markup: 50, packaging: 2, other: 0, shipping: 0, taxEnabled: false, taxRate: 10,
    currency, customerType: 'individual', sections: { address: false, business: false, metrics: false, processing: true, payment: true, notes: false },
    prepDescription: 'Model checks, orientation and slicing.', finishDescription: 'Support removal and surface cleanup.',
    otherDescription: '', modelling: { enabled: false, mode: 'hourly', hours: 0, rate: 50, fixedFee: 0, description: '' },
    notes: '', payment: 'Bank transfer or payment on collection.', sample };
}
let state = readWorkspace({ version: 3, printers: initialPrinters, filaments: initialFilaments, job: newJob(true), saved: [], customers: [],
  settings: { theme: 'dark', libraryViews: { customers: 'list', printers: 'grid', filaments: 'grid' } },
  studio: { name: 'Your print studio', email: '', address: '', abn: '', currency: 'AUD' } });
let storageError = '';
let storageWriteError = '';
let persistentStorage = 'Browser-managed';
const storageKey = 'layer-studio-v1';
try {
  const raw = localStorage.getItem(storageKey);
  if (raw) state = readWorkspace(JSON.parse(raw));
} catch (error) { storageError = `Saved data could not be loaded: ${error.message} It has not been overwritten. Use Data & backups to download it or restore a valid backup.`; }
let view = 'invoice';
let tab = 'plates';
let modal = null;
let importing = false;
let pendingBackup = null;
let toastTimer;
let lastFocus;
let pricingTab = 'printing';
const searches = { printers: '', filaments: '', customers: '' };
const resinFiles = new Map();
let reconstruction = null;
const root = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const totals = () => calculate(state.job, state.printers, state.filaments);
const money = (value, currency = state.job.currency) => formatMoney(value, currency);
const compatiblePrinters = technology => favouritesFirst(state.printers.filter(item => printerTechnology(item) === technology));
const compatibleMaterials = technology => favouritesFirst(state.filaments.filter(item => materialKind(item) === (technology === 'resin' ? 'resin' : 'filament')));
const favouriteLabel = item => `${item.favourite ? '★ ' : ''}${item.name}`;
function toast(message) {
  document.querySelector('#toast').textContent = message;
  document.querySelector('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => document.querySelector('#toast').classList.remove('visible'), 4500);
}
function persist() {
  if (storageError) { toast('Storage is blocked to protect unreadable saved data. See the warning banner.'); return false; }
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    storageWriteError = '';
    document.querySelector('#storage-warning')?.remove();
    return true;
  } catch {
    storageWriteError = 'Browser storage is unavailable or full. Changes are not saved. Download a JSON backup before closing.';
    if (!document.querySelector('#storage-warning')) {
      const notice = document.createElement('div');
      notice.id = 'storage-warning'; notice.className = 'notice error'; notice.setAttribute('role', 'alert');
      notice.textContent = storageWriteError; root.querySelector('main')?.prepend(notice);
    }
    toast(storageWriteError);
    return false;
  }
}
function field(label, name, value, options = {}) {
  const { type = 'text', min = 0, max = 1000000000, step = 'any', suffix = '', required = false, placeholder = '', hint = '', maxLength = name === 'name' ? 200 : 10000 } = options;
  return `<label class="field"><span>${label}</span><div class="input-wrap"><input name="${name}" type="${type}" value="${e(value)}" maxlength="${maxLength}" ${type === 'number' ? `min="${min}" ${max !== undefined ? `max="${max}"` : ''} step="${step}"` : ''} ${required ? 'required' : ''} placeholder="${e(placeholder)}">${suffix ? `<em>${suffix.replace('$', state.job.currency)}</em>` : ''}</div>${hint ? `<small>${hint}</small>` : ''}</label>`;
}
function colourField(value) {
  return `<div class="field"><label for="profile-colour">Colour (hex)</label><div class="colour-editor"><input id="profile-colour" name="color" value="${e(value)}" maxlength="7" pattern="#?([a-fA-F0-9]{3}|[a-fA-F0-9]{6})" placeholder="#aabbcc" required><input type="color" value="${e(normalizeHex(value) || '#000000')}" data-colour-picker aria-label="Choose material colour"></div></div>`;
}
function options(items, selected, title = item => item.name) { return items.map(item => `<option value="${e(item.id)}" ${item.id === selected ? 'selected' : ''}>${e(title(item))}</option>`).join(''); }
function toggle(label, key, checked, text = '') { return `<label class="toggle-row"><span><strong>${label}</strong>${text ? `<small>${text}</small>` : ''}</span><input type="checkbox" name="${key}" ${checked ? 'checked' : ''}><span class="switch"></span></label>`; }
function header() {
  const titles = { invoice: 'Invoice', printers: 'Printers', filaments: 'Filaments & resins', saved: 'Saved invoices', customers: 'Customers', data: 'Data & backups' };
  return `<header class="topbar"><div class="breadcrumb">3-IG <span>/</span> <b>${titles[view]}</b></div><div class="top-right"><span class="local-status">Browser storage</span><button class="button secondary small theme-toggle" data-action="theme" aria-label="Switch to ${state.settings.theme === 'dark' ? 'light' : 'dark'} mode">${icon(state.settings.theme === 'dark' ? 'sun' : 'moon')}<span>${state.settings.theme === 'dark' ? 'Light' : 'Dark'} mode</span></button><button class="icon-button" data-action="studio" aria-label="Studio settings">${icon('settings')}</button></div></header>`;
}
function sidebar() {
  return `<aside class="sidebar"><a class="brand" href="#" data-nav="invoice" aria-label="3-IG invoice workspace">${icon('layers')}<span>3-IG</span></a>
    <nav aria-label="Main navigation">${[['invoice','invoice','Invoice'],['saved','grid','Saved invoices'],['customers','customer','Customers'],['printers','printer','Printers'],['filaments','spool','Filaments & resins'],['data','download','Data & backups']].map(([key, glyph, label]) => `<button class="nav-item ${view === key ? 'active' : ''}" data-nav="${key}" aria-label="${label}" ${view === key ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span>${key === 'saved' ? `<span class="nav-count">${state.saved.length}</span>` : ''}</button>`).join('')}</nav>
    <button class="nav-item settings" data-action="studio" aria-label="Studio settings">${icon('settings')}<span>Studio settings</span></button></aside>`;
}
function render() {
  document.documentElement.dataset.theme = state.settings.theme;
  document.querySelector('meta[name="theme-color"]').content = state.settings.theme === 'dark' ? '#0d1117' : '#ffffff';
  root.innerHTML = `${sidebar()}<div class="workspace">${header()}<main>${storageError ? `<div class="notice error">${e(storageError)}</div>` : ''}${storageWriteError ? `<div id="storage-warning" class="notice error" role="alert">${e(storageWriteError)}</div>` : ''}${view === 'invoice' ? invoiceWorkspace() : view === 'printers' ? profiles('printer') : view === 'filaments' ? profiles('filament') : view === 'customers' ? customersView() : view === 'data' ? dataView() : savedView()}</main></div>`;
}
function invoiceWorkspace() {
  const t = totals();
  return `<section class="page-heading"><h1>Invoice</h1><button class="button secondary" data-action="new">${icon('plus')} New project</button></section>
  <div class="project-meta"><div class="project-mark">${icon('layers')}</div><div><input class="project-title" aria-label="Project name" name="job.name" value="${e(state.job.name)}" maxlength="120"><span>${e(state.job.number)} <b>·</b> <span class="draft-dot"></span> Draft ${state.job.sample ? '<b>·</b> Example project' : ''}</span></div><button class="text-button" data-action="save">${icon('check')} Save draft</button></div>
  <div class="invoice-layout"><div class="editor-column"><div class="tabs" role="tablist" aria-label="Invoice steps">${[['plates','01','Plates & pricing'],['customer','02','Customer details'],['export','03','Invoice & export']].map(([key, number, label]) => `<button role="tab" aria-selected="${tab === key}" class="${tab === key ? 'selected' : ''}" data-tab="${key}"><span>${number}</span>${label}</button>`).join('')}</div>
    ${tab === 'plates' ? `<div class="pricing-tabs" role="group" aria-label="Pricing sections"><button class="button ${pricingTab === 'printing' ? 'secondary selected' : 'text-button'}" data-pricing-tab="printing">${icon('printer')} Printing & processing</button><button class="button ${pricingTab === 'modelling' ? 'secondary selected' : 'text-button'}" data-pricing-tab="modelling">${icon('edit')} 3D modelling ${state.job.modelling.enabled ? '<span class="count-pill">On</span>' : ''}</button></div>${pricingTab === 'printing' ? platesEditor(t) : modellingEditor()}` : tab === 'customer' ? customerEditor() : exportEditor()}
    </div>${summary(t)}</div>`;
}
function platesEditor(t) {
  return `<section class="card plates-card"><div class="section-heading"><h2>Plates <span class="count-pill">${state.job.plates.length}</span></h2><button class="text-button" data-action="plate">${icon('plus')} Add manually</button></div>
    <label class="upload-area ${importing ? 'busy' : ''}" id="drop-zone"><input id="gcode-upload" type="file" accept=".gcode,.gco,.g,${resinFileAccept}" multiple ${importing ? 'disabled' : ''}><div class="upload-symbol">${icon('upload')}</div><div><strong>${importing ? 'Reading plate metadata…' : 'Drop sliced print files here'} <span>or browse files</span></strong><p>G-code, Photon Workshop / Anycubic, SL1/SL1S, GOO and CTB</p></div></label>
    <div class="plate-list">${state.job.plates.length ? state.job.plates.map((plate, index) => plateCard(plate, index, t.lines[index])).join('') : '<div class="empty-state">Upload G-code or add a plate manually.</div>'}</div>
    <div class="section-foot">${icon('info')} Resin imports are version-limited. Missing metrics can be copied from your slicer; optional reconstruction is potentially inaccurate. Each plate prices one assigned resin; split multi-resin jobs by material.</div></section>
    <section class="card pricing-card"><div class="section-heading"><h2>Labour & pricing</h2></div>
    <div class="field-grid three">${field('Pre-processing', 'job.prepMinutes', state.job.prepMinutes, { type: 'number', suffix: 'min', hint: 'Model checks, slicing and setup.' })}${field('Post-processing', 'job.finishMinutes', state.job.finishMinutes, { type: 'number', suffix: 'min', hint: 'Supports, cleanup and finishing.' })}${field('Hourly rate', 'job.labourRate', state.job.labourRate, { type: 'number', suffix: '$ / hr' })}</div>
    <div class="field-grid two spaced">${field('Pre-processing description', 'job.prepDescription', state.job.prepDescription, { maxLength: 1000 })}${field('Post-processing description', 'job.finishDescription', state.job.finishDescription, { maxLength: 1000 })}</div>
    <div class="pricing-divider"></div><div class="field-grid three">${field('Packaging', 'job.packaging', state.job.packaging, { type: 'number', suffix: '$' })}${field('Failure allowance', 'job.failureRate', state.job.failureRate, { type: 'number', max: 95, suffix: '%' })}${field('Cost markup', 'job.markup', state.job.markup, { type: 'number', suffix: '%' })}</div>
    <div class="field-grid two spaced">${field('Other job costs', 'job.other', state.job.other, { type: 'number', suffix: '$' })}${field('Other costs description', 'job.otherDescription', state.job.otherDescription, { maxLength: 1000, placeholder: 'e.g. magnets, inserts or purchased parts' })}</div>
    <p class="helper">Descriptions are included on the invoice when service descriptions are enabled.</p>
    <details class="advanced"><summary>Electricity & shipping ${icon('chevron')}</summary><div class="field-grid two">${field('Electricity', 'job.energyRate', state.job.energyRate, { type: 'number', suffix: '$ / kWh' })}${field('Shipping (no markup)', 'job.shipping', state.job.shipping, { type: 'number', suffix: '$' })}</div><p class="helper">Failure allowance covers reprints. Shipping and modelling fees are not marked up.</p></details></section>
    <div class="next-step"><button class="button secondary" data-tab="customer">Customer details ${icon('arrow')}</button></div>`;
}
function modellingEditor() {
  const m = state.job.modelling;
  return `<section class="card"><div class="section-heading"><h2>3D modelling</h2></div>
    ${toggle('Include modelling services', 'modelling.enabled', m.enabled)}
    <p class="helper">Quote design effort, not model size. Estimate time for design, revisions and file preparation, or enter an agreed fixed fee.</p>
    ${m.enabled ? `<div class="segmented spaced">${['hourly', 'fixed'].map(mode => `<button data-action="modelling-mode" data-mode="${mode}" class="${m.mode === mode ? 'active' : ''}">${mode === 'hourly' ? 'Hours × rate' : 'Fixed-price override'}</button>`).join('')}</div>
      ${m.mode === 'hourly' ? `<div class="field-grid two">${field('Estimated modelling time', 'modelling.hours', m.hours, { type: 'number', suffix: 'hr' })}${field('Modelling charge rate', 'modelling.rate', m.rate, { type: 'number', suffix: '$ / hr' })}</div>` : field('Agreed modelling fee', 'modelling.fixedFee', m.fixedFee, { type: 'number', suffix: '$' })}
      <div class="spaced">${field('Modelling scope / invoice description', 'modelling.description', m.description, { maxLength: 1000, placeholder: 'e.g. CAD design, two revisions and print-ready files' })}</div>
      <div class="notice">Modelling fee: <span class="modelling-amount">${money(totals().modelling)}</span> before GST. Charged once per job, without print markup or failure allowance.</div>` : ''}
    </section>`;
}
function plateCard(plate, index, line) {
  return `<article class="plate"><div class="plate-visual visual-${index % 3}"><div class="print-object"><i></i><i></i><i></i></div><span>PLATE ${String(index + 1).padStart(2, '0')}</span></div>
    <div class="plate-content"><div class="plate-title"><div><h3>${e(plate.name)}</h3><span>${e(plate.detail || 'Manual entry')}</span></div><div class="plate-actions"><button class="icon-button" data-action="edit-plate" data-id="${plate.id}" aria-label="Edit ${e(plate.name)}">${icon('edit')}</button><button class="icon-button delete" data-action="remove-plate" data-id="${plate.id}" aria-label="Remove ${e(plate.name)}">${icon('close')}</button></div></div>
    <div class="plate-metrics"><span>${line.technology === 'resin' ? 'Resin' : 'FDM'}</span><span>${icon('clock')} ${duration(plate.hours)}</span><span>${icon('spool')} ${line.technology === 'resin' ? `${plate.volumeMl.toFixed(1)} mL` : `${plate.grams.toFixed(1)} g`}</span><span>× ${plate.quantity} plate${plate.quantity !== 1 ? 's' : ''}</span>${!plate.verified ? '<span class="warning-tag">Review metrics</span>' : ''}</div>
    <div class="plate-assignments"><label>${icon('printer')}<select name="plate.${plate.id}.printerId" aria-label="Printer for ${e(plate.name)}">${options(compatiblePrinters(line.technology), plate.printerId, favouriteLabel)}</select></label><label><i class="filament-dot" style="background:${e(line.filament.color)}"></i><select name="plate.${plate.id}.filamentId" aria-label="Material for ${e(plate.name)}">${options(compatibleMaterials(line.technology), plate.filamentId, filament => `${favouriteLabel(filament)} · ${filament.colorName}`)}</select></label></div>
    ${plate.resinImport ? `<div class="resin-source"><span>${e(plate.resinImport.format)} · Volume: ${e(plate.resinImport.volumeSource)} · Time: ${e(plate.resinImport.hoursSource)}</span>${plate.resinImport.volumeSource === 'reconstructed' ? '<strong class="warning-tag">Potentially inaccurate reconstructed volume</strong>' : ''}<button class="text-button" data-action="resin-options" data-id="${plate.id}">${plate.volumeMl > 0 && plate.hours > 0 ? 'Import details' : 'Missing metrics: slicer or reconstruction'}</button></div>` : ''}</div></article>`;
}
function summary(t) {
  const count = Object.keys(t.schedules).length;
  const rows = [['Materials', t.material], ['Machine & upkeep', t.machine], ['Electricity', t.electricity], ...(t.lines.some(line => line.technology === 'resin') ? [['Resin consumables', t.consumables]] : []), ['Print labour', t.labour], ['Packaging & extras', state.job.packaging + state.job.other], ['Failure allowance', t.failure]];
  return `<aside class="summary-column"><section class="card summary-card"><div class="summary-top"><h2>Cost summary</h2><span class="currency-badge">${state.job.currency}</span></div><div class="summary-stats"><div>${icon('spool')}<strong class="material-amount">${t.grams || !t.volumeMl ? `${t.grams.toFixed(1)}<small> g</small>` : ''}${t.grams && t.volumeMl ? '<br>' : ''}${t.volumeMl ? `${t.volumeMl.toFixed(1)}<small> mL</small>` : ''}</strong><span>Material usage</span></div><div>${icon('clock')}<strong>${duration(t.hours)}</strong><span>Print time</span></div></div>
    <div class="cost-breakdown">${rows.map(([label, amount]) => `<div><span>${label}</span><b>${money(amount)}</b></div>`).join('')}</div><div class="cost-subtotal"><span>Print production cost</span><strong>${money(t.cost)}</strong></div><div class="cost-breakdown pricing-totals"><div><span>Print markup <small>${state.job.markup}%</small></span><b>${money(t.markup)}</b></div>${state.job.modelling.enabled ? `<div><span>3D modelling</span><b>${money(t.modelling)}</b></div>` : ''}${state.job.shipping ? `<div><span>Shipping</span><b>${money(state.job.shipping)}</b></div>` : ''}<div><span>GST ${state.job.taxEnabled ? `(${state.job.taxRate}%)` : '<small>Not applied</small>'}</span><b>${money(t.tax)}</b></div></div>
    <div class="grand-total"><span>Customer total</span><strong>${money(t.total)}<small> ${state.job.currency}</small></strong><span>${state.job.taxEnabled ? 'Including GST' : 'No GST applied'}</span></div>
    <button class="button primary full" data-action="preview">${icon('invoice')} Preview invoice ${icon('arrow')}</button></section>
    <section class="schedule-card"><span class="schedule-icon">${icon('printer')}</span><div><strong>Machine schedule</strong><p>${duration(t.elapsed)} across ${count} printer${count === 1 ? '' : 's'}.</p><span>Parallel printers; sequential plates per printer. Excludes setup and reprints.</span></div></section></aside>`;
}
function customerEditor() {
  const j = state.job;
  return `<section class="card"><div class="section-heading"><h2>Customer</h2></div>
    <label class="field spaced-bottom"><span>Previous customer</span><select name="existing-customer"><option value="">New customer</option>${options(state.customers, j.customer.id, item => `${item.name}${item.company ? ` · ${item.company}` : ''}${item.email ? ` · ${item.email}` : ''}`)}</select></label>
    <div class="segmented">${['individual','business'].map(type => `<button class="${j.customerType === type ? 'active' : ''}" data-action="customer-type" data-type="${type}">${type === 'individual' ? 'Individual' : 'Business'}</button>`).join('')}</div>
    <div class="field-grid two">${field('Customer name', 'customer.name', j.customer.name, { placeholder: 'e.g. Alex Morgan' })}${field('Email address', 'customer.email', j.customer.email, { type: 'email', placeholder: 'alex@example.com' })}</div>
    ${j.customerType === 'business' ? `<div class="field-grid two">${field('Company / invoice destination', 'customer.company', j.customer.company)}${field('Customer ABN (optional)', 'customer.abn', j.customer.abn)}</div>` : ''}
    <label class="field"><span>Billing address <small>Optional</small></span><textarea name="customer.address" rows="3" maxlength="10000" placeholder="Street address, suburb, state and postcode">${e(j.customer.address)}</textarea></label>
    <p class="helper">Customers are saved when you save or export an invoice.</p></section><div class="next-step"><button class="text-button" data-tab="plates">Back to plates</button><button class="button secondary" data-tab="export">Invoice & export ${icon('arrow')}</button></div>`;
}
function exportEditor() {
  const j = state.job;
  return `<section class="card"><div class="section-heading"><h2>Invoice settings</h2></div><div class="field-grid two">${field('Invoice number', 'job.number', j.number)}${field('Issue date', 'job.date', j.date, { type: 'date' })}${field('Due date (optional)', 'job.dueDate', j.dueDate, { type: 'date' })}${field('GST rate', 'job.taxRate', j.taxRate, { type: 'number', max: 100, suffix: '%' })}</div>
    ${toggle('Apply GST', 'job.taxEnabled', j.taxEnabled, 'Only enable if your business is registered for GST.')}
    <div class="pricing-divider"></div><h3 class="small-heading">INCLUDE ON THE INVOICE</h3>
    ${toggle('Business details', 'section.business', j.sections.business, 'Company, invoice destination and ABNs')}
    ${toggle('Billing addresses', 'section.address', j.sections.address, 'Your studio and customer address')}
    ${toggle('Print specifications', 'section.metrics', j.sections.metrics, 'Material, weight and print time; never your costs')}
    ${toggle('Service descriptions', 'section.processing', j.sections.processing, 'Pre-processing, post-processing and other job costs under the service line')}
    ${toggle('Payment details', 'section.payment', j.sections.payment)}
    ${toggle('Customer note', 'section.notes', j.sections.notes)}
    ${j.sections.processing ? `<div class="spaced">${field('Pre-processing description', 'job.prepDescription', j.prepDescription, { maxLength: 1000 })}${field('Post-processing description', 'job.finishDescription', j.finishDescription, { maxLength: 1000 })}${field('Other costs description', 'job.otherDescription', j.otherDescription, { maxLength: 1000 })}</div>` : ''}
    ${j.sections.payment ? `<label class="field spaced"><span>Payment instructions</span><textarea name="job.payment" rows="2" maxlength="10000">${e(j.payment)}</textarea></label>` : ''}
    ${j.sections.notes ? `<label class="field spaced"><span>Customer note</span><textarea name="job.notes" rows="3" maxlength="10000">${e(j.notes)}</textarea></label>` : ''}
    <button class="text-button spaced" data-action="studio">${icon('settings')} Studio details</button></section><div class="next-step"><button class="button primary" data-action="preview">Preview & export ${icon('arrow')}</button></div>`;
}
function profiles(type) {
  const isPrinter = type === 'printer';
  const key = isPrinter ? 'printers' : 'filaments';
  return `<section class="page-heading"><h1>${isPrinter ? 'Printers' : 'Filaments & resins'}</h1><div class="button-row"><button class="button primary" data-action="add-${type}">${icon('plus')} Add ${type}</button>${!isPrinter ? '<button class="button secondary" data-action="add-resin">Add resin</button>' : ''}</div></section>
    ${isPrinter ? '<p class="helper spaced-bottom">Add a printer from the catalogue, import a slicer preset, or enter details manually. Set your own operating costs. A profile does not add support for new sliced-file formats.</p>' : ''}
    ${libraryControls(key, isPrinter ? 'printers' : 'filaments and resins')}<div id="${key}-results">${profileList(type)}</div>
    <p class="helper">${isPrinter ? 'Depreciation = purchase price ÷ usable print hours. Keep FEP/LCD reserves separate from general maintenance to avoid double counting.' : 'Filament is priced by weight; resin by bottle volume. Residue allowance covers resin handling losses, not failed reprints.'} Prices use ${state.job.currency}; changes affect the current project, not saved snapshots.</p>`;
}
function libraryControls(key, label) {
  return `<div class="library-toolbar"><label class="field"><span>Search ${label}</span><input type="search" data-library-search="${key}" value="${e(searches[key])}" placeholder="Search by name or details"></label><div class="view-switch" role="group" aria-label="${label} view">${['grid', 'list'].map(mode => `<button class="button secondary small ${state.settings.libraryViews[key] === mode ? 'selected' : ''}" aria-pressed="${state.settings.libraryViews[key] === mode}" data-action="library-view" data-library="${key}" data-view="${mode}" aria-label="${mode} view">${icon(mode)}</button>`).join('')}</div></div>`;
}
function profileList(type) {
  const printer = type === 'printer';
  const key = printer ? 'printers' : 'filaments';
  const query = searches[key].trim().toLowerCase();
  const items = favouritesFirst((printer ? state.printers : state.filaments).filter(item => `${item.name} ${item.model || ''} ${item.brand || ''} ${item.colorName || ''} ${printer ? printerTechnology(item) : materialKind(item)}`.toLowerCase().includes(query)));
  if (!items.length) return `<div class="empty-state">${state[key].length ? 'No matching profiles.' : `No ${printer ? 'printers' : 'filaments or resins'} yet. Add a profile to price plates.`}</div>`;
  return `<div class="profile-grid ${state.settings.libraryViews[key] === 'list' ? 'library-list' : ''}">${items.map(item => {
    const resin = printer ? printerTechnology(item) === 'resin' : materialKind(item) === 'resin';
    const rows = printer ? [['Type', resin ? 'Resin' : 'FDM'], ['Power', `${item.watts} W`], ['Upkeep', `${money(item.maintenance)} / hr`]] :
      [[resin ? 'Bottle price' : 'Spool price', money(item.price)], [resin ? 'Bottle volume' : 'Spool weight', `${resin ? item.bottleVolume : item.spoolWeight} ${resin ? 'mL' : 'g'}`], ['Type', resin ? 'Resin' : 'Filament']];
    return `<article class="card profile-card"><div class="profile-card-heading"><div><h2>${e(item.name)}</h2><p>${e(printer ? item.model : `${item.brand} · ${item.colorName}`)}</p></div><div class="profile-actions"><button class="icon-button favourite ${item.favourite ? 'is-favourite' : ''}" data-action="favourite" data-type="${type}" data-id="${item.id}" aria-label="Favourite ${e(item.name)}" aria-pressed="${item.favourite}">${icon('star')}</button><button class="icon-button" aria-label="Edit ${e(item.name)}" data-action="edit-${type}" data-id="${item.id}">${icon('edit')}</button><button class="icon-button delete" aria-label="Remove ${e(item.name)}" title="Remove profile" data-action="remove-${type}" data-id="${item.id}">${icon('trash')}</button></div></div><dl>${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></article>`;
  }).join('')}</div>`;
}
function savedView() {
  return `<section class="page-heading"><h1>Saved invoices</h1><button class="button primary" data-action="new">${icon('plus')} New project</button></section><section class="card">${state.saved.length ? `<div class="saved-list">${state.saved.map(item => `<article><div class="saved-icon">${icon('invoice')}</div><div><h3>${e(item.job.name)}</h3><p>${e(item.job.number)} · ${e(item.job.customer.name || 'Customer not set')} · ${e(item.job.date)}</p></div><strong>${money(calculate(item.job, item.printers, item.filaments).total, item.job.currency)} ${item.job.currency}</strong><button class="button secondary small" data-action="open-saved" data-id="${item.job.id}">Open ${icon('arrow')}</button><button class="icon-button delete" data-action="delete-saved" data-id="${item.job.id}" aria-label="Delete saved ${e(item.job.name)}">${icon('trash')}</button></article>`).join('')}</div>` : `<div class="empty-state">No saved invoices.</div>`}</section>`;
}
function customersView() {
  return `<section class="page-heading"><h1>Customers <span class="count-pill">${state.customers.length}</span></h1></section>
    ${libraryControls('customers', 'customers')}<div id="customers-results">${customerList(searches.customers)}</div>`;
}
function customerList(query = '') {
  const search = query.trim().toLowerCase();
  const customers = state.customers.filter(item => `${item.name} ${item.company} ${item.email}`.toLowerCase().includes(search));
  return customers.length ? `<div class="profile-grid ${state.settings.libraryViews.customers === 'list' ? 'library-list' : ''}">${customers.map(item => `<article class="card customer-card"><div><h3>${e(item.name)}</h3><p>${e(item.company || item.type)}${item.email ? ` · ${e(item.email)}` : ''}</p><p>Last invoice: ${e(item.lastInvoiceDate)} · ${item.invoiceIds.length} invoice${item.invoiceIds.length === 1 ? '' : 's'}</p></div><button class="button secondary small" data-action="use-customer" data-id="${item.id}">Use customer ${icon('arrow')}</button></article>`).join('')}</div>` : '<div class="empty-state">No matching customers. Save or export an invoice to add its customer.</div>';
}
function dataView() {
  return `<section class="page-heading"><h1>Data & backups</h1></section><div class="data-grid">
    <section class="card"><div class="section-heading"><h2>Browser storage</h2></div><p>Drafts, profiles, customers and theme are saved automatically on this device, including after closing the browser.</p><dl class="storage-details"><div><dt>Storage policy</dt><dd id="persistence-status">${e(persistentStorage)}</dd></div><div><dt>Current site</dt><dd>${e(location.origin + location.pathname)}</dd></div></dl><button class="button secondary" data-action="persistent-storage">Request persistent storage</button><p class="helper">Clearing site data or using a private session can remove data. Browser storage is not a backup. Localhost and GitHub Pages have separate storage.</p></section>
    <section class="card"><div class="section-heading"><h2>JSON backup</h2></div><p>Transfer printers, filaments, resins, customers, saved invoices, the current draft and settings between local hosting and GitHub Pages.</p><div class="button-row spaced"><button class="button primary" data-action="backup-export">${icon('download')} Download backup</button><label class="button secondary file-button">${icon('upload')} Import backup<input id="backup-upload" type="file" accept=".json,application/json"></label></div><p class="helper">Import replaces this browser’s workspace after confirmation. Backups contain customer contact details; store them securely.</p>${storageError ? '<button class="text-button spaced" data-action="raw-backup">Download unreadable stored data</button>' : ''}</section>
    </div><p class="helper spaced">Anycubic format research: <a href="https://github.com/sn4k3/UVtools" target="_blank" rel="noopener noreferrer">UVtools by sn4k3 and contributors</a> (AGPL-3.0). Independent metadata readers; the UVtools engine is not bundled. <a href="./THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener noreferrer">Format references & notices</a>.</p><button class="text-button danger spaced" data-action="reset">Reset all local data…</button>`;
}
function invoiceHTML() {
  const j = state.job;
  const t = totals();
  const s = state.studio;
  const formal = j.sections.business;
  const taxInvoice = j.taxEnabled && formal && s.abn.trim();
  return `<article class="invoice-document">
    <header class="document-header"><div><div class="document-brand">${e(s.name)}</div>${s.email ? `<p>${e(s.email)}</p>` : ''}${j.sections.address && s.address ? `<p class="preserve">${e(s.address)}</p>` : ''}${formal && s.abn ? `<p>ABN ${e(s.abn)}</p>` : ''}</div><div><h2>${taxInvoice ? 'Tax invoice' : 'Invoice'}</h2><p>${e(j.number)}</p></div></header>
    <div class="document-parties"><div><span class="eyebrow">BILL TO</span><h3>${e(j.customer.name || 'Customer name not set')}</h3>${formal && j.customer.company ? `<p>${e(j.customer.company)}</p>` : ''}${j.customer.email ? `<p>${e(j.customer.email)}</p>` : ''}${j.sections.address && j.customer.address ? `<p class="preserve">${e(j.customer.address)}</p>` : ''}${formal && j.customer.abn ? `<p>ABN ${e(j.customer.abn)}</p>` : ''}</div><div><p>Issued <b>${e(j.date)}</b></p>${j.dueDate ? `<p>Due <b>${e(j.dueDate)}</b></p>` : ''}<p>Currency <b>${j.currency}</b></p></div></div>
    <h3 class="document-project">${e(j.name)}</h3>
    <table><thead><tr><th>Description</th><th>Qty</th><th>Amount</th></tr></thead><tbody>
      ${t.lines.map(line => `<tr><td><strong>${e(line.name)}</strong>${j.sections.metrics ? `<small>${e(line.filament.name)} · ${e(line.filament.colorName)} · ${line.technology === 'resin' ? `${line.volumeMl.toFixed(1)} mL` : `${line.grams.toFixed(1)} g`} · ${duration(line.hours)}</small>` : ''}${resinEstimateNote(line) ? `<small>${resinEstimateNote(line)}</small>` : ''}</td><td>${line.quantity}</td><td>${money(line.amount)}</td></tr>`).join('')}
      <tr><td><strong>Preparation, finishing & sundries</strong>${processingDescriptions(j).map(text => `<small class="preserve">${e(text)}</small>`).join('')}</td><td>1</td><td>${money(t.serviceAmount)}</td></tr>
      ${j.modelling.enabled ? `<tr><td><strong>3D modelling</strong>${j.modelling.description ? `<small class="preserve">${e(j.modelling.description)}</small>` : ''}</td><td>1</td><td>${money(t.modelling)}</td></tr>` : ''}
      ${j.shipping ? `<tr><td>Shipping</td><td>1</td><td>${money(t.shipping)}</td></tr>` : ''}</tbody></table>
    <div class="document-totals"><p>Subtotal <span>${money(t.subtotal)}</span></p>${j.taxEnabled ? `<p>GST (${j.taxRate}%) <span>${money(t.tax)}</span></p>` : '<p class="muted">No GST applied</p>'}<div>Total due <strong>${money(t.total)} <small>${j.currency}</small></strong></div></div>
    ${j.sections.payment && j.payment ? `<section class="document-note"><h4>PAYMENT DETAILS</h4><p class="preserve">${e(j.payment)}</p></section>` : ''}
    ${j.sections.notes && j.notes ? `<section class="document-note"><p class="preserve">${e(j.notes)}</p></section>` : ''}
  </article>`;
}
function showModal(kind, id = null, initial = {}) {
  lastFocus = document.activeElement;
  modal = { kind, id, ...initial };
  renderModal();
  modalRoot.querySelector('input:not([type="hidden"]), button')?.focus();
}
function closeModal() {
  if (reconstruction) { reconstruction.worker.terminate(); reconstruction = null; }
  modal = null; pendingBackup = null; modalRoot.innerHTML = ''; document.body.classList.remove('modal-open'); lastFocus?.focus();
}
function renderModal() {
  if (!modal) return;
  let title = '', body = '', footer = '', wide = false;
  const { kind, id } = modal;
  if (kind === 'preview') {
    title = 'Invoice preview'; wide = true;
    body = `${!state.job.customer.name.trim() || !state.studio.email.trim() || !state.job.plates.length || state.job.plates.some(plate => !plate.verified) ? '<div class="notice warning">Check customer details, studio contact information and flagged print metrics before sending.</div>' : ''}${state.job.taxEnabled && (!state.job.sections.business || !state.studio.abn.trim()) ? '<div class="notice warning">GST requires your studio ABN and business details.</div>' : ''}<div class="document-frame">${invoiceHTML()}</div>`;
    footer = `<button type="button" class="button secondary" data-action="csv">${icon('download')} Export CSV</button><button type="button" class="button primary" data-action="print">${icon('download')} Print / Save PDF</button>`;
  } else if (kind === 'resin-options') {
    const plate = state.job.plates.find(item => item.id === id), info = plate.resinImport;
    const file = resinFiles.get(id), canEstimate = info.reconstruction && (plate.volumeMl <= 0 || info.volumeSource === 'reconstructed');
    title = 'Resin import & missing metrics';
    body = `<p>${e(info.format)}${info.printerName ? ` · Slicer printer: ${e(info.printerName)}` : ''}</p>
      <p class="helper">Volume: ${e(info.volumeSource)}. Print time: ${e(info.hoursSource)}. Slicer estimates can differ from actual usage and runtime. Check the assigned printer and resin.</p>
      <div class="notice">Recommended: return to your slicer, check total resin including supports and print time, then enter those values.</div>
      <button type="button" class="button secondary" data-action="slicer-metrics" data-id="${id}">Enter values from slicer</button>
      ${canEstimate ? `<div class="notice warning">Optional reconstruction is potentially inaccurate. Grayscale/anti-aliasing, screen calibration and layer-height assumptions affect volume. It does not reconstruct print time.</div>
        ${file ? '' : '<label class="field spaced"><span>Reselect the original sliced file (not stored in backups)</span><input id="resin-reselect" type="file" accept=".sl1,.sl1s,.ctb"></label>'}
        <button type="button" class="text-button spaced" data-action="profile-geometry" data-id="${id}">Use assigned printer dimensions</button>
        <p class="helper">Confirm physical display dimensions and pixel resolution, not the model bounding box. SL1 reconstruction assumes uniform layers after the first; CTB uses per-layer Z positions.</p>
        <div class="field-grid two spaced">${[
          ['Display width', 'widthMm', 'mm', 0.001, 2000], ['Display height', 'heightMm', 'mm', 0.001, 2000],
          ['Resolution X', 'pixelsX', 'px', 1, 32768], ['Resolution Y', 'pixelsY', 'px', 1, 32768],
          ['Normal layer height', 'layerHeightMm', 'mm', 0.000001, 5], ['First layer height', 'firstLayerHeightMm', 'mm', 0.000001, 5],
        ].map(([label, key, suffix, min, max]) => field(label, key, modal.draft?.[key] ?? (key === 'firstLayerHeightMm' ? info.firstLayerHeightMm ?? info.geometry.layerHeightMm : info.geometry[key]) ?? '', { type: 'number', suffix, min, max, step: key.startsWith('pixels') ? 1 : 'any', required: true })).join('')}</div>
        <label class="consent"><input name="estimateConsent" type="checkbox" required> I confirm these dimensions/heights and understand the reconstructed volume may be inaccurate.</label>
        <p id="reconstruction-error" class="helper" role="alert"></p>
        <button type="button" class="button secondary spaced" data-action="reconstruct" data-id="${id}" ${file ? '' : 'disabled'}>Reconstruct volume estimate</button>` :
        `<p class="helper">${plate.volumeMl > 0 ? 'Existing volume is used; reconstruction does not replace available slicer or manually entered volume.' : e(info.reason || 'Reconstruction is unavailable. Use values from your slicer.')}</p>`}`;
    footer = '<button type="button" class="button secondary" data-action="close-modal">Close</button>';
  } else if (kind === 'reconstructing') {
    title = 'Reconstructing volume estimate';
    body = '<p>Reading supported layer images locally. No files are uploaded.</p><progress id="reconstruction-progress" max="100" value="0" aria-label="Reconstruction progress"></progress><p id="reconstruction-status" role="status">0%</p>';
    footer = '<button type="button" class="button secondary" data-action="close-modal">Cancel reconstruction</button>';
  } else if (kind === 'printer' || kind === 'filament') {
    const printer = kind === 'printer';
    const item = (printer ? state.printers : state.filaments).find(profile => profile.id === id);
    title = `${item ? 'Edit' : 'Add'} ${kind} profile`;
    if (printer) {
      const p = { name: '', model: '', watts: '', price: '', lifetime: 6000, maintenance: 0.15, technology: 'fdm',
        fepPerPlate: 0, ipaPerPlate: 0, ppePerPlate: 0, lcdPerHour: 0, washWatts: 0, cureWatts: 0, ...item, ...modal.draft };
      const resin = p.technology === 'resin';
      body = `<div class="preset-panel"><label class="field"><span>Printer catalogue (${printerCatalogue.length} models)</span><select id="printer-catalogue"><option value="">Select a model or enter manually</option>${[...new Set(printerCatalogue.map(entry => entry.brand))].map(brand => `<optgroup label="${e(brand)}">${options(printerCatalogue.filter(entry => entry.brand === brand), '')}</optgroup>`).join('')}</select></label>
        <label class="button secondary file-button spaced">${icon('upload')} Import preset / resin file metadata<input id="preset-upload" type="file" accept=".json,.ini,.cfg,${resinFileAccept}"></label>
        <div id="preset-choice-root">${modal.presets?.length > 1 ? `<label class="field spaced"><span>Imported printer preset</span><select id="preset-choice">${modal.presets.map((preset, index) => `<option value="${index}" ${preset.name === p.name ? 'selected' : ''}>${e(preset.name)}</option>`).join('')}</select></label>` : ''}</div><p id="preset-status" class="helper" role="status">Orca/Bambu JSON; Prusa/SuperSlicer INI; supported resin job metadata. Imports identity and available geometry, not operating costs. External inheritance and native CHITUBOX/Lychee profile exports are not parsed.</p></div>
        <label class="field spaced-bottom"><span>Printer technology</span><select name="technology" data-profile-technology><option value="fdm" ${!resin ? 'selected' : ''}>Filament (FDM)</option><option value="resin" ${resin ? 'selected' : ''}>Resin (SLA / MSLA / DLP)</option></select></label>
        ${field('Printer name', 'name', p.name, { required: true })}${field('Description', 'model', p.model)}
        <div class="field-grid two">${field('Average power draw', 'watts', p.watts, { type: 'number', suffix: 'W', required: true, hint: 'Measured average, not rated peak.' })}${field('Purchase price', 'price', p.price, { type: 'number', suffix: '$', required: true })}${field('Usable print lifetime', 'lifetime', p.lifetime, { type: 'number', min: 1, suffix: 'hr', required: true, hint: 'Estimate; adjust for your printer.' })}${field('Maintenance & upkeep', 'maintenance', p.maintenance, { type: 'number', suffix: '$ / hr', required: true, hint: 'Exclude FEP and LCD wear if entered below.' })}</div>
        ${resin ? `<h3 class="spaced-bottom">Resin consumables & wash/curing power</h3><div class="field-grid two">${field('FEP / vat film reserve', 'fepPerPlate', p.fepPerPlate, { type: 'number', suffix: '$ / plate', required: true })}${field('IPA / cleaning solution', 'ipaPerPlate', p.ipaPerPlate, { type: 'number', suffix: '$ / plate', required: true })}${field('Cleanup / gloves / PPE', 'ppePerPlate', p.ppePerPlate, { type: 'number', suffix: '$ / plate', required: true })}${field('LCD / light-source wear', 'lcdPerHour', p.lcdPerHour, { type: 'number', suffix: '$ / hr', required: true })}${field('Wash station power', 'washWatts', p.washWatts, { type: 'number', suffix: 'W', required: true })}${field('Curing station power', 'cureWatts', p.cureWatts, { type: 'number', suffix: 'W', required: true })}</div><p class="helper">Enter your own reserves. Zero excludes that item. Consumables apply per complete plate; light-source wear applies per print hour.</p>` : ''}
        ${resin ? `<details class="advanced"><summary>Display dimensions for optional reconstruction</summary><div class="field-grid two">${[['Display width', 'widthMm', 'mm'], ['Display height', 'heightMm', 'mm'], ['Resolution X', 'pixelsX', 'px'], ['Resolution Y', 'pixelsY', 'px']].map(([label, key, suffix]) =>
          field(label, `geometry.${key}`, modal.draft?.[`geometry.${key}`] ?? p.geometry?.[key] ?? '', { type: 'number', min: key.startsWith('pixels') ? 1 : 0.001, max: key.startsWith('pixels') ? 32768 : 2000, step: key.startsWith('pixels') ? 1 : 'any', suffix })).join('')}</div><p class="helper">Leave all four blank if unknown. Dimensions must match your physical display. Presets do not define every sliced-file format.</p></details>` : ''}
        <p class="helper">Catalogue entries and slicer presets do not supply purchase price, power or upkeep costs. Resin job files can supply printer identity and display geometry.</p>`;
    } else {
      const f = { name: '', brand: '', colorName: '', color: '#b5c3a5', price: 30, spoolWeight: 1000, density: 1.24, diameter: 1.75,
        kind: modal.materialKind || 'filament', bottleVolume: 1000, wastePercent: 0, ...item, ...modal.draft };
      const resin = f.kind === 'resin';
      title = `${item ? 'Edit' : 'Add'} ${resin ? 'resin' : 'filament'} profile`;
      body = `<label class="field spaced-bottom"><span>Material type</span><select name="kind" data-material-kind><option value="filament" ${!resin ? 'selected' : ''}>Filament</option><option value="resin" ${resin ? 'selected' : ''}>Resin</option></select></label>
        <div class="field-grid two">${field('Material name', 'name', f.name, { required: true })}${field('Brand', 'brand', f.brand, { maxLength: 200 })}${field('Colour name', 'colorName', f.colorName, { maxLength: 200 })}${colourField(f.color)}
        ${field(resin ? 'Bottle price' : 'Spool price', 'price', f.price, { type: 'number', required: true, suffix: '$' })}
        ${resin ? `${field('Bottle volume', 'bottleVolume', f.bottleVolume, { type: 'number', min: 1, required: true, suffix: 'mL' })}${field('Residue / handling waste', 'wastePercent', f.wastePercent, { type: 'number', required: true, suffix: '%', hint: 'Does not include failed reprints.' })}` :
          `${field('Net filament weight', 'spoolWeight', f.spoolWeight, { type: 'number', min: 1, required: true, suffix: 'g' })}${field('Density', 'density', f.density, { type: 'number', min: 0.01, required: true, suffix: 'g/cm³' })}${field('Diameter', 'diameter', f.diameter, { type: 'number', min: 0.1, required: true, suffix: 'mm' })}`}</div>`;
    }
    footer = `<button type="button" class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" type="submit">Save profile ${icon('check')}</button>`;
  } else if (kind === 'plate') {
    const p = { name: '', grams: '', volumeMl: '', hours: '', quantity: 1, technology: 'fdm', washMinutes: 0, cureMinutes: 0,
      ...state.job.plates.find(plate => plate.id === id), ...modal.draft };
    const resin = p.technology === 'resin';
    const printers = compatiblePrinters(p.technology), materials = compatibleMaterials(p.technology);
    title = id ? 'Edit print plate' : 'Add a print plate';
    body = `<label class="field spaced-bottom"><span>Print technology</span><select name="technology" data-plate-technology><option value="fdm" ${!resin ? 'selected' : ''}>Filament (FDM)</option><option value="resin" ${resin ? 'selected' : ''}>Resin</option></select></label>
      ${field('Plate name', 'name', p.name, { required: true })}
      <div class="field-grid two">${field('Print time per plate', 'hours', p.hours, { type: 'number', min: 0.001, required: true, suffix: 'hours', hint: 'Decimal hours: 1h 30m = 1.5' })}${resin ? field('Resin volume per plate', 'volumeMl', p.volumeMl, { type: 'number', min: 0.000001, required: true, suffix: 'mL' }) : field('Filament per plate', 'grams', p.grams, { type: 'number', min: 0.01, required: true, suffix: 'g' })}${field('Number of identical plates', 'quantity', p.quantity, { type: 'number', min: 1, step: 1, required: true })}
      ${resin ? `${field('Wash time per plate', 'washMinutes', p.washMinutes, { type: 'number', suffix: 'min', required: true })}${field('Curing time per plate', 'cureMinutes', p.cureMinutes, { type: 'number', suffix: 'min', required: true })}` : ''}</div>
      <label class="field"><span>Printer</span><select name="printerId" required>${printers.length ? options(printers, p.printerId, favouriteLabel) : '<option value="">Add a matching printer first</option>'}</select></label><label class="field spaced"><span>${resin ? 'Resin' : 'Filament'}</span><select name="filamentId" required>${materials.length ? options(materials, p.filamentId, f => `${favouriteLabel(f)} · ${f.colorName}`) : '<option value="">Add a matching material first</option>'}</select></label>
      <p class="helper">${resin ? 'Check volume and time against your resin slicer, including supports. Wash/cure time calculates station electricity; add hands-on work to post-processing labour.' : 'Include supports, brims and purge waste. Time and weight apply to one complete plate.'}</p>
      ${p.resinImport?.volumeSource === 'reconstructed' ? '<div class="notice warning">Volume was reconstructed and may be inaccurate. Saving confirms you have reviewed this estimate. Enter a checked slicer value to replace it.</div>' : ''}`;
    footer = `<button type="button" class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" type="submit">Save plate ${icon('check')}</button>`;
  } else if (kind === 'studio') {
    title = 'Studio details';
    body = `${field('Studio / seller name', 'name', state.studio.name, { required: true })}${field('Contact email', 'email', state.studio.email, { type: 'email' })}${field('ABN (if applicable)', 'abn', state.studio.abn)}
      <label class="field"><span>Currency</span><select name="currency">${currencies.map(currency => `<option value="${currency}" ${state.job.currency === currency ? 'selected' : ''}>${currency} — ${new Intl.DisplayNames('en', { type: 'currency' }).of(currency)}</option>`).join('')}</select></label>
      <p class="helper spaced-bottom">Changes the current invoice and default for new jobs. Prices are not converted; review all printer, material and labour costs. Saved invoices keep their currency.</p>
      <label class="field"><span>Studio address</span><textarea name="address" rows="3" maxlength="10000">${e(state.studio.address)}</textarea></label>`;
    footer = '<button type="button" class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" type="submit">Save studio</button>';
  } else if (kind === 'backup') {
    title = 'Restore JSON backup?';
    body = `<p class="modal-description">This replaces the current draft, profiles, customers, saved invoices and settings on this site. Download your current backup first.</p><dl class="storage-details"><div><dt>Printers</dt><dd>${pendingBackup.printers.length}</dd></div><div><dt>Filaments</dt><dd>${pendingBackup.filaments.length}</dd></div><div><dt>Customers</dt><dd>${pendingBackup.customers.length}</dd></div><div><dt>Saved invoices</dt><dd>${pendingBackup.saved.length}</dd></div></dl>`;
    footer = '<button type="button" class="button secondary" data-action="backup-export">Back up current data</button><button type="button" class="button primary" data-action="restore-backup">Restore backup</button>';
  } else if (kind === 'remove-profile') {
    const printer = modal.profileType === 'printer';
    const item = (printer ? state.printers : state.filaments).find(profile => profile.id === id);
    const assigned = state.job.plates.filter(plate => (printer ? plate.printerId : plate.filamentId) === id).length;
    title = `Remove ${printer ? 'printer' : materialKind(item) === 'resin' ? 'resin' : 'filament'} profile?`;
    body = `<p>Remove <strong>${e(item.name)}</strong> from the current library?</p>
      ${assigned ? `<div class="notice warning">Used by ${assigned} plate${assigned === 1 ? '' : 's'} in the current project. Reassign or remove those plates in Plates & pricing first.</div>` : ''}
      <p class="helper">Saved invoices keep their own profiles. Opening a saved invoice restores its profile library.</p>`;
    footer = `<button type="button" class="button secondary" data-action="close-modal">Cancel</button><button type="button" class="button primary" data-action="confirm-remove-profile" ${assigned ? 'disabled' : ''}>Remove profile</button>`;
  } else if (kind === 'confirm-new' || kind === 'confirm-reset' || kind === 'confirm-open' || kind === 'confirm-delete') {
    title = kind === 'confirm-reset' ? 'Reset this workspace?' : kind === 'confirm-delete' ? 'Delete this saved invoice?' : kind === 'confirm-open' ? 'Open this saved invoice?' : 'New project?';
    body = `<p class="modal-description">${kind === 'confirm-reset' ? 'This removes all 3-IG data from this browser, including profiles and saved invoices. Download anything you need first. This cannot be undone.' : kind === 'confirm-delete' ? 'This removes the saved snapshot. It does not remove a copy currently open in the workspace.' : 'Save your current project first if you want to keep it. Your current unsaved workspace will be replaced.'}</p>`;
    footer = `<button type="button" class="button secondary" data-action="close-modal">Cancel</button><button type="button" class="button primary" data-action="confirm">${kind === 'confirm-reset' ? 'Reset all local data' : kind === 'confirm-delete' ? 'Delete invoice' : 'Continue'}</button>`;
  }
  document.body.classList.add('modal-open');
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><form id="modal-form"><header class="modal-header"><h2 id="modal-title">${title}</h2><button type="button" class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></header><div class="modal-body">${body}</div><footer class="modal-footer">${footer}</footer></form></section></div>`;
}
function saveDraft() {
  rememberCustomer(state, state.job);
  const snapshot = structuredClone({ job: state.job, printers: state.printers, filaments: state.filaments, studio: state.studio });
  const index = state.saved.findIndex(item => item.job.id === state.job.id);
  if (index >= 0) state.saved[index] = snapshot; else state.saved.unshift(snapshot);
  if (persist()) toast('Invoice snapshot saved on this device.');
  render();
}
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function handleAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === 'resin-options') return showModal('resin-options', id);
  if (action === 'slicer-metrics') return showModal('plate', id);
  if (action === 'reconstruct') return startReconstruction(id);
  if (action === 'profile-geometry') {
    const plate = state.job.plates.find(item => item.id === id);
    const shape = state.printers.find(item => item.id === plate.printerId).geometry;
    if (!shape) { toast('Set all four display dimensions/resolution values in the assigned printer profile first.'); return; }
    refreshModalDraft(shape); return;
  }
  if (action === 'library-view') {
    state.settings.libraryViews[button.dataset.library] = button.dataset.view;
    persist(); render(); return;
  }
  if (action === 'favourite') {
    const item = (button.dataset.type === 'printer' ? state.printers : state.filaments).find(profile => profile.id === id);
    item.favourite = !item.favourite;
    persist(); render(); return;
  }
  if (action === 'modelling-mode') {
    state.job.modelling.mode = button.dataset.mode;
    persist(); render(); return;
  }
  if (action === 'theme') {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    persist(); render(); return;
  }
  if (action === 'use-customer') { selectCustomer(id); return; }
  if (action === 'persistent-storage') { requestPersistentStorage(); return; }
  if (action === 'backup-export') {
    try { download(JSON.stringify(workspaceBackup(state), null, 2), `3-ig-backup-${today()}.json`, 'application/json'); }
    catch (error) { toast(`Backup failed: ${error.message}`); }
    return;
  }
  if (action === 'raw-backup') {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) { toast('No stored data was found.'); return; }
      download(raw, `3-ig-recovery-${today()}.json`, 'application/json');
    } catch (error) { toast(`Recovery download failed: ${error.message}`); }
    return;
  }
  if (action === 'restore-backup') {
    try { localStorage.setItem(storageKey, JSON.stringify(pendingBackup)); }
    catch { toast('Restore failed: browser storage is unavailable or full. Existing data was not replaced.'); return; }
    resinFiles.clear(); state = pendingBackup; storageError = ''; storageWriteError = '';
    closeModal(); view = 'data'; render(); toast('Backup restored.'); return;
  }
  if (action === 'preview' || action === 'save') {
    const invalid = [...root.querySelectorAll('input, select, textarea')].find(input => !input.checkValidity());
    if (invalid) { invalid.reportValidity(); toast('Correct the highlighted field before continuing.'); return; }
  }
  if (action === 'close-modal') return closeModal();
  if (action === 'plate') return showModal('plate');
  if (action === 'edit-plate') return showModal('plate', id);
  if (action === 'preview') return showModal('preview');
  if (action === 'studio') return showModal('studio');
  if (action === 'new') return showModal('confirm-new');
  if (action === 'reset') return showModal('confirm-reset');
  if (action === 'open-saved') return showModal('confirm-open', id);
  if (action === 'delete-saved') return showModal('confirm-delete', id);
  if (action === 'save') return saveDraft();
  if (action === 'add-resin') return showModal('filament', null, { materialKind: 'resin' });
  if (action === 'add-printer' || action === 'add-filament') return showModal(action.replace('add-', ''));
  if (action === 'edit-printer' || action === 'edit-filament') return showModal(action.replace('edit-', ''), id);
  if (action === 'remove-printer' || action === 'remove-filament') return showModal('remove-profile', id, { profileType: action.replace('remove-', '') });
  if (action === 'confirm-remove-profile') {
    try { removeProfile(state, modal.profileType, modal.id); }
    catch (error) { toast(error.message); return; }
    const saved = persist();
    closeModal(); render();
    if (saved) toast('Profile removed. Saved invoices are unchanged.');
    return;
  }
  if (action === 'remove-plate') { resinFiles.delete(id); state.job.plates = state.job.plates.filter(plate => plate.id !== id); persist(); render(); }
  if (action === 'customer-type') {
    state.job.customerType = button.dataset.type;
    state.job.sections.business = button.dataset.type === 'business';
    state.job.sections.address = button.dataset.type === 'business';
    persist(); render();
  }
  if (action === 'confirm') {
    if (modal.kind === 'confirm-reset') {
      try { localStorage.removeItem(storageKey); location.reload(); } catch { toast('Browser storage could not be reset. Check your browser settings.'); }
      return;
    }
    if (modal.kind === 'confirm-new') { resinFiles.clear(); state.job = newJob(false, state.studio.currency); tab = 'plates'; pricingTab = 'printing'; view = 'invoice'; }
    if (modal.kind === 'confirm-open') {
      resinFiles.clear();
      const item = structuredClone(state.saved.find(saved => saved.job.id === modal.id));
      state.job = item.job;
      state.printers = item.printers;
      state.filaments = item.filaments;
      state.studio = item.studio;
      view = 'invoice'; tab = 'plates';
      toast('Snapshot opened, including its profiles and studio details.');
    }
    if (modal.kind === 'confirm-delete') state.saved = state.saved.filter(item => item.job.id !== modal.id);
    closeModal(); persist(); render();
  }
  if (action === 'csv' || action === 'print') {
    if (!state.job.plates.length || state.job.plates.some(plate => !plate.verified || plate.hours <= 0 || (plate.technology === 'resin' ? plate.volumeMl <= 0 : plate.grams <= 0))) {
      toast('Add at least one plate and review all print times and material quantities before exporting.'); return;
    }
    if (!state.job.customer.name.trim() || !state.job.number.trim() || !state.job.date || !state.studio.name.trim()) {
      toast('Set a customer name, invoice number, issue date and studio name before exporting.'); return;
    }
    if (state.job.taxEnabled && (!state.job.sections.business || !state.studio.abn.trim())) {
      toast('For a GST invoice, add your studio ABN and enable business details.'); return;
    }
  }
  const safeNumber = state.job.number.replace(/[^a-zA-Z0-9_-]/g, '-') || 'invoice';
  if (action === 'csv') {
    download(invoiceCSV(state.job, totals()), `${safeNumber}.csv`, 'text/csv;charset=utf-8');
    rememberCustomer(state, state.job); persist();
  }
  if (action === 'print') {
    rememberCustomer(state, state.job); persist();
    document.querySelector('#print-root').innerHTML = invoiceHTML();
    const oldTitle = document.title;
    document.title = `${state.job.number} - ${state.studio.name}`;
    window.addEventListener('afterprint', () => { document.title = oldTitle; }, { once: true });
    window.print();
  }
}
document.addEventListener('click', event => {
  const nav = event.target.closest('[data-nav]');
  if (nav) { event.preventDefault(); view = nav.dataset.nav; render(); return; }
  const pricingButton = event.target.closest('[data-pricing-tab]');
  if (pricingButton) { pricingTab = pricingButton.dataset.pricingTab; render(); return; }
  const tabButton = event.target.closest('[data-tab]');
  if (tabButton) { tab = tabButton.dataset.tab; render(); return; }
  const button = event.target.closest('[data-action]');
  if (button) handleAction(button);
  if (event.target.classList.contains('modal-backdrop')) closeModal();
});
document.addEventListener('keydown', event => {
  if (event.target.matches('[role="tab"]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const tabs = ['plates', 'customer', 'export'];
    const index = tabs.indexOf(tab);
    tab = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[2] : tabs[(index + (event.key === 'ArrowRight' ? 1 : 2)) % 3];
    render(); root.querySelector(`[role="tab"][data-tab="${tab}"]`).focus();
    return;
  }
  if (!modal) return;
  if (event.key === 'Escape') closeModal();
  if (event.key === 'Tab') {
    const elements = [...modalRoot.querySelectorAll('button, input, select, textarea, a[href]')].filter(item => !item.disabled && item.offsetParent !== null);
    const first = elements[0], last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
document.addEventListener('change', event => {
  const input = event.target;
  if (input.id === 'gcode-upload') { importFiles(input.files); return; }
  if (input.id === 'backup-upload') { importBackup(input.files[0]); input.value = ''; return; }
  if (input.id === 'preset-upload') { importPreset(input.files[0]); input.value = ''; return; }
  if (input.id === 'resin-reselect') { reselectResin(input.files[0]); return; }
  if (input.matches('[data-profile-technology], [data-material-kind], [data-plate-technology]')) {
    refreshModalDraft(input.matches('[data-plate-technology]') ? { printerId: '', filamentId: '' } : {});
    return;
  }
  if (input.id === 'printer-catalogue') {
    const preset = printerCatalogue.find(item => item.id === input.value);
    if (preset) applyPrinterPreset({ name: preset.name, model: preset.name, technology: preset.technology, source: 'Built-in catalogue' });
    return;
  }
  if (input.id === 'preset-choice') { applyPrinterPreset(modal.presets[Number(input.value)]); return; }
  if (input.name === 'existing-customer') { selectCustomer(input.value); return; }
  updateField(input, true);
});
document.addEventListener('input', event => {
  const input = event.target;
  if (input.matches('[data-colour-picker]')) {
    modalRoot.querySelector('[name="color"]').value = input.value; return;
  }
  if (input.name === 'color' && modal) {
    const hex = normalizeHex(input.value);
    if (hex) modalRoot.querySelector('[data-colour-picker]').value = hex;
    return;
  }
  if (input.dataset.librarySearch) {
    const key = input.dataset.librarySearch;
    searches[key] = input.value;
    root.querySelector(`#${key}-results`).innerHTML = key === 'customers' ? customerList(input.value) : profileList(key === 'printers' ? 'printer' : 'filament');
    return;
  }
  if (event.target.matches('input:not([type="checkbox"]):not([type="file"]), textarea')) updateField(event.target, false);
});
function updateField(input, report) {
  if (input.closest('#modal-root') || !input.name) return;
  if (!input.checkValidity()) { if (report) input.reportValidity(); return; }
  const [scope, key, property] = input.name.split('.');
  let value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
  if (input.type === 'number' && (input.value === '' || !Number.isFinite(value))) { if (report) toast('Please enter a valid number.'); return; }
  if (scope === 'job') state.job[key] = value;
  if (scope === 'customer') state.job.customer[key] = value;
  if (scope === 'section') state.job.sections[key] = value;
  if (scope === 'modelling') state.job.modelling[key] = value;
  if (scope === 'plate') {
    const plate = state.job.plates.find(item => item.id === key);
    plate[property] = value;
    if (property === 'filamentId' && plate.lengthMm) {
      const filament = state.filaments.find(item => item.id === value);
      plate.grams = plate.lengthMm * Math.PI * (filament.diameter / 2) ** 2 / 1000 * filament.density;
    }
  }
  persist();
  if (scope === 'section' || (scope === 'modelling' && key === 'enabled')) { render(); return; }
  if (scope === 'modelling' && root.querySelector('.modelling-amount')) root.querySelector('.modelling-amount').textContent = money(totals().modelling);
  if (scope === 'plate') {
    const plate = state.job.plates.find(item => item.id === key);
    const index = state.job.plates.indexOf(plate);
    input.closest('.plate').outerHTML = plateCard(plate, index, totals().lines[index]);
  }
  const summaryElement = root.querySelector('.summary-column');
  if (summaryElement) {
    const template = document.createElement('template');
    template.innerHTML = summary(totals());
    for (const selector of ['.summary-stats', '.cost-breakdown', '.cost-subtotal', '.pricing-totals', '.grand-total', '.schedule-card']) {
      summaryElement.querySelector(selector).replaceWith(template.content.querySelector(selector));
    }
  }
}
document.addEventListener('submit', event => {
  if (event.target.id !== 'modal-form') return;
  event.preventDefault();
  if (modal.kind === 'resin-options') { startReconstruction(modal.id); return; }
  if (modal.kind === 'reconstructing') return;
  if (!event.target.reportValidity()) return;
  const values = Object.fromEntries(new FormData(event.target));
  for (const input of event.target.querySelectorAll('input[type="number"]')) values[input.name] = Number(input.value);
  if ('name' in values && !values.name.trim()) { toast('Please enter a name, not just spaces.'); return; }
  const { kind, id } = modal;
  if (kind === 'studio') { state.studio = values; state.job.currency = values.currency; }
  if (kind === 'printer' || kind === 'filament') {
    const collection = kind === 'printer' ? state.printers : state.filaments;
    const index = collection.findIndex(item => item.id === id);
    const current = collection[index];
    if (current && state.job.plates.some(plate => (kind === 'printer' ? plate.printerId : plate.filamentId) === id) &&
      (kind === 'printer' ? printerTechnology(current) !== values.technology : materialKind(current) !== values.kind)) {
      toast('This profile is assigned to a plate. Add a separate profile for a different technology.'); return;
    }
    if (kind === 'filament') values.color = normalizeHex(values.color);
    if (kind === 'printer') {
      const keys = ['widthMm', 'heightMm', 'pixelsX', 'pixelsY'];
      const filled = keys.filter(key => event.target.elements[`geometry.${key}`]?.value.trim());
      if (filled.length && filled.length !== 4) { toast('Enter all four display geometry fields or leave them all blank.'); return; }
      if (filled.length) values.geometry = Object.fromEntries(keys.map(key => [key, values[`geometry.${key}`]]));
      else if (values.technology === 'resin') values.geometry = undefined;
      for (const key of keys) delete values[`geometry.${key}`];
    }
    const profile = { ...(current || { id: uid(), color: '#596c58', favourite: false }), ...values, ...(kind === 'printer' && modal.presetSource ? { source: modal.presetSource } : {}) };
    if (index >= 0) collection[index] = profile; else collection.push(profile);
    if (kind === 'filament' && materialKind(profile) === 'filament') for (const plate of state.job.plates.filter(plate => plate.filamentId === profile.id && plate.lengthMm)) {
      plate.grams = plate.lengthMm * Math.PI * (profile.diameter / 2) ** 2 / 1000 * profile.density;
    }
  }
  if (kind === 'plate') {
    const index = state.job.plates.findIndex(plate => plate.id === id);
    const previous = state.job.plates[index];
    const plate = { ...(previous || { id: uid(), detail: 'Manual entry' }), ...values, verified: true };
    if (plate.resinImport) {
      plate.resinImport = { ...plate.resinImport };
      if (values.volumeMl !== previous.volumeMl) plate.resinImport.volumeSource = 'manual';
      if (values.hours !== previous.hours) plate.resinImport.hoursSource = 'manual';
    }
    if (plate.technology === 'resin') plate.grams = 0;
    else { plate.volumeMl = 0; plate.washMinutes = 0; plate.cureMinutes = 0; delete plate.resinImport; resinFiles.delete(plate.id); }
    delete plate.lengthMm;
    if (index >= 0) state.job.plates[index] = plate; else state.job.plates.push(plate);
  }
  const saved = persist();
  closeModal(); render();
  if (saved) toast(kind === 'plate' ? 'Plate ready. Pricing updated.' : 'Details saved on this device.');
});
function selectCustomer(id) {
  const saved = state.customers.find(item => item.id === id);
  state.job.customer = saved ? Object.fromEntries(['id', 'name', 'email', 'company', 'address', 'abn'].map(key => [key, saved[key]])) : { name: '', email: '', company: '', address: '', abn: '' };
  state.job.customerType = saved?.type || 'individual';
  state.job.sections.business = state.job.customerType === 'business';
  state.job.sections.address = state.job.customerType === 'business';
  view = 'invoice'; tab = 'customer'; persist(); render();
}
function refreshModalDraft(changes = {}) {
  const form = modalRoot.querySelector('#modal-form');
  modal.draft = { ...modal.draft, ...Object.fromEntries(new FormData(form)), ...changes };
  renderModal();
}
function applyPrinterPreset(preset) {
  refreshModalDraft({ name: preset.name, model: preset.model, technology: preset.technology,
    ...Object.fromEntries(Object.entries(preset.geometry || {}).map(([key, value]) => [`geometry.${key}`, value])) });
  modal.presetSource = preset.source;
  document.querySelector('#preset-status').textContent = `${preset.name} selected. Review purchase price, power draw and upkeep costs before saving.`;
}
async function importPreset(file) {
  if (!file) return;
  const currentModal = modal;
  try {
    let presets;
    if (resinExtensions.test(file.name)) {
      const info = await inspectResin(file);
      if (!info.printerName) throw new Error('This sliced file has no printer identity. Enter the printer manually; its plate metrics can still be imported.');
      const shape = Object.fromEntries(['widthMm', 'heightMm', 'pixelsX', 'pixelsY'].map(key => [key, info.geometry[key]]));
      presets = [{ name: info.printerName, model: info.printerName, technology: 'resin', source: `${info.format} file metadata`,
        ...(Object.values(shape).every(value => value > 0) ? { geometry: shape } : {}) }];
    } else {
      if (file.size > 5 * 1024 * 1024) throw new Error('Maximum preset file size is 5 MB.');
      presets = parsePrinterPresets(await file.text(), file.name);
    }
    if (modal !== currentModal) return;
    modal.presets = presets;
    document.querySelector('#preset-choice-root').innerHTML = presets.length > 1 ? `<label class="field spaced"><span>Imported printer preset</span><select id="preset-choice">${presets.map((preset, index) => `<option value="${index}">${e(preset.name)}</option>`).join('')}</select></label>` : '';
    applyPrinterPreset(presets[0]);
  } catch (error) {
    if (modal === currentModal) document.querySelector('#preset-status').textContent = `Import failed: ${error.message}`;
    toast(`Preset import failed: ${error.message}`);
  }
}
async function importBackup(file) {
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Maximum backup file size is 5 MB.');
    const parsed = readWorkspace(JSON.parse(await file.text()));
    pendingBackup = parsed;
    showModal('backup');
  } catch (error) { toast(`Backup import failed: ${error.message} Existing data was not changed.`); }
}
async function requestPersistentStorage() {
  if (!navigator.storage?.persist) { toast('Persistent-storage requests are not supported in this browser. Download JSON backups.'); return; }
  try {
    const granted = await navigator.storage.persist();
    persistentStorage = granted ? 'Persistent storage granted' : 'Browser-managed (request not granted)';
    if (view === 'data') render();
    toast(granted ? 'Persistent storage granted. Clearing site data still removes it.' : 'The browser did not grant persistent storage. Browser storage still works; keep JSON backups.');
  } catch (error) { toast(`Storage request failed: ${error.message}`); }
}
async function importFiles(files) {
  if (importing || !files?.length) return;
  files = [...files];
  if (files.length > 50) { toast('Import at most 50 sliced files at once.'); return; }
  importing = true; render();
  const targetJob = state.job;
  const issues = [];
  let count = 0;
  for (const file of files) {
    const resin = resinExtensions.test(file.name);
    if (!resin && !/\.(gcode|gco|g)$/i.test(file.name)) { issues.push(`${file.name}: use supported G-code, Photon Workshop / Anycubic, Photon/PhotonS, SL1/SL1S, GOO V3.0 or CTB v2/v3 files; other formats need manual slicer metrics.`); continue; }
    if (!resin && file.size > 25 * 1024 * 1024) { issues.push(`${file.name}: maximum G-code size is 25 MB.`); continue; }
    try {
      const technology = resin ? 'resin' : 'fdm';
      const source = resin ? await inspectResin(file) : await file.text();
      if (state.job !== targetJob) { issues.push('Import cancelled because the current project changed.'); break; }
      const filament = compatibleMaterials(technology)[0], printers = compatiblePrinters(technology);
      if (!filament || !printers.length) throw new Error(`Add a ${resin ? 'resin printer and resin' : 'FDM printer and filament'} profile with your operating costs first.`);
      const metrics = resin ? source : parseGcode(source, filament.density, filament.diameter);
      const missingMetrics = [metrics.hours === null ? 'print time' : '', (resin ? metrics.volumeMl : metrics.grams) === null ? resin ? 'resin volume' : 'filament weight' : ''].filter(Boolean);
      const missing = missingMetrics.length > 0;
      const identity = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
      const printer = resin && metrics.printerName ? printers.find(item => identity(`${item.name} ${item.model}`).includes(identity(metrics.printerName))) || printers[0] : printers[0];
      const plate = { id: uid(), name: file.name.replace(/\.[^.]+$/, '').replaceAll('_', ' '), detail: file.name,
        hours: metrics.hours ?? 0, grams: resin ? 0 : metrics.grams ?? 0, quantity: 1, technology, volumeMl: resin ? metrics.volumeMl ?? 0 : 0, washMinutes: 0, cureMinutes: 0,
        printerId: printer.id, filamentId: filament.id, verified: !missing,
        ...(resin ? { resinImport: { ...metrics, hours: undefined, volumeMl: undefined, fileSize: file.size,
          firstLayerHeightMm: metrics.firstLayerHeightMm ?? null, hoursSource: metrics.hours === null ? 'missing' : 'slicer',
          volumeSource: metrics.volumeMl === null ? 'missing' : 'slicer' } } : { lengthMm: metrics.lengthMm }) };
      state.job.plates.push(plate);
      if (resin) resinFiles.set(plate.id, file);
      if (missing) issues.push(`${file.name}: missing or invalid ${missingMetrics.join(' and ')}. Use slicer values${resin ? ' or open the plate import options for reconstruction availability' : ''}.`);
      if (resin) issues.push(`${file.name}: confirm the suggested printer (${printer.name}) and resin (${filament.name}) before invoicing.`);
      count++;
    } catch (error) { issues.push(`${file.name}: ${error.message}`); }
  }
  importing = false;
  const saved = persist();
  render();
  if (issues.length) {
    const notice = document.createElement('div'); notice.className = 'notice warning import-notice'; notice.setAttribute('role', 'alert');
    notice.textContent = issues.join('\n');
    root.querySelector('.plates-card')?.append(notice);
  }
  if (saved) toast(`${count} plate${count !== 1 ? 's' : ''} imported.${issues.length ? ' Review import notices and plate assignments.' : ' Your pricing is up to date.'}`);
}
async function reselectResin(file) {
  if (!file || modal?.kind !== 'resin-options') return;
  const currentModal = modal, plate = state.job.plates.find(item => item.id === modal.id);
  try {
    if (file.name !== plate.detail || file.size !== plate.resinImport.fileSize) throw new Error('Select the original file with the same name and size, or import it as a new plate.');
    const info = await inspectResin(file);
    if (info.format !== plate.resinImport.format || info.layers !== plate.resinImport.layers) throw new Error('The reselected file does not match this plate.');
    if (modal !== currentModal) return;
    resinFiles.set(plate.id, file);
    refreshModalDraft();
  } catch (error) { toast(`Cannot reselect sliced file: ${error.message}`); }
}
function startReconstruction(id) {
  const form = modalRoot.querySelector('#modal-form');
  if (!form.reportValidity()) return;
  const file = resinFiles.get(id), plate = state.job.plates.find(item => item.id === id), targetJob = state.job;
  if (!file) { toast('Reselect the original sliced file first.'); return; }
  let shape;
  try { shape = reconstructionGeometry(Object.fromEntries(new FormData(form))); }
  catch (error) { document.querySelector('#reconstruction-error').textContent = error.message; return; }
  shape.firstLayerHeightMm = Number(form.elements.firstLayerHeightMm.value);
  let worker;
  try { worker = new Worker(new URL('./resin-worker.js', import.meta.url), { type: 'module' }); }
  catch (error) { document.querySelector('#reconstruction-error').textContent = `Reconstruction unavailable: ${error.message}. Use slicer values instead.`; return; }
  reconstruction = { worker };
  modal = { kind: 'reconstructing', id };
  renderModal();
  const failed = message => {
    worker.terminate(); reconstruction = null;
    if (state.job !== targetJob) return;
    showModal('resin-options', id, { draft: shape });
    document.querySelector('#reconstruction-error').textContent = `Reconstruction failed: ${message}. Enter slicer values instead.`;
  };
  worker.onerror = event => { if (reconstruction?.worker === worker) failed(event.message || 'The reconstruction worker could not run'); };
  worker.onmessage = ({ data }) => {
    if (reconstruction?.worker !== worker) return;
    if (data.error) { failed(data.error); return; }
    if (data.volumeMl !== undefined) {
      worker.terminate(); reconstruction = null;
      if (state.job !== targetJob || !state.job.plates.includes(plate)) return;
      if (!Number.isFinite(data.volumeMl) || data.volumeMl <= 0) { failed('Invalid reconstructed volume'); return; }
      plate.volumeMl = data.volumeMl; plate.verified = false;
      plate.resinImport = { ...plate.resinImport, geometry: shape, firstLayerHeightMm: shape.firstLayerHeightMm, volumeSource: 'reconstructed' };
      persist(); closeModal(); render(); showModal('plate', id);
      toast('Potentially inaccurate reconstructed volume. Review and save the plate before export.');
    } else {
      document.querySelector('#reconstruction-progress').value = data.progress;
      document.querySelector('#reconstruction-status').textContent = `${data.progress}%`;
    }
  };
  worker.postMessage({ file, geometry: shape });
}
document.addEventListener('dragover', event => {
  if (event.target.closest('#drop-zone')) { event.preventDefault(); event.target.closest('#drop-zone').classList.add('dragging'); }
});
document.addEventListener('dragleave', event => { event.target.closest('#drop-zone')?.classList.remove('dragging'); });
document.addEventListener('drop', event => {
  if (event.target.closest('#drop-zone')) { event.preventDefault(); importFiles(event.dataTransfer.files); }
});
render();
if (!storageError) persist();
if (navigator.storage?.persisted) {
  navigator.storage.persisted().then(granted => {
    persistentStorage = granted ? 'Persistent storage granted' : 'Browser-managed';
    const label = document.querySelector('#persistence-status');
    if (label) label.textContent = persistentStorage;
  }).catch(error => {
    persistentStorage = `Storage policy unavailable: ${error.message}`;
    const label = document.querySelector('#persistence-status');
    if (label) label.textContent = persistentStorage;
  });
}
