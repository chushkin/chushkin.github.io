#!/usr/bin/env python3
"""Rebuild optimized assets from the original BrainEvolution Unity workspace.

Requires Pillow. Usage: python3 _tools/prepare_assets.py --project /path/to/BrainEvolution_2026
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]


def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--project',type=Path,required=True)
 args=parser.parse_args()
 project=args.project.resolve()
 assets=ROOT/'assets';assets.mkdir(exist_ok=True)
 records=[]

 def save(source,name,width,quality=90):
  image=Image.open(source)
  image.thumbnail((width,10000),Image.Resampling.LANCZOS)
  target=assets/name
  image.save(target,'WEBP',quality=quality,method=6)
  records.append({'file':name,'width':image.width,'height':image.height,'bytes':target.stat().st_size,
                  'source':str(source.relative_to(project)),
                  'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
                  'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})

 artwork=project/'Builds/AppStore/1.2.0/Source/Artwork/brain-evolution-keyart-v1.png'
 for width in [720,1400]:save(artwork,f'brain-mascot-{width}.webp',width,90)
 icon=project/'Builds/iOS/Unity-iPhone/Images.xcassets/AppIcon.appiconset/Icon-Store-1024.png'
 save(icon,'app-icon.webp',256,95)
 for locale,runtime in [('ru','ru'),('en','en-US')]:
  for device,width in [('iphone',700),('ipad',900)]:
   for scene in ['numbers','sudoku','memorics','spatial']:
    source=project/'Builds/AppStore/1.2.0/Source/Captures'/device/runtime/(scene+'.png')
    save(source,f'{scene}-{device}-{locale}.webp',width,92)
 og=ImageOps.fit(Image.open(artwork).convert('RGB'),(1200,630),Image.Resampling.LANCZOS)
 target=assets/'brain-evolution-preview.jpg';og.save(target,quality=90,optimize=True)
 records.append({'file':target.name,'width':1200,'height':630,'bytes':target.stat().st_size,
                 'source':str(artwork.relative_to(project)),
                 'source_sha256':hashlib.sha256(artwork.read_bytes()).hexdigest()})
 manifest={'app':'Brain Evolution','preview_version':'1.2.0',
           'screenshots_provenance':'Separate instrumented iOS Simulator build 1.2.0; original game UI, no redrawing; source captures paused for presentation. Not screenshots of the currently published versions.',
           'artwork_provenance':'AI promotional illustration based on the shipped application icon; not game UI.',
           'assets':records}
 (assets/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),'utf-8')
 print(f'{len(records)} assets; {sum(x["bytes"] for x in records):,} bytes total')


if __name__=='__main__':main()
