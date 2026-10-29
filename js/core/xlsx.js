/* Genera archivos de Excel (.xlsx) reales, sin librerías: un .xlsx es un ZIP con
   archivos XML. Varias hojas con los colores de la app (encabezado rojo, totales grafito),
   filas alternadas, filtros, primera fila fija, fechas, montos, FÓRMULAS (se recalculan
   solas si la persona cambia un dato) y el logo del gimnasio en la hoja de resumen. */

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
  for (const [name, content] of files) {
    const nameB = enc.encode(name), data = typeof content === "string" ? enc.encode(content) : content, crc = crc32(data);
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

/* Colores de la app: rojo de la marca, grafito y grises */
const RED = "FFD11F2A", INK = "FF1C1C1E", ZEBRA = "FFF4F4F5", LINE = "FFD9D9DE", MUTED = "FF6B6B70", OK = "FF1E8E4F";
const NUMFMT = { text: 0, int: 0, money: 164, date: 165, month: 166 };
/* fuentes: 0 normal · 1 blanca negrita · 2 título · 3 gris chico · 4 negrita · 5 negrita grande · 6 verde negrita · 7 roja negrita */
const FONTS = [
  `<font><sz val="11"/><color rgb="${INK}"/><name val="Calibri"/></font>`,
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>`,
  `<font><b/><sz val="20"/><color rgb="${INK}"/><name val="Calibri"/></font>`,
  `<font><sz val="10"/><color rgb="${MUTED}"/><name val="Calibri"/></font>`,
  `<font><b/><sz val="11"/><color rgb="${INK}"/><name val="Calibri"/></font>`,
  `<font><b/><sz val="14"/><color rgb="${INK}"/><name val="Calibri"/></font>`,
  `<font><b/><sz val="14"/><color rgb="${OK}"/><name val="Calibri"/></font>`,
  `<font><b/><sz val="14"/><color rgb="${RED}"/><name val="Calibri"/></font>`,
];
/* rellenos: 0 nada · 1 (obligatorio) · 2 rojo · 3 gris alternado · 4 grafito */
const FILLS = ["none", "gray125", RED, ZEBRA, INK].map((f) => (f === "none" || f === "gray125") ? `<fill><patternFill patternType="${f}"/></fill>` : `<fill><patternFill patternType="solid"><fgColor rgb="${f}"/><bgColor indexed="64"/></patternFill></fill>`);
const BORDERS = [`<border><left/><right/><top/><bottom/><diagonal/></border>`, `<border>${["left", "right", "top", "bottom"].map((s) => `<${s} style="thin"><color rgb="${LINE}"/></${s}>`).join("")}<diagonal/></border>`];

const xfs = [];
const XF = {};
const addXf = (name, { num = 0, font = 0, fill = 0, border = 1, h = "center", wrap = false }) => {
  XF[name] = xfs.length;
  xfs.push(`<xf numFmtId="${num}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${h}" vertical="center"${wrap ? ' wrapText="1"' : ""}/></xf>`);
};
addXf("head", { font: 1, fill: 2, wrap: true });
const KINDS = ["text", "int", "money", "date", "month"];
KINDS.forEach((k) => {
  addXf(`${k}-plain`, { num: NUMFMT[k], h: k === "text" ? "left" : "center" });
  addXf(`${k}-zebra`, { num: NUMFMT[k], fill: 3, h: k === "text" ? "left" : "center" });
  addXf(`${k}-total`, { num: NUMFMT[k], font: 1, fill: 4, h: k === "text" ? "left" : "center" });
});
/* estilos de la hoja de resumen (diseño libre) */
addXf("title", { font: 2, border: 0, h: "left" });
addXf("sub", { font: 3, border: 0, h: "left" });
addXf("sec", { font: 1, fill: 4, h: "left" });
addXf("label", { h: "left" });
addXf("hint", { font: 3, h: "left", wrap: true });
addXf("big", { font: 5, h: "center" });
addXf("bigmoney", { num: 164, font: 5, h: "center" });
addXf("goodmoney", { num: 164, font: 6, h: "center" });
addXf("badmoney", { num: 164, font: 7, h: "center" });
addXf("blank", { border: 0 });

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;$&quot;\\ #,##0"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="mmmm\\ yyyy"/></numFmts>
<fonts count="${FONTS.length}">${FONTS.join("")}</fonts>
<fills count="${FILLS.length}">${FILLS.join("")}</fills>
<borders count="${BORDERS.length}">${BORDERS.join("")}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/* Un valor de celda puede ser un dato simple o una fórmula: { f: "SUM(A2:A9)", v: valor_calculado } */
function cellXml(val, type, ref, style) {
  const s = XF[style] ?? XF[`${type}-plain`];
  const isF = val && typeof val === "object" && "f" in val;
  const v = isF ? val.v : val;
  const f = isF ? `<f>${esc(val.f)}</f>` : "";
  if (v === "" || v === null || v === undefined) return `<c r="${ref}" s="${s}">${f}</c>`;
  if (type === "money" || type === "int") return `<c r="${ref}" s="${s}">${f}<v>${Number(v) || 0}</v></c>`;
  if (type === "date" || type === "month") return `<c r="${ref}" s="${s}">${f}<v>${isF ? v : serial(v)}</v></c>`;
  if (isF) return `<c r="${ref}" s="${s}" t="str">${f}<v>${esc(v)}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

const FOOT = (hasDrawing) => `<pageMargins left="0.5" right="0.5" top="0.7" bottom="0.7" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>${hasDrawing ? `<drawing r:id="rId1"/>` : ""}
</worksheet>`;
const HEAD = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`;

/* Hoja de tabla: encabezado en la fila 1 (lista para filtrar o importar a una base de datos) */
function tableXml(sheet) {
  const cols = sheet.columns;
  const head = `<row r="1" ht="34" customHeight="1">${cols.map((c, i) => `<c r="${colName(i)}1" s="${XF.head}" t="inlineStr"><is><t>${esc(c.header)}</t></is></c>`).join("")}</row>`;
  const n = sheet.rows.length;
  const body = sheet.rows.map((row, ri) => `<row r="${ri + 2}" ht="20" customHeight="1">${cols.map((c, ci) => {
    const val = c.formula ? { f: c.formula(ri + 2, n), v: row[c.key] } : row[c.key];
    return cellXml(val, c.type, colName(ci) + (ri + 2), `${c.type}-${ri % 2 ? "zebra" : "plain"}`);
  }).join("")}</row>`).join("");
  const tr = n + 3;                                         // fila de totales: una fila en blanco después de los datos
  const total = sheet.total ? `<row r="${tr}" ht="24" customHeight="1">${cols.map((c, ci) => { const t = c.type === "money" || c.type === "int" ? c.type : "text"; return cellXml(sheet.total(c, colName(ci), n), t, colName(ci) + tr, `${t}-total`); }).join("")}</row>` : "";
  const last = `${colName(cols.length - 1)}${Math.max(2, n + 1)}`;
  return `${HEAD}
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="20"/>
<cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 16}" customWidth="1"/>`).join("")}</cols>
<sheetData>${head}${body}${total}</sheetData>
<autoFilter ref="A1:${last}"/>
${FOOT(false)}`;
}

/* Hoja de diseño libre (resumen): filas de celdas { v, t: tipo, s: estilo, span: columnas que ocupa } */
function freeXml(sheet, hasDrawing) {
  const merges = [];
  const rows = sheet.rows.map((r, ri) => {
    let col = 0;
    const cells = (r.cells || []).map((c) => {
      const ref = colName(col) + (ri + 1);
      if (c.span > 1) merges.push(`${ref}:${colName(col + c.span - 1)}${ri + 1}`);
      const out = cellXml(c.v, c.t || "text", ref, c.s) + (c.span > 1 ? Array.from({ length: c.span - 1 }, (_, k) => `<c r="${colName(col + k + 1)}${ri + 1}" s="${XF[c.s] ?? 0}"/>`).join("") : "");
      col += c.span || 1;
      return out;
    }).join("");
    return `<row r="${ri + 1}"${r.ht ? ` ht="${r.ht}" customHeight="1"` : ""}>${cells}</row>`;
  }).join("");
  return `${HEAD}
<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="20"/>
<cols>${sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${rows}</sheetData>
${merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : ""}
${FOOT(hasDrawing)}`;
}

/* sheets: [{ name, columns, rows, total? }] (tabla) o [{ name, free: true, widths, rows, logo? }] (resumen)
   logo: { data: Uint8Array (PNG), svg?: texto SVG (calidad vectorial en Excel 2016+; el PNG queda de respaldo), w, h } se dibuja arriba a la izquierda de la hoja que tenga `logo: true` */
export function makeXlsx(sheets, { logo = null } = {}) {
  const li = logo ? sheets.findIndex((s) => s.logo) : -1;
  const files = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="svg" ContentType="image/svg+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}${li >= 0 ? `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` : ""}</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", STYLES],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, s.free ? freeXml(s, i === li) : tableXml(s)]),
  ];
  if (li >= 0) {
    const EMU = 9525;
    files.push(
      [`xl/worksheets/_rels/sheet${li + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`],
      ["xl/drawings/_rels/drawing1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/>${logo.svg ? `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.svg"/>` : ""}</Relationships>`],
      ["xl/drawings/drawing1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>${6 * EMU}</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>${8 * EMU}</xdr:rowOff></xdr:from><xdr:ext cx="${logo.w * EMU}" cy="${logo.h * EMU}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1">${logo.svg ? `<a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId2"/></a:ext></a:extLst>` : ""}</a:blip><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${logo.w * EMU}" cy="${logo.h * EMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`],
      ["xl/media/logo.png", logo.data],
      ...(logo.svg ? [["xl/media/logo.svg", logo.svg]] : []),
    );
  }
  return zip(files);
}
