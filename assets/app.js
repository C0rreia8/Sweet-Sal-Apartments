class Component extends DCLogic {
  constructor(...a) {
    super(...a);
    this.state = { st: 860, vw: 1440, p: { hero: 0, man: 0, coord: 0, apts: 0, map: 0, day: 0, exp: 0 }, seen: {}, scrolled: false, sent: false, tsI: 0, lb: false };
    this.keys = ['hero', 'man', 'coord', 'apts', 'map', 'day', 'exp'];
    this.revKeys = ['a0', 'a1', 'e0', 'i0', 'c0'];
    this.els = {}; this.rev = {}; this.refFns = {}; this.revFns = {};
    this.keys.forEach((k) => { this.refFns[k] = (el) => { this.els[k] = el; }; });
    this.revKeys.forEach((k) => { this.revFns[k] = (el) => { this.rev[k] = el; }; });
    this.onScroll = this.onScroll.bind(this);
    this.onResize = this.onResize.bind(this);
    this.raf = null;
  }
  componentDidMount() {
    document.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize);
    this.onResize();
    setTimeout(() => this.measure(), 300);
  }
  componentWillUnmount() {
    document.removeEventListener('scroll', this.onScroll, { capture: true });
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
    if (this.raf) cancelAnimationFrame(this.raf);
  }
  onResize() {
    const h = window.innerHeight || 860;
    const w = document.documentElement.clientWidth || window.innerWidth || 1440;
    const st = Math.max(540, Math.min(1100, h));
    this.setState({ st: st, vw: w }, () => this.measure());
  }
  onScroll() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = null; this.measure(); });
  }
  measure() {
    const st = this.state.st;
    const vh = window.innerHeight || st;
    const c = (v) => Math.max(0, Math.min(1, v));
    const p = {};
    let changed = false;
    this.keys.forEach((k) => {
      const el = this.els[k];
      let v = 0;
      if (el) {
        const r = el.getBoundingClientRect();
        if (k === 'exp') v = c((vh - r.top) / (vh + r.height));
        else { const d = r.height - st; v = d > 0 ? c(-r.top / d) : 0; }
      }
      p[k] = v;
      if (Math.abs(v - (this.state.p[k] || 0)) > 0.0015) changed = true;
    });
    const seen = Object.assign({}, this.state.seen);
    this.revKeys.forEach((k) => {
      const el = this.rev[k];
      if (!seen[k] && el && el.getBoundingClientRect().top < vh * 0.9) { seen[k] = true; changed = true; }
    });
    const scrolled = this.els.hero ? this.els.hero.getBoundingClientRect().bottom < st * 1.02 : false;
    if (scrolled !== this.state.scrolled) changed = true;
    if (changed) this.setState({ p: p, seen: seen, scrolled: scrolled });
  }
  goPlace(i, n) {
    const el = this.els.map;
    if (!el) return;
    const st = this.state.st;
    const r = el.getBoundingClientRect();
    const target = (i + 0.5) / n * (r.height - st) + r.top;
    const sc = document.scrollingElement || document.documentElement;
    sc.scrollTo({ top: sc.scrollTop + target, behavior: 'smooth' });
  }
  renderVals() {
    const S = this.state, P = S.p, st = S.st, vw = S.vw;
    const c = (v) => Math.max(0, Math.min(1, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const mobile = vw < 760;

    /* hero */
    const hp = P.hero;
    const e = ease(c(hp / 0.7));
    const g = Math.pow(e, 1.6);
    const big = Math.max(vw, st);
    const w0 = mobile ? vw * 0.58 : Math.min(vw * 0.24, 380);
    const h0 = mobile ? st * 0.4 : st * 0.6;
    const ww = lerp(w0, big * 2.3, g), wh = lerp(h0, big * 2.6, g);
    const rad = ww / 2;
    const winStyle = 'width:' + ww.toFixed(1) + 'px;height:' + wh.toFixed(1) + 'px;border-radius:' + rad.toFixed(1) + 'px ' + rad.toFixed(1) + 'px 0 0';
    const fb = Math.max(14, ww * 0.075);
    const fW = ww + fb * 2, fH = wh / 2 + fb;
    const frameStyle = 'width:' + fW.toFixed(1) + 'px;height:' + (wh + fb).toFixed(1) + 'px;border-width:' + fb.toFixed(1) + 'px;border-radius:' + (rad + fb).toFixed(1) + 'px ' + (rad + fb).toFixed(1) + 'px 0 0;transform:translate(-50%,-' + fH.toFixed(1) + 'px);box-shadow:0 30px 60px -30px rgba(14,36,51,.35)';
    const li = fb * 0.45;
    const frameLineStyle = 'width:' + (ww + li * 2).toFixed(1) + 'px;height:' + (wh + li).toFixed(1) + 'px;border-radius:' + (rad + li).toFixed(1) + 'px ' + (rad + li).toFixed(1) + 'px 0 0;transform:translate(-50%,-' + (wh / 2 + li).toFixed(1) + 'px)';
    const sH = Math.max(12, fb * 0.75), sW = fW + fb * 1.4;
    const sillStyle = 'width:' + sW.toFixed(1) + 'px;height:' + sH.toFixed(1) + 'px;transform:translate(-50%,' + (wh / 2).toFixed(1) + 'px)';
    const sceneStyle = 'transform:scale(' + lerp(1.3, 1, e).toFixed(4) + ')';
    const wallOp = 1 - c(hp / 0.2);
    const wallTextStyle = 'opacity:' + wallOp.toFixed(3) + ';transform:translateY(' + (-hp * 260).toFixed(1) + 'px)';
    const cueStyle = 'opacity:' + (1 - c(hp / 0.06)).toFixed(3);
    const postOp = c((hp - 0.58) / 0.2);
    const postStyle = 'opacity:' + postOp.toFixed(3) + ';transform:translateY(' + ((1 - postOp) * 50).toFixed(1) + 'px)';
    const navStyle = S.scrolled
      ? 'background: rgba(247,245,240,.86); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 1px 0 rgba(14,36,51,.08)'
      : 'background: transparent';

    const flagSlices = [];
    for (let i = 0; i < 17; i++) flagSlices.push({ a: (i * 0.42).toFixed(2), d: (-i * 0.09).toFixed(2), ml: -i * 8 });

    const polData = [
      { src: 'img/por-do-sol-santa-maria.jpg', cap: 'Pôr do sol em Santa Maria', x: 4, y: 12, w: 11, max: 200, r: -7, sp: 340, pos: '50% 45%' },
      { src: 'img/01-piscina-noite.jpg', cap: 'As noites no Tropical', x: 17.5, y: 6, w: 9.5, max: 175, r: 5, sp: 460, pos: '50% 62%' },
      { src: 'img/ilha-pontao-redes.jpg', cap: 'Pontão de Santa Maria', x: 26, y: 27, w: 8.5, max: 155, r: -3, sp: 280, pos: '42% 50%' },
      { src: 'img/05-bar-piscina.jpg', cap: 'Bar da piscina', x: 65, y: 24, w: 8.5, max: 155, r: 6, sp: 300, pos: '50% 62%' },
      { src: 'img/ilha-praia-pontao.jpg', cap: 'A praia de Santa Maria', x: 72, y: 5, w: 9.5, max: 175, r: -5, sp: 420, pos: '62% 50%' },
      { src: 'img/12-piscina-dia-2.jpg', cap: 'Tropical · Av. dos Hotéis', x: 85, y: 12, w: 11, max: 200, r: 7, sp: 360, pos: '50% 62%' },
      { src: 'img/02-quarto-twin.jpg', cap: 'O teu quarto', x: 28.5, y: 8, w: 7, max: 130, r: 8, sp: 500, pos: '50% 50%' },
      { src: 'img/ilha-santa-maria-aerea.jpg', cap: 'Santa Maria vista do céu', x: 11, y: 41, w: 8, max: 150, r: -9, sp: 250, pos: '50% 40%' },
      { src: 'img/ilha-buracona.jpg', cap: 'Olho Azul, Buracona', x: 61.5, y: 6, w: 7, max: 130, r: -6, sp: 480, pos: '48% 50%' },
      { src: 'img/04-piscina-noite-2.jpg', cap: 'Mergulho noturno', x: 80, y: 40, w: 8, max: 150, r: 5, sp: 270, pos: '50% 62%' }
    ];
    const pols = polData.map((d) => ({
      src: d.src, cap: d.cap, pos: d.pos, real: !!d.src, ph: !d.src,
      st: 'left:' + d.x + '%;top:' + (d.y + 6) + '%;width:clamp(120px,' + (d.w * 1.18).toFixed(2) + 'vw,' + Math.round(d.max * 1.18) + 'px);transform:translateY(' + (-hp * d.sp).toFixed(1) + 'px) rotate(' + d.r + 'deg);opacity:' + wallOp.toFixed(3)
    }));

    /* manifesto */
    const text = 'Não somos um hotel. Nem um resort. Somos [N] apartamentos em Santa Maria, para quem quer viver a ilha devagar — acordar sem despertador, almoçar descalço, ver o sol cair no mar. Só sal, sol e morabeza.';
    const hl = { 'devagar': 1, 'morabeza.': 1, 'sal,': 1, 'sol': 1 };
    const parts = text.split(' ');
    const lit = c(P.man * 1.18) * (parts.length + 2);
    const words = parts.map((t, i) => {
      const o = 0.16 + 0.84 * c(lit - i);
      return { t: t, op: o.toFixed(3), cls: hl[t] ? 'ser' : '' };
    });
    const hlColor = this.props.accent ?? '#E9A23B';
    words.forEach((w) => { if (w.cls) w.cls = 'ser'; });

    /* coordenadas */
    const N = 4;
    const cp = ease(c((P.coord - 0.04) / 0.92));
    const coordTrack = 'transform:translate3d(' + (-cp * (N - 1) * vw).toFixed(1) + 'px,0,0)';
    const ci = Math.round(cp * (N - 1));
    const coordDots = [0, 1, 2, 3].map((i) => ({ st: i === ci ? 'width:42px;background:#0E2433' : 'width:14px;background:rgba(14,36,51,.25)' }));

    /* apartamentos */
    const ap = P.apts;
    const s0 = 1 - 0.06 * c((ap - 0.15) / 0.45);
    const apt0 = 'transform:scale(' + s0.toFixed(4) + ');filter:brightness(' + (1 - 0.25 * c((ap - 0.15) / 0.45)).toFixed(3) + ')';
    const apt1 = 'transform:scale(1)';

    /* mapa */
    const placesData = [
      { name: 'Santa Maria', img: 'img/z1-santa-maria.jpg', ipos: '60% 50%', x: 51.7, y: 95.3, dist: 'estás aqui', desc: 'A vila, a praia de areia branca e o pontão dos pescadores. Restaurantes, música e tudo a pé.' },
      { name: 'Ponta Preta', img: 'img/z2-ponta-preta.jpg', ipos: '45% 50%', x: 39.3, y: 92.7, dist: '≈ 5 min', desc: 'A onda mais famosa da ilha e um dos pôres do sol mais bonitos de Cabo Verde.' },
      { name: 'Kite Beach', img: 'img/z3-kite-beach.jpg', ipos: '50% 40%', x: 60.7, y: 90, dist: '≈ 5 min', desc: 'Praia selvagem a leste de Santa Maria, casa do kitesurf com escolas para todos os níveis.' },
      { name: 'Shark Bay', img: 'img/z4-shark-bay.jpg', ipos: '50% 45%', x: 70.7, y: 69.7, dist: '≈ 20 min', desc: 'Tubarões-limão juvenis a nadar em água rasa, junto às rochas da baía da Parda.' },
      { name: 'Pedra de Lume', img: 'img/z5-pedra-de-lume.jpg', ipos: '50% 60%', x: 80, y: 39.3, dist: '≈ 30 min', desc: 'Salinas na cratera de um vulcão extinto. Flutua na água hipersalina — a ilha deve-lhe o nome.' },
      { name: 'Espargos', img: 'img/z6-espargos.jpg', ipos: '50% 55%', x: 52, y: 47.7, dist: '≈ 20 min', desc: 'A capital do Sal, junto ao aeroporto. Mercado, vida local e o miradouro do Monte Curral.' },
      { name: 'Palmeira', img: 'img/z7-palmeira.jpg', ipos: '50% 50%', x: 24.7, y: 45.3, dist: '≈ 30 min', desc: 'Porto de pesca tranquilo, com barcos coloridos e peixe grelhado à beira do cais.' },
      { name: 'Buracona', img: 'img/z8-buracona.jpg', ipos: '50% 50%', x: 28, y: 25, dist: '≈ 40 min', desc: 'Piscina natural de lava e o "Olho Azul": ao meio-dia, com sol, a gruta acende-se em azul.' },
      { name: 'Terra Boa', img: 'img/z9-terra-boa.jpg', ipos: '50% 40%', x: 46.7, y: 34.2, dist: '≈ 35 min', desc: 'Planície desértica onde, com calor, se vê a famosa miragem de água no horizonte.' }
    ];
    const pn = placesData.length;
    const act = Math.min(pn - 1, Math.floor(c(P.map) * pn * 0.999));
    const places = placesData.map((pl, i) => ({
      name: pl.name, x: pl.x, y: pl.y, dist: pl.dist, n: String(i + 1).padStart(2, '0'), img: pl.img, ipos: pl.ipos,
      ist: i === act ? 'opacity:1;transform:scale(1.07)' : 'opacity:0;transform:scale(1)',
      active: i === act,
      op: i === act ? '1' : (i < act ? '0.55' : '0.4'),
      mst: i === act ? 'background:#E5583F;width:18px;height:18px;z-index:2' : (i < act ? 'background:#0E2433' : 'background:#127A86;opacity:.6'),
      go: () => this.goPlace(i, pn)
    }));
    const cur = placesData[act];
    const routeHide = (1 - c(P.map)).toFixed(3);

    /* experiências paralaxe */
    const xp = P.exp - 0.5;
    const col0 = mobile ? '' : 'transform:translateY(' + (-xp * 80).toFixed(1) + 'px)';
    const col1 = mobile ? '' : 'transform:translateY(' + (xp * 140).toFixed(1) + 'px)';
    const col2 = mobile ? '' : 'transform:translateY(' + (-xp * 40).toFixed(1) + 'px)';

    /* um dia */
    const stopsData = [
      { time: '07:00', title: 'Primeiro mergulho', desc: 'A praia ainda vazia, a água morna e o sol a nascer atrás de Kite Beach.', top: [247, 201, 160], bot: [251, 231, 211], sea: [120, 196, 200], dark: false },
      { time: '10:30', title: 'O pontão acorda', desc: 'Os barcos chegam com atum, garoupa e serra. Escolhe o jantar diretamente aos pescadores.', top: [140, 210, 228], bot: [226, 245, 246], sea: [60, 194, 190], dark: false },
      { time: '13:00', title: 'Almoço sem relógio', desc: 'Cachupa, polvo ou peixe grelhado numa esplanada à sombra. Depois, sesta.', top: [86, 190, 214], bot: [208, 239, 243], sea: [42, 167, 163], dark: false },
      { time: '16:00', title: 'A tarde é do vento', desc: 'Kites no céu de Kite Beach, ou um passeio até às salinas de Pedra de Lume.', top: [58, 160, 194], bot: [183, 227, 236], sea: [18, 122, 134], dark: false },
      { time: '18:30', title: 'Pôr do sol em Ponta Preta', desc: 'O céu a arder sobre o Atlântico, pés na areia e uma bebida na mão.', top: [214, 96, 58], bot: [244, 178, 94], sea: [120, 60, 70], dark: true },
      { time: '21:30', title: 'Morna na rua', desc: 'Música ao vivo, jantar tardio e a brisa morna da noite caboverdiana.', top: [14, 36, 51], bot: [30, 62, 87], sea: [10, 28, 40], dark: true }
    ];
    const sn = stopsData.length;
    const dp = c(P.day);
    const f = dp * (sn - 1);
    const i0 = Math.min(sn - 2, Math.floor(f));
    const t = ease(c(f - i0));
    const A = stopsData[i0], B = stopsData[i0 + 1];
    const mix = (a, b) => 'rgb(' + a.map((v, k) => Math.round(lerp(v, b[k], t))).join(',') + ')';
    const skyStyle = 'background:linear-gradient(180deg,' + mix(A.top, B.top) + ' 0%,' + mix(A.bot, B.bot) + ' 74%)';
    const seaStyle = 'background:' + mix(A.sea, B.sea);
    const nowI = Math.min(sn - 1, Math.round(f));
    const now = stopsData[nowI];
    const sunX = lerp(12, 88, c(dp / 0.86));
    const sunY = 74 - Math.sin(Math.PI * c(dp / 0.86)) * 56;
    const sunOp = 1 - c((dp - 0.8) / 0.08);
    const sunStyle = 'left:' + sunX.toFixed(2) + '%;top:' + sunY.toFixed(2) + '%;opacity:' + sunOp.toFixed(3) + ';background:' + (dp > 0.6 ? '#F4B25E' : (this.props.accent ?? '#E9A23B')) + ';box-shadow:0 0 100px 30px rgba(255,214,140,.5)';
    const moonOp = c((dp - 0.86) / 0.1);
    const moonStyle = 'left:78%;top:22%;opacity:' + moonOp.toFixed(3);
    const dayText = 'color:' + (f > 3.5 ? '#F7F5F0' : '#0E2433');
    const stops = stopsData.map((s, i) => ({ st: i === nowI ? 'width:46px;opacity:1' : 'width:14px;opacity:.3' }));

    /* galeria Tropical Sweet */
    const tsPhotos = [
      { src: 'img/01-piscina-noite.jpg', alt: 'Piscina do condomínio à noite', pos: '50% 62%' },
      { src: 'img/02-quarto-twin.jpg', alt: 'Quarto twin', pos: '50% 50%' },
      { src: 'img/03-quarto-casal.jpg', alt: 'Quarto de casal', pos: '50% 55%' },
      { src: 'img/04-piscina-noite-2.jpg', alt: 'Piscina iluminada', pos: '50% 62%' },
      { src: 'img/05-bar-piscina.jpg', alt: 'Bar da piscina', pos: '50% 62%' },
      { src: 'img/06-casa-de-banho.jpg', alt: 'Casa de banho', pos: '50% 60%' },
      { src: 'img/07-esplanada.jpg', alt: 'Esplanada do condomínio', pos: '50% 56%' },
      { src: 'img/08-pergola.jpg', alt: 'Pérgola com espreguiçadeiras', pos: '50% 56%' },
      { src: 'img/09-sala-cozinha.jpg', alt: 'Sala e cozinha em open space', pos: '50% 62%' },
      { src: 'img/10-sala.jpg', alt: 'Sala de estar', pos: '50% 62%' },
      { src: 'img/11-piscina-dia.jpg', alt: 'Piscina e jardins', pos: '50% 58%' },
      { src: 'img/12-piscina-dia-2.jpg', alt: 'Piscina do condomínio', pos: '50% 62%' }
    ];
    const tn = tsPhotos.length;
    const tsI = ((S.tsI % tn) + tn) % tn;
    const ts = {
      cur: tsPhotos[tsI],
      label: (tsI + 1) + ' / ' + tn,
      lb: !!S.lb,
      open: () => this.setState({ lb: true }),
      close: () => this.setState({ lb: false }),
      prev: () => this.setState({ tsI: (tsI - 1 + tn) % tn }),
      next: () => this.setState({ tsI: (tsI + 1) % tn }),
      thumbs: tsPhotos.map((ph, i) => ({
        src: ph.src, alt: ph.alt,
        ring: i === tsI ? 'opacity:1;box-shadow:0 0 0 3px #127A86' : 'opacity:.55',
        ringDark: i === tsI ? 'opacity:1;box-shadow:0 0 0 3px #F7F5F0' : 'opacity:.45',
        pick: () => this.setState({ tsI: i })
      }))
    };

    /* reveals */
    const rv = {};
    this.revKeys.forEach((k) => { rv[k] = S.seen[k] ? 'in' : ''; });

    return {
      accent: this.props.accent ?? '#E9A23B',
      wall: this.props.wall ?? '#F4EFE6',
      st: st, vw: vw,
      heroH: Math.round(st * 2.8), manH: Math.round(st * 2.2), coordH: Math.round(st * 3.6),
      mapH: Math.round(st * 3.4), dayH: Math.round(st * 3.6),
      refs: this.refFns, rr: this.revFns, rv: rv,
      navStyle: navStyle, winStyle: winStyle, frameStyle: frameStyle, frameLineStyle: frameLineStyle, sillStyle: sillStyle,
      frame: this.props.frame ?? '#1C4A63', flagSlices: flagSlices, sceneStyle: sceneStyle,
      wallTextStyle: wallTextStyle, cueStyle: cueStyle, postStyle: postStyle,
      words: words, manPct: (c(P.man * 1.18) * 100).toFixed(1), hlColor: hlColor,
      coordTrack: coordTrack, coordDots: coordDots,
      apt0: apt0, apt1: apt1,
      places: places, cur: cur, routeHide: routeHide,
      col0: col0, col1: col1, col2: col2,
      skyStyle: skyStyle, seaStyle: seaStyle, sunStyle: sunStyle, moonStyle: moonStyle, dayText: dayText,
      now: now, stops: stops,
      ts: ts, pols: pols,
      submit: (ev) => {
        if (ev && ev.preventDefault) ev.preventDefault();
        const form = ev.target; const fd = new FormData(form);
        fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fd).toString() })
          .then((r) => { if (!r.ok) throw new Error('form'); this.setState({ sent: true }); form.reset(); })
          .catch(() => {
            const body = Array.from(fd.entries()).filter(([k]) => k !== 'form-name' && k !== 'empresa').map(([k, v]) => k + ': ' + v).join('\n');
            window.location.href = 'mailto:sweetsalapartments@gmail.com?subject=' + encodeURIComponent('Pedido de disponibilidade') + '&body=' + encodeURIComponent(body);
          });
      },
      submitLabel: S.sent ? 'Pedido enviado — respondemos em breve ✓' : 'Pedir disponibilidade'
    };
  }
}

DCMount(Component, document.getElementById('tpl'), document.getElementById('app'));
