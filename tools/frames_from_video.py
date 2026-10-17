"""Converte um vídeo da visita (ex.: os clipes de IA já juntos) em frames para a página /visita.

Uso:
  python3 tools/frames_from_video.py visita.mp4 0,4,7.6,10.8,...          (vertical, telemóvel)
  python3 tools/frames_from_video.py visita.mp4 0,4,7.6,10.8,... wide     (horizontal, computador)

O segundo argumento são os segundos em que começa cada uma das 13 cenas da página
(abertura, condomínio, chegada, jardins, piscina, prédio, entrada, cozinha, corredor,
casal, twin, casa de banho, final). Precisa de ffmpeg e Pillow.
"""
import json, os, shutil, subprocess, sys

FPS, Q = 8, 55
src, cuts = sys.argv[1], [float(x) for x in sys.argv[2].split(',')]
wide = len(sys.argv) > 3 and sys.argv[3] == 'wide'
W, H = (960, 540) if wide else (540, 960)
out = os.path.join(os.path.dirname(__file__), '..', 'visita', 'frames-wide' if wide else 'frames')
shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf',
                f'fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}',
                '-c:v', 'libwebp', '-quality', str(Q), '-start_number', '0',
                os.path.join(out, 'f%04d.webp')], check=True)
n = len([f for f in os.listdir(out) if f.endswith('.webp')])
total = n / FPS
ends = cuts[1:] + [total]
scenes = [dict(start=round(a / total, 4), end=round(min(b, total) / total, 4)) for a, b in zip(cuts, ends)]
json.dump(dict(count=n, fps=FPS, width=W, height=H, scenes=scenes),
          open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
print(n, 'frames')
