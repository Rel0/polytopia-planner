#!/usr/bin/env python3
# Contributions (raw/*.json from pull.sh) → img/*.jpg + dataset.json in the flat format of tools/tilemodel
# ([{img, w, x, y, label, unit?}]) and a short count of what is there.
import sys, os, json, base64, glob, collections
out = sys.argv[1]; os.makedirs(os.path.join(out, 'img'), exist_ok=True)
ds, shots, units, labels = [], 0, 0, collections.Counter()
for f in sorted(glob.glob(os.path.join(out, 'raw', '*.json'))):
    try: d = json.load(open(f))
    except Exception: continue
    g = d.get('grid') or {}
    try: w = ((g['ux'] - g['vx']) ** 2 + (g['uy'] - g['vy']) ** 2) ** 0.5
    except Exception: continue
    img = os.path.join(os.path.abspath(out), 'img', d['id'] + '.jpg')
    open(img, 'wb').write(base64.b64decode(d['image'].split(',', 1)[1]))
    shots += 1
    H = (d.get('size') or [0, 0])[1]
    for t in d.get('tiles') or []:
        if H and not (0.16 * H < t['y'] < 0.86 * H): continue        # blacked-out bars
        ds.append({'src': 'contrib:' + d['id'], 'img': img, 'w': w, 'x': t['x'], 'y': t['y'], 'label': t['label']}); labels[t['label'].split('+')[0]] += 1
    for u in d.get('units') or []:
        units += 1
        ds.append({'src': 'contrib:' + d['id'], 'img': img, 'w': w, 'x': u['x'], 'y': u['y'], 'label': 'unit', 'unit': {k: u.get(k) for k in ('side', 'type', 'hp')}})
json.dump(ds, open(os.path.join(out, 'dataset.json'), 'w'))
print(f'{shots} screenshots · {sum(labels.values())} marked tiles {dict(labels)} · {units} units → {out}/dataset.json')
