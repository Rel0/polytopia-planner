#!/usr/bin/env python3
# Turns the files exported by the Label tool (?label in the app) into a dataset for export.py.
# usage: python3 tools/tilemodel/from_labels.py <folder with polytopia-labels-*.json> <out dir>
#   → <out dir>/img/<name>.jpg and <out dir>/dataset.json
import sys, os, json, base64, glob
src, out = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(out, 'img'), exist_ok=True)
ds, n_tiles, n_user = [], 0, 0
for f in sorted(glob.glob(os.path.join(src, '*.json'))):
    try: d = json.load(open(f))
    except Exception as e: print('skip', f, e); continue
    if not isinstance(d, dict) or 'image' not in d or 'tiles' not in d: continue
    name = os.path.splitext(os.path.basename(f))[0]
    img = os.path.join(out, 'img', name + '.jpg')
    open(img, 'wb').write(base64.b64decode(d['image'].split(',', 1)[1]))
    tiles = [{'x': t['x'], 'y': t['y'], 'label': t['label'], 'user': t.get('user', False)} for t in d['tiles'] if t['label'] != 'skip']
    ds.append({'img': img, 'grid': {'w': d['grid']['w']}, 'tiles': tiles, 'name': name})
    n_tiles += len(tiles); n_user += sum(1 for t in tiles if t['user'])
json.dump(ds, open(os.path.join(out, 'dataset.json'), 'w'))
print(f'{len(ds)} screenshots, {n_tiles} tiles ({n_user} corrected by hand) → {out}/dataset.json')
