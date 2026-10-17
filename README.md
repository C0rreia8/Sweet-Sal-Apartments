# Sweet Sal Apartments

Site dos apartamentos **Tropical Sweet** e **Orange Sweet** em Santa Maria, Ilha do Sal (Cabo Verde).

Site estático, sem build: `index.html` + `assets/` + `img/`.

- `index.html` — conteúdo e estilos (o template da página está dentro de `<template id="tpl">`)
- `assets/app.js` — animações de scroll, galeria, mapa e formulário
- `assets/runtime.js` — pequeno motor que desenha o template (sem dependências)
- `img/` — fotografias

## Publicação

Netlify ligado a este repositório: *Build command* vazio, *Publish directory* `/`.
O formulário de reserva usa Netlify Forms (`reservas`); as notificações por email configuram-se em
Netlify › Site configuration › Forms › Form notifications.

Também funciona em GitHub Pages (Settings › Pages › Deploy from branch › `main` / root) — aí o
formulário cai para envio por email (mailto).

Para testar localmente: `python3 -m http.server` e abrir http://localhost:8000

## Visita virtual (`/visita`)

Página em que o scroll controla a câmara pelo Tropical Sweet. Os frames estão em `visita/frames/`
(com `manifest.json`). Para trocar por um vídeo novo (ex.: clipes de IA juntos):

    python3 tools/frames_from_video.py visita.mp4 0,4,7.6,10.8,14,17.6,20.6,23.4,27,31.8,36.2,40.2,43.6

(o segundo argumento são os segundos em que começa cada uma das 13 cenas/legendas da página).
