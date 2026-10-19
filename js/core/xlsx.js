/* Genera archivos de Excel (.xlsx) reales, sin librerías: un .xlsx es un ZIP con
   archivos XML. Varias hojas, encabezado celeste, todo centrado, filas alternadas,
   filtros, primera fila fija, fechas, montos y FÓRMULAS (suman y se recalculan solas
   si la persona modifica algún dato). */

/* ---------------------------------------------------------------- ZIP (sin compresión) */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const enc = new TextEncoder();

function zip(files) {
  const parts = [], central = [];
  let offset = 0;
  const u16 = (v) => new Uint8Array([v & 255, (v >> 8) & 255]);
  const u32 = (v) => new Uint8Array([v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]);
  const cat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let o = 0; a.forEach((x) => { out.set(x, o); o += x.length; }); return out; };
  const time = 0, date = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const [name, text] of files) {
    const nameB = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const local = cat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(nameB.length), u16(0), nameB, data);
    central.push(cat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameB));
    parts.push(local);
    offset += local.length;
  }
  const cd = cat(...central);
  const end = cat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0));
  return new Blob([...parts, cd, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* ---------------------------------------------------------------- XLSX */
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const colName = (i) => { let s = ""; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
const serial = (ts) => { const d = new Date(ts); return (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000; };

/* Estilos: todos centrados, con borde fino. Combinaciones: formato de número × (normal | fila alternada | total | encabezado) */
const NUMFMT = { text: 0, int: 0, money: 164, date: 165, month: 166 };
const KINDS = ["text", "int", "money", "date", "month"];
const VARIANTS = ["plain", "zebra", "total"];           // fill 0 / 3 / 4
const FILL = { plain: 0, zebra: 3, total: 4 };
const xfIndex = (type, variant) => 1 + KINDS.indexOf(type) * VARIANTS.length + VARIANTS.indexOf(variant);   // 0 = encabezado
const xfs = [`<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`];
KINDS.forEach((k) => VARIANTS.forEach((v) => xfs.push(`<xf numFmtId="${NUMFMT[k]}" fontId="${v === "total" ? 1 : 0}" fillId="${FILL[v]}" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`)));
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;$&quot;\\ #,##0"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="mmmm\\ yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF1F3864"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF9DC3E6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F8FD"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDEBF7"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBFC9D6"/></left><right style="thin"><color rgb="FFBFC9D6"/></right><top style="thin"><color rgb="FFBFC9D6"/></top><bottom style="thin"><color rgb="FFBFC9D6"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length + 0}">${xfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/* Un valor de celda puede ser un dato simple o una fórmula: { f: "SUM(A2:A9)", v: valor_calculado } */
function cellXml(val, type, ref, variant) {
  const s = xfIndex(type, variant);
  const isF = val && typeof val === "object" && "f" in val;
  const v = isF ? val.v : val;
  const f = isF ? `<f>${esc(val.f)}</f>` : "";
  if (v === "" || v === null || v === undefined) return `<c r="${ref}" s="${s}">${f}</c>`;
  if (type === "money" || type === "int") return `<c r="${ref}" s="${s}">${f}<v>${Number(v) || 0}</v></c>`;
  if (type === "date" || type === "month") return `<c r="${ref}" s="${s}">${f}<v>${isF ? v : serial(v)}</v></c>`;
  if (isF) return `<c r="${ref}" s="${s}" t="str">${f}<v>${esc(v)}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

function sheetXml(sheet) {
  const cols = sheet.columns;
  const head = `<row r="1" ht="32" customHeight="1">${cols.map((c, i) => `<c r="${colName(i)}1" s="0" t="inlineStr"><is><t>${esc(c.header)}</t></is></c>`).join("")}</row>`;
  const n = sheet.rows.length;
  const body = sheet.rows.map((row, ri) => `<row r="${ri + 2}" ht="20" customHeight="1">${cols.map((c, ci) => {
    const val = c.formula ? { f: c.formula(ri + 2, n), v: row[c.key] } : row[c.key];
    return cellXml(val, c.type, colName(ci) + (ri + 2), ri % 2 ? "zebra" : "plain");
  }).join("")}</row>`).join("");
  const tr = n + 3;                                         // fila de totales: una fila en blanco después de los datos
  const total = sheet.total ? `<row r="${tr}" ht="22" customHeight="1">${cols.map((c, ci) => cellXml(sheet.total(c, colName(ci), n), c.type === "money" || c.type === "int" ? c.type : "text", colName(ci) + tr, "total")).join("")}</row>` : "";
  const last = `${colName(cols.length - 1)}${n + 1}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="20"/>
<cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 16}" customWidth="1"/>`).join("")}</cols>
<sheetData>${head}${body}${total}</sheetData>
<autoFilter ref="A1:${last}"/>
<pageMargins left="0.5" right="0.5" top="0.7" bottom="0.7" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

/* sheets: [{ name, columns: [{ header, key, type, width, formula?(fila, nFilas) }], rows: [{...}], total?(col, letra, nFilas) }] */
export function makeXlsx(sheets) {
  const files = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", STYLES],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ];
  return zip(files);
}
