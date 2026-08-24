/* GVAS (UE 5.5+ tagged property format) reader/writer for Titan Quest 2 saves. */
(function (root) {
'use strict';

const TD = new TextDecoder('utf-8');
const TE = new TextEncoder();

class Reader {
  constructor(buf, off = 0, end = null) {
    this.b = buf; this.o = off; this.end = end === null ? buf.length : end;
    this.dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  left() { return this.end - this.o; }
  bytes(n) { const v = this.b.subarray(this.o, this.o + n); this.o += n; return v; }
  i32() { const v = this.dv.getInt32(this.o, true); this.o += 4; return v; }
  u32() { const v = this.dv.getUint32(this.o, true); this.o += 4; return v; }
  i64() { const v = this.dv.getBigInt64(this.o, true); this.o += 8; return v; }
  u8() { return this.b[this.o++]; }
  f32() { const v = this.dv.getFloat32(this.o, true); this.o += 4; return v; }
  f64() { const v = this.dv.getFloat64(this.o, true); this.o += 8; return v; }
  str() {
    const n = this.i32();
    if (n === 0) return '';
    if (n < 0) {
      const len = -n * 2;
      const u = new Uint16Array(len / 2);
      for (let i = 0; i < len / 2; i++) u[i] = this.dv.getUint16(this.o + i * 2, true);
      this.o += len;
      return String.fromCharCode.apply(null, u).slice(0, -1);
    }
    const s = TD.decode(this.b.subarray(this.o, this.o + n - 1));
    this.o += n;
    return s;
  }
}

class W {
  constructor() { this.parts = []; this.len = 0; }
  raw(u8) { this.parts.push(u8); this.len += u8.length; return this; }
  u8(v) { return this.raw(new Uint8Array([v])); }
  i32(v) { const a = new Uint8Array(4); new DataView(a.buffer).setInt32(0, v, true); return this.raw(a); }
  u32(v) { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, v >>> 0, true); return this.raw(a); }
  i64(v) { const a = new Uint8Array(8); new DataView(a.buffer).setBigInt64(0, BigInt(v), true); return this.raw(a); }
  f32(v) { const a = new Uint8Array(4); new DataView(a.buffer).setFloat32(0, v, true); return this.raw(a); }
  f64(v) { const a = new Uint8Array(8); new DataView(a.buffer).setFloat64(0, v, true); return this.raw(a); }
  str(s) {
    if (s === '') return this.i32(0);
    // eslint-disable-next-line no-control-regex
    if (/^[\x00-\x7F]*$/.test(s)) {
      const b = TE.encode(s);
      this.i32(b.length + 1); this.raw(b); return this.u8(0);
    }
    const a = new Uint8Array((s.length + 1) * 2);
    const dv = new DataView(a.buffer);
    for (let i = 0; i < s.length; i++) dv.setUint16(i * 2, s.charCodeAt(i), true);
    this.i32(-(s.length + 1)); return this.raw(a);
  }
  done() {
    const out = new Uint8Array(this.len); let o = 0;
    for (const p of this.parts) { out.set(p, o); o += p.length; }
    return out;
  }
}

const eq = (a, b) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

class TN {
  constructor(name, params) { this.name = name; this.params = params || []; }
  toString() { return this.name + (this.params.length ? '<' + this.params.join(',') + '>' : ''); }
  ser(w) { w.str(this.name); w.i32(this.params.length); for (const p of this.params) p.ser(w); }
}
function readTN(r) {
  const nm = r.str(); const c = r.i32(); const ps = [];
  for (let i = 0; i < c; i++) ps.push(readTN(r));
  return new TN(nm, ps);
}

class Val { constructor() { this._d = false; } dirty() { return this._d; } mark() { this._d = true; } }

class Raw extends Val {
  constructor(b) { super(); this.b = b; }
  ser(w) { w.raw(this.b); }
}
class Scalar extends Val {
  constructor(kind, v) { super(); this.kind = kind; this.v = v; }
  set(v) { this.v = v; this.mark(); }
  ser(w) {
    switch (this.kind) {
      case 'str': case 'name': case 'obj': case 'enum': return void w.str(this.v);
      case 'i32': return void w.i32(this.v);
      case 'u32': return void w.u32(this.v);
      case 'i64': return void w.i64(this.v);
      case 'f32': return void w.f32(this.v);
      case 'f64': return void w.f64(this.v);
      case 'u8': return void w.u8(this.v);
      case 'bool': return;
      default: throw new Error('kind ' + this.kind);
    }
  }
}
class SoftObj extends Val {
  constructor(pkg, asset, sub) {
    super();
    this.pkg = pkg || 'None';
    if (asset !== undefined && asset !== null) {
      this.asset = asset;
    } else if (this.pkg && this.pkg !== 'None') {
      const base = this.pkg.split('/').pop().split('.')[0];
      this.asset = base + '_C';
    } else {
      this.asset = 'None';
    }
    this.sub = sub || '';
  }
  get v() { return this.pkg; }
  set v(val) { this.set(val); }
  set(val) {
    this.pkg = val || 'None';
    if (this.pkg === 'None') {
      this.asset = 'None';
    } else {
      const base = this.pkg.split('/').pop().split('.')[0];
      this.asset = base + '_C';
    }
    this.mark();
  }
  ser(w) {
    w.str(this.pkg);
    w.str(this.asset);
    w.str(this.sub);
  }
}
class PropList extends Val {
  constructor(props, tail) { super(); this.props = props; this.tail = tail || new Uint8Array(0); }
  dirty() { return this._d || this.props.some(p => p.value.dirty()); }
  get(n) { for (const p of this.props) if (p.name === n) return p; return null; }
  ser(w) { for (const p of this.props) p.ser(w); w.str('None'); w.raw(this.tail); }
}
class Arr extends Val {
  constructor(inner, items, isSet, nrem) { super(); this.inner = inner; this.items = items; this.isSet = !!isSet; this.nrem = nrem || 0; }
  dirty() { return this._d || this.items.some(i => i.dirty()); }
  ser(w) {
    if (this.isSet) w.i32(this.nrem);
    w.i32(this.items.length);
    for (const i of this.items) i.ser(w);
  }
}
class MapV extends Val {
  constructor(nrem, pairs) { super(); this.nrem = nrem; this.pairs = pairs; }
  dirty() { return this._d || this.pairs.some(([k, v]) => k.dirty() || v.dirty()); }
  ser(w) { w.i32(this.nrem); w.i32(this.pairs.length); for (const [k, v] of this.pairs) { k.ser(w); v.ser(w); } }
}
class Struct extends Val {
  constructor(sname, body) { super(); this.sname = sname; this.body = body; }
  dirty() { return this._d || this.body.dirty(); }
  get(n) { return this.body.get ? this.body.get(n) : null; }
  ser(w) { this.body.ser(w); }
}
class SGD extends Val {
  constructor(name, klass, extra, body) { super(); this.name = name; this.klass = klass; this.extra = extra; this.body = body; }
  dirty() { return this._d || this.body.dirty(); }
  ser(w) {
    const iw = new W(); iw.u8(this.extra); this.body.ser(iw);
    const inner = iw.done();
    w.str(this.name); w.str(this.klass); w.i32(inner.length); w.raw(inner);
  }
}
const HANDLE_STRUCTS = new Set(['GrimItemInstanceHandle', 'GrimAppearanceHandle']);
class Handle extends Val {
  constructor(sname, pkg, asset, sub, insts, flag) {
    super(); this.sname = sname; this.pkg = pkg; this.asset = asset; this.sub = sub;
    this.insts = insts; this.flag = flag;
  }
  dirty() { return this._d || this.insts.some(i => i[1].dirty()); }
  get body() { return this.insts.length ? this.insts[0][1] : null; }
  get(n) { return this.body ? this.body.get(n) : null; }
  ser(w) {
    if (this.sname === 'GrimItemInstanceHandle') { w.str(this.pkg); w.str(this.asset); }
    w.str(this.sub); w.i32(this.insts.length);
    for (const [pre, pl, post] of this.insts) { w.u8(pre); pl.ser(w); w.i32(post); }
    if (this.flag !== null && this.flag !== undefined) w.u8(this.flag);
  }
}

class Prop {
  constructor(name, tn, flags, arrIndex, guid, value, raw) {
    this.name = name; this.tn = tn; this.flags = flags; this.arrIndex = arrIndex;
    this.guid = guid; this.value = value; this.raw = raw;
  }
  ser(w) {
    let payload;
    if (!this.raw || this.raw.length === 0 || this.value.dirty()) { const pw = new W(); this.value.ser(pw); payload = pw.done(); }
    else payload = this.raw;
    w.str(this.name); this.tn.ser(w); w.i32(payload.length); w.u8(this.flags);
    if (this.flags & 1) w.i32(this.arrIndex);
    if (this.flags & 2) w.raw(this.guid);
    w.raw(payload);
  }
}

const NATIVE = { Guid: 16, Vector: 24, Vector2D: 16, Rotator: 24, Quat: 32, DateTime: 8, Timespan: 8, IntPoint: 8, Color: 4, LinearColor: 16 };

function readProps(r, ctx) {
  const props = [];
  for (;;) {
    const name = r.str();
    if (name === 'None') break;
    const tn = readTN(r);
    const size = r.i32();
    const flags = r.u8();
    let arrIndex = 0, guid = null;
    if (flags & 1) arrIndex = r.i32();
    if (flags & 2) guid = r.bytes(16);
    if (flags & 4) throw new Error('property extensions unsupported');
    const start = r.o;
    const raw = r.b.subarray(start, start + size);
    const val = readValue(new Reader(r.b, start, start + size), tn, ctx);
    r.o = start + size;
    props.push(new Prop(name, tn, flags, arrIndex, guid, val, raw));
  }
  return new PropList(props);
}

function readValue(r, tn, ctx) {
  const t = tn.name;
  const start = r.o;
  try {
    switch (t) {
      case 'StrProperty': return new Scalar('str', r.str());
      case 'NameProperty': return new Scalar('name', r.str());
      case 'ObjectProperty': return new Scalar('obj', r.str());
      case 'SoftObjectProperty': {
        if (!r.left()) return new Raw(r.bytes(0));
        const pkg = r.str();
        const asset = r.left() >= 4 ? r.str() : undefined;
        const sub = r.left() >= 4 ? r.str() : undefined;
        return new SoftObj(pkg, asset, sub);
      }
      case 'IntProperty': return new Scalar('i32', r.i32());
      case 'UInt32Property': return new Scalar('u32', r.u32());
      case 'Int64Property': return new Scalar('i64', r.i64());
      case 'FloatProperty': return new Scalar('f32', r.f32());
      case 'DoubleProperty': return new Scalar('f64', r.f64());
      case 'BoolProperty': return new Scalar('bool', null);
      case 'EnumProperty': return new Scalar('enum', r.str());
      case 'ByteProperty': return r.left() === 1 ? new Scalar('u8', r.u8()) : new Scalar('enum', r.str());
      case 'StructProperty': return readStruct(r, tn.params[0] || new TN('?'), ctx, true);
      case 'ArrayProperty': {
        const inner = tn.params[0];
        const n = r.i32(); const items = [];
        for (let i = 0; i < n; i++) items.push(readSized(r, inner, ctx));
        if (r.left() !== 0) throw new Error('array leftover ' + r.left());
        return new Arr(inner, items);
      }
      case 'SetProperty': {
        const inner = tn.params[0];
        const nrem = r.i32(); const n = r.i32(); const items = [];
        for (let i = 0; i < n; i++) items.push(readSized(r, inner, ctx));
        if (r.left() !== 0) throw new Error('set leftover');
        return new Arr(inner, items, true, nrem);
      }
      case 'MapProperty': {
        const kt = tn.params[0], vt = tn.params[1];
        const nrem = r.i32(); const n = r.i32(); const pairs = [];
        for (let i = 0; i < n; i++) pairs.push([readSized(r, kt, ctx), readSized(r, vt, ctx)]);
        if (r.left() !== 0) throw new Error('map leftover ' + r.left());
        return new MapV(nrem, pairs);
      }
    }
  } catch (e) {
    if (ctx) (ctx.errors = ctx.errors || []).push(t + ': ' + e.message);
  }
  r.o = start;
  return new Raw(r.bytes(r.left()));
}

function readSized(r, tn, ctx) {
  const t = tn.name;
  switch (t) {
    case 'StrProperty': return new Scalar('str', r.str());
    case 'NameProperty': return new Scalar('name', r.str());
    case 'ObjectProperty': return new Scalar('obj', r.str());
    case 'SoftObjectProperty': {
      const pkg = r.str();
      const asset = r.left() >= 4 ? r.str() : undefined;
      const sub = r.left() >= 4 ? r.str() : undefined;
      return new SoftObj(pkg, asset, sub);
    }
    case 'IntProperty': return new Scalar('i32', r.i32());
    case 'UInt32Property': return new Scalar('u32', r.u32());
    case 'Int64Property': return new Scalar('i64', r.i64());
    case 'FloatProperty': return new Scalar('f32', r.f32());
    case 'DoubleProperty': return new Scalar('f64', r.f64());
    case 'ByteProperty': return new Scalar('u8', r.u8());
    case 'BoolProperty': return new Scalar('u8', r.u8());
    case 'EnumProperty': return new Scalar('enum', r.str());
    case 'StructProperty': {
      const stn = tn.params[0] || new TN('?');
      if (stn.name === 'SaveGameData') return readSGD(r, ctx);
      return readStruct(r, stn, ctx, false);
    }
    case 'ArrayProperty': {
      const inner = tn.params[0]; const n = r.i32(); const items = [];
      for (let i = 0; i < n; i++) items.push(readSized(r, inner, ctx));
      return new Arr(inner, items);
    }
    case 'MapProperty': {
      const kt = tn.params[0], vt = tn.params[1];
      const nrem = r.i32(); const n = r.i32(); const pairs = [];
      for (let i = 0; i < n; i++) pairs.push([readSized(r, kt, ctx), readSized(r, vt, ctx)]);
      return new MapV(nrem, pairs);
    }
  }
  throw new Error('unhandled inner type ' + t);
}

function readSGD(r, ctx) {
  const name = r.str(), klass = r.str(), size = r.i32();
  const start = r.o;
  const extra = r.b[start];
  const sub = new Reader(r.b, start + 1, start + size);
  let body;
  try {
    body = readProps(sub, ctx);
    if (sub.left()) body.tail = sub.bytes(sub.left());
  } catch (e) {
    if (ctx) (ctx.errors = ctx.errors || []).push('SGD ' + name + ': ' + e.message);
    body = new Raw(r.b.subarray(start + 1, start + size));
  }
  r.o = start + size;
  return new SGD(name, klass, extra, body);
}

function readStruct(r, stn, ctx, sized) {
  const sname = stn.name;
  const start = r.o;
  if (HANDLE_STRUCTS.has(sname)) return readHandle(r, sname, ctx, sized);
  if (NATIVE[sname]) return new Struct(sname, new Raw(r.bytes(NATIVE[sname])));
  if (!sized) return new Struct(sname, readProps(r, ctx));
  try {
    const body = readProps(r, ctx);
    if (r.left()) body.tail = r.bytes(r.left());
    return new Struct(sname, body);
  } catch (e) {
    r.o = start;
    return new Struct(sname, new Raw(r.bytes(r.left())));
  }
}

function readHandle(r, sname, ctx, sized) {
  const start = r.o;
  try {
    let pkg = '', asset = '';
    if (sname === 'GrimItemInstanceHandle') { pkg = r.str(); asset = r.str(); }
    const sub = r.str(); const n = r.i32();
    if (n < 0 || n > 64) throw new Error('bad instance count ' + n);
    const insts = [];
    for (let i = 0; i < n; i++) {
      const pre = r.u8();
      const pl = readProps(r, ctx);
      const post = r.i32();
      insts.push([pre, pl, post]);
    }
    const flag = sname === 'GrimItemInstanceHandle' ? r.u8() : null;
    const h = new Handle(sname, pkg, asset, sub, insts, flag);
    if (sized) {
      const w = new W(); h.ser(w);
      if (!eq(w.done(), r.b.subarray(start, r.end))) throw new Error('handle roundtrip mismatch');
    }
    return h;
  } catch (e) {
    if (ctx) (ctx.errors = ctx.errors || []).push('handle ' + sname + ': ' + e.message);
    if (!sized) throw e;
    r.o = start;
    return new Struct(sname, new Raw(r.bytes(r.left())));
  }
}

function parseSave(buf) {
  const r = new Reader(buf);
  const magic = r.bytes(4);
  if (String.fromCharCode(...magic) !== 'GVAS') throw new Error('Not a valid GVAS save file (incorrect header)');
  const saveVer = r.i32(); r.i32(); r.i32();
  r.bytes(6); r.u32();
  const branch = r.str();
  r.i32(); const cvc = r.i32(); r.bytes(cvc * 20);
  const klass = r.str();
  const header = buf.subarray(0, r.o);
  const extra = r.u8();
  const ctx = { errors: [] };
  const rootStart = r.o;
  const root = readProps(r, ctx);
  const trailer = buf.subarray(r.o);
  return { data: buf, header, extra, root, trailer, ctx, branch, klass, saveVer, rootStart };
}

function serializeSave(s) {
  const w = new W();
  w.raw(s.header); w.u8(s.extra); s.root.ser(w); w.raw(s.trailer);
  return w.done();
}

function parseAffixTemplate(bytes) {
  const r = new Reader(bytes);
  return readStruct(r, new TN('GrimItemAffixInstance'), { errors: [] }, false);
}

const API = { Reader, W, TN, Raw, Scalar, SoftObj, PropList, Arr, MapV, Struct, SGD, Handle, Prop,
  parseSave, serializeSave, readProps, readStruct, readSized, parseAffixTemplate, eq };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.GVAS = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
