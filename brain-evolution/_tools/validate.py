#!/usr/bin/env python3
"""Check the static landing package without a browser or network requests."""
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

from PIL import Image

SITE=Path(__file__).resolve().parents[1]
CHECKOUT=SITE.parent


class Parser(HTMLParser):
 def __init__(self):
  super().__init__();self.tags=[];self.ids=set();self.links=[];self.assets=[]
  self.tabs=[];self.panels=[];self.h1=0;self.games=0;self.in_list=False

 def handle_starttag(self,tag,attrs):
  a=dict(attrs);self.tags.append((tag,a))
  if a.get('id'):
   assert a['id'] not in self.ids,a['id'];self.ids.add(a['id'])
  if tag=='h1':self.h1+=1
  if tag=='a':self.links.append(a.get('href',''))
  if tag in ['img','script','link']:
   path=a.get('src',a.get('href',''))
   if path and not path.startswith(('http:','https:','mailto:')):self.assets.append(path)
  if a.get('role')=='tab':self.tabs.append(a)
  if a.get('role')=='tabpanel':self.panels.append(a)
  if tag=='ul' and a.get('class')=='game-list':self.in_list=True
  if tag=='li' and self.in_list:self.games+=1

 def handle_endtag(self,tag):
  if tag=='ul':self.in_list=False


def main():
 reports=[]
 for path in [SITE/'index.html',SITE/'en/index.html']:
  parsed=Parser();source=path.read_text('utf-8');parsed.feed(source)
  assert parsed.h1==1 and parsed.games==13 and len(parsed.tabs)==4 and len(parsed.panels)==4,path
  assert 'play.google.com' not in source,path
  assert '1.0.7' in source and '1.1.8' in source and source.count('1.2.0')>=12,path
  assert 'sites.google.com/view/chushkin' in source,path
  assert 'https://apps.apple.com/ru/app/brain-evolution-of-thinking/id6465684415' in parsed.links,path
  assert 'https://www.rustore.ru/catalog/app/com.AmazeSolution.BrainEvolution' in parsed.links,path
  for tab in parsed.tabs:assert tab['aria-controls'] in parsed.ids,tab
  for panel in parsed.panels:assert panel['aria-labelledby'] in parsed.ids,panel
  for href in parsed.links+parsed.assets:
   url=urlsplit(href)
   if url.scheme or href.startswith('//'):continue
   target=(path.parent/unquote(url.path)).resolve() if url.path else path
   if target.is_dir():target/='index.html'
   assert target.exists(),(path,href)
   if url.fragment:
    destination=Parser();destination.feed(target.read_text('utf-8'))
    assert url.fragment in destination.ids,(path,href)
  for tag,attrs in parsed.tags:
   if tag=='img':assert 'alt' in attrs and 'width' in attrs and 'height' in attrs,(path,attrs)
  reports.append({'page':str(path.relative_to(CHECKOUT)),'h1':parsed.h1,'games':parsed.games,
                  'tabs':len(parsed.tabs),'local_links_and_assets':'PASS','version_disclosure':'PASS',
                  'dead_google_play_cta':'absent'})
 manifest=json.loads((SITE/'assets/manifest.json').read_text('utf-8'))
 for asset in manifest['assets']:
  path=SITE/'assets'/asset['file'];image=Image.open(path)
  assert image.size==(asset['width'],asset['height']),asset['file']
  assert path.stat().st_size==asset['bytes'],asset['file']
  if asset.get('sha256'):assert hashlib.sha256(path.read_bytes()).hexdigest()==asset['sha256'],asset['file']
 served_files=['index.html','en/index.html','styles.css','app.js']
 source_sha256={name:hashlib.sha256((SITE/name).read_bytes()).hexdigest() for name in served_files}
 report={'status':'PASS','pages':reports,'source_sha256':source_sha256,'optimized_assets':len(manifest['assets']),
         'total_image_bytes':sum(asset['bytes'] for asset in manifest['assets']),
         'checks':['one H1 per page','all13 named games across4 categories','tab/panel ARIA IDs',
                   'local asset and link targets','required real store links',
                   'published vs upcoming version disclosure','image alt and intrinsic dimensions',
                   'manifest image decoding/dimensions/hash'],
         'browser_qa':'Performed separately by root; this report does not claim browser interaction checks.'}
 (SITE/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
 print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__':main()
