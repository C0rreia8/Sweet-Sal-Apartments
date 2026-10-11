/* Mini runtime: renderiza o template {{…}} / <sc-for> / <sc-if> sem dependências */
(function () {
  var RE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var defs = [];
  function parts(str) {
    var out = [], last = 0, m; RE.lastIndex = 0;
    while ((m = RE.exec(str))) { if (m.index > last) out.push(str.slice(last, m.index)); out.push({ p: m[1] }); last = RE.lastIndex; }
    if (last < str.length) out.push(str.slice(last));
    return out;
  }
  function lookup(path, scope) {
    if (path === 'true') return true; if (path === 'false') return false; if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var segs = path.split('.'), cur, s = scope;
    while (s) { if (Object.prototype.hasOwnProperty.call(s.locals, segs[0])) { cur = s.locals[segs[0]]; break; } s = s.parent; }
    if (!s) cur = scope.root[segs[0]];
    for (var i = 1; i < segs.length && cur != null; i++) cur = cur[segs[i]];
    return cur;
  }
  function evalParts(ps, scope) {
    if (ps.length === 1 && typeof ps[0] === 'object') return lookup(ps[0].p, scope);
    return ps.map(function (x) { if (typeof x === 'string') return x; var v = lookup(x.p, scope); return v == null ? '' : String(v); }).join('');
  }
  function prep(parent) {
    Array.prototype.slice.call(parent.childNodes).forEach(function (el) {
      if (el.nodeType !== 1) return;
      var tag = el.tagName;
      if (tag === 'SC-FOR' || tag === 'SC-IF') {
        var sub = document.createDocumentFragment();
        while (el.firstChild) sub.appendChild(el.firstChild);
        prep(sub);
        var kind = tag === 'SC-FOR' ? 'for' : 'if';
        var expr = parts(el.getAttribute(kind === 'for' ? 'list' : 'value'))[0].p;
        var id = defs.push({ kind: kind, expr: expr, as: el.getAttribute('as'), sub: sub }) - 1;
        el.parentNode.replaceChild(document.createComment('dc' + id), el);
      } else prep(el);
    });
  }
  function removeInst(inst) {
    var n = inst.start;
    while (n) { var nx = n.nextSibling; if (n.parentNode) n.parentNode.removeChild(n); if (n === inst.end) break; n = nx; }
  }
  function instantiate(frag) {
    var root = frag.cloneNode(true), binds = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) { if (c.nodeValue.indexOf('{{') >= 0) binds.push({ t: 'text', n: c, ps: parts(c.nodeValue) }); }
        else if (c.nodeType === 8) { var m = /^dc(\d+)$/.exec(c.nodeValue); if (m) binds.push({ t: 'dir', n: c, def: defs[+m[1]], inst: null, items: [] }); }
        else if (c.nodeType === 1) {
          Array.prototype.slice.call(c.attributes).forEach(function (a) {
            if (a.value.indexOf('{{') < 0) return;
            var name = a.name, ps = parts(a.value);
            c.removeAttribute(name);
            if (/^on/.test(name)) {
              var b = { t: 'ev', ps: ps, cur: null };
              c.addEventListener(name.slice(2).toLowerCase(), function (ev) { if (typeof b.cur === 'function') b.cur(ev); });
              binds.push(b);
            } else if (name === 'ref') binds.push({ t: 'ref', el: c, ps: ps, done: false });
            else binds.push({ t: 'attr', el: c, name: name === 'data-dcsrc' ? 'src' : name, ps: ps });
          });
          walk(c);
        }
      });
    })(root);
    var inst = { root: root, start: document.createComment('['), end: document.createComment(']') };
    root.insertBefore(inst.start, root.firstChild); root.appendChild(inst.end);
    inst.update = function (scope) { for (var i = 0; i < binds.length; i++) upd(binds[i], scope); };
    return inst;
  }
  function upd(b, scope) {
    if (b.t === 'text') { var v = evalParts(b.ps, scope), s = v == null ? '' : String(v); if (s !== b.last) { b.n.nodeValue = s; b.last = s; } }
    else if (b.t === 'attr') {
      var v2 = evalParts(b.ps, scope);
      if (v2 == null || v2 === false) { if (b.last !== null) { b.el.removeAttribute(b.name); b.last = null; } return; }
      var s2 = String(v2); if (s2 !== b.last) { b.el.setAttribute(b.name, s2); b.last = s2; }
    }
    else if (b.t === 'ev') b.cur = evalParts(b.ps, scope);
    else if (b.t === 'ref') { if (!b.done) { var f = evalParts(b.ps, scope); if (typeof f === 'function') f(b.el); b.done = true; } }
    else if (b.t === 'dir') {
      var d = b.def, anchor = b.n;
      if (d.kind === 'if') {
        if (lookup(d.expr, scope)) {
          if (!b.inst) { b.inst = instantiate(d.sub); b.inst.update(scope); anchor.parentNode.insertBefore(b.inst.root, anchor); }
          else b.inst.update(scope);
        } else if (b.inst) { removeInst(b.inst); b.inst = null; }
      } else {
        var list = lookup(d.expr, scope) || [];
        while (b.items.length > list.length) removeInst(b.items.pop());
        for (var i = 0; i < list.length; i++) {
          var loc = {}; loc[d.as] = list[i]; loc.$index = i;
          var sc = { root: scope.root, parent: scope, locals: loc };
          if (i < b.items.length) b.items[i].update(sc);
          else { var it = instantiate(d.sub); it.update(sc); anchor.parentNode.insertBefore(it.root, anchor); b.items.push(it); }
        }
      }
    }
  }
  window.DCLogic = function DCLogic(props) { this.props = props || {}; this.state = {}; this._cbs = []; this._q = false; };
  DCLogic.prototype.setState = function (p, cb) {
    var patch = typeof p === 'function' ? p(this.state, this.props) : p;
    this.state = Object.assign({}, this.state, patch);
    if (cb) this._cbs.push(cb);
    this._schedule();
  };
  DCLogic.prototype.forceUpdate = function (cb) { if (cb) this._cbs.push(cb); this._schedule(); };
  DCLogic.prototype._schedule = function () {
    var self = this; if (self._q) return; self._q = true;
    Promise.resolve().then(function () { self._q = false; self._render(); var cbs = self._cbs; self._cbs = []; cbs.forEach(function (f) { f(); }); });
  };
  window.DCMount = function (Component, tplEl, mountEl) {
    var frag = tplEl.content; prep(frag);
    var comp = new Component({});
    var inst = instantiate(frag);
    comp._render = function () { inst.update({ root: comp.renderVals(), locals: {}, parent: null }); };
    comp._render();
    mountEl.appendChild(inst.root);
    if (comp.componentDidMount) comp.componentDidMount();
    return comp;
  };
})();
