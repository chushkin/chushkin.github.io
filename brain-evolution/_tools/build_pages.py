#!/usr/bin/env python3
"""Generate the two static, indexable landing pages. Python standard library only."""
from html import escape as e
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
APP_STORE='https://apps.apple.com/ru/app/brain-evolution-of-thinking/id6465684415'
RUSTORE='https://www.rustore.ru/catalog/app/com.AmazeSolution.BrainEvolution'
PRIVACY='https://sites.google.com/view/chushkin'
MAIL='eugene.chushkin@gmail.com'

COPY={
 'ru':{
  'title':'Brain Evolution — игры для любопытного ума',
  'description':'Игровые задачи на память, счёт, логику и внимание. Brain Evolution для iPhone, iPad и Android. Посмотрите превью готовящегося обновления 1.2.0.',
  'skip':'К содержимому','nav_label':'Основная навигация','nav_games':'Игры','nav_story':'Как играть','nav_get':'Скачать',
  'product':'Игры для любопытного ума','release':'Готовится обновление 1.2.0',
  'hero_title':'Дайте уму<br><em>интересную</em><br>задачу.',
  'hero_copy':'Считайте, запоминайте, ищите закономерности. Коллекция небольших игровых задач для вашей следующей паузы.',
  'app_store':'Открыть App Store','rustore':'Открыть RuStore',
  'store_note':'В магазинах пока предыдущие версии.<br>Новые игры и экраны ниже — превью будущей 1.2.0.',
  'art_alt':'Персонаж Brain Evolution — коралловый мозг в очках рядом с числовой головоломкой и геометрическими фигурами',
  'art_caption':'Больше способов играть','art_version':'13 мини-игр в готовящемся обновлении 1.2.0',
  'explore_eyebrow':'Загляните в обновление 1.2.0','explore_title':'Какую задачу<br>выберете сегодня?',
  'explore_copy':'От первого найденного числа до последнего хода в головоломке. В готовящейся версии собраны 13 разных мини-игр — выбирайте по настроению.',
  'device_label':'Устройство для просмотра','tab_label':'Категории игр в обновлении 1.2.0',
  'preview_label':'Превью 1.2.0','expand':'Увеличить скриншот','gallery_note':'Реальные экраны готовящейся версии 1.2.0, снятые в iOS Simulator. Опубликованные версии пока выглядят иначе.',
  'categories':[
   {'tab':'Числа','heading':'Найдите свой ритм.','copy':'Один пример, одна последовательность, одна следующая цель. Начните с задач, где всё решают числа.','scene':'numbers','alt':'Numbers: игровое поле с числами от 1 до 16',
    'games':[('Calculator','Решайте арифметические примеры и вводите ответ.'),('Numbers','Находите числа на поле по порядку.')]},
   {'tab':'Память','heading':'Смотрите. Запоминайте. Играйте.','copy':'Заметьте детали, удержите их в памяти и проверьте себя следующим действием.','scene':'memorics','alt':'Memorics: поле с цветными фигурами для запоминания',
    'games':[('Memorics','Запоминайте фигуры и их признаки.'),('Pairs','Открывайте карточки и находите пары.'),('Geometry','Запоминайте контур и повторяйте фигуру по точкам.')]},
   {'tab':'Логика','heading':'Каждый ход имеет значение.','copy':'Просчитайте маршрут, найдите подходящее число или измените всего одну деталь. Здесь хочется попробовать ещё раз.','scene':'sudoku','alt':'Sudoku: настоящая сетка 9 на 9 и панель ввода чисел',
    'games':[('Sudoku','Заполняйте сетку 9 × 9, используя заметки и кандидатов.'),('Matches','Решайте головоломки со спичками.'),('Minesweeper','Открывайте клетки, отмечайте мины и читайте подсказки.'),('Balltracker','Планируйте путь шара к выходу через поле с препятствиями.')]},
   {'tab':'Наблюдение','heading':'Всё дело в деталях.','copy':'Среди цветов, стрелок и похожих объектов найдите то, что имеет значение для следующего шага.','scene':'spatial','alt':'Quadronica: поле с разноцветными плитками',
    'games':[('Quadronica','Находите прямоугольники с одинаковыми угловыми плитками.'),('Arrow Path','Следуйте направлению центральной стрелки.'),('GuessWho','Узнавайте объект по его отличительным признакам.'),('Encyclopedia','Запоминайте факты и отвечайте на вопросы.')]},
  ],
  'ritual_eyebrow':'В своём темпе','ritual_title':'Небольшая пауза.<br>Своя история игры.',
  'ritual_copy':'В превью 1.2.0 каждая мини-игра — часть общей коллекции. Можно вернуться к любимой задаче или попробовать другой способ играть.',
  'steps':[('Выберите игру','Числа, память, логика или наблюдение — начните с того, что интересно прямо сейчас.'),('Познакомьтесь с правилами','Посмотрите задачу и попробуйте свой первый ход. Вернуться к правилам можно из самой игры.'),('Продолжайте свою историю','В 1.2.0 собирайте звёзды, открывайте игровые ранги и сохраняйте результаты в своём локальном профиле.')],
  'note_title':'Результат — часть игры.','note_copy':'Звёзды, медали и семь рангов эволюции в 1.2.0 отмечают игровое прохождение. Это повод поставить следующую цель.',
  'faq_title':'Перед первой игрой','faq_eyebrow':'Несколько ответов',
  'faq':[
   ('Какая версия показана на странице?','Игры и скриншоты в галерее — превью готовящейся версии 1.2.0. На 25 октября 2026 года в App Store доступна 1.0.7, в RuStore — 1.1.8. Обновление 1.2.0 ещё не опубликовано; после перехода в магазин проверьте доступную там версию.'),
   ('На каких устройствах можно играть?','Текущая версия доступна на iPhone и iPad через App Store, а на Android — через RuStore. Кнопки на этой странице ведут на официальные страницы приложения.'),
   ('Как устроены профили и прогресс в 1.2.0?','В готовящейся версии можно создавать локальные профили игроков и хранить результаты отдельно. Звёзды, медали и ранги относятся к прохождению игр.'),
   ('Какие языки есть в 1.2.0?','В настройках доступен выбор английского, русского, украинского, немецкого, испанского, французского, итальянского, польского, португальского, турецкого и иврита. Часть новых панелей пока остаётся на английском или русском.'),
  ],
  'download_eyebrow':'Brain Evolution','download_title':'Следующая головоломка<br>уже рядом.',
  'download_copy':'Откройте приложение в магазине для вашего устройства. Версия 1.2.0 с показанными выше новыми играми ещё готовится к публикации.',
  'available_label':'Сейчас в магазинах','ios_current':'iPhone и iPad · версия 1.0.7','android_current':'Android · версия 1.1.8',
  'checked':'Версии проверены 25 октября 2026. Доступность и последнюю версию смотрите в магазине.',
  'support':'Поддержка','privacy':'Конфиденциальность','developer':'Все проекты разработчика','footer_copy':'Небольшие задачи для любопытного ума.',
  'dialog_title':'Превью Brain Evolution 1.2.0','close':'Закрыть изображение','dialog_note':'Настоящий экран готовящейся версии. В опубликованной версии интерфейс может отличаться.',
 },
 'en':{
  'title':'Brain Evolution — games for a curious mind',
  'description':'A collection of number puzzles, memory tasks, logic games and visual challenges for iPhone, iPad and Android. Preview the upcoming Brain Evolution 1.2.0 update.',
  'skip':'Skip to content','nav_label':'Main navigation','nav_games':'Games','nav_story':'How to play','nav_get':'Get the app',
  'product':'Games for a curious mind','release':'Coming next: update 1.2.0',
  'hero_title':'Make room<br>for a little<br><em>challenge.</em>',
  'hero_copy':'Calculate, remember and look for patterns. A colourful collection of small challenges for your next little break.',
  'app_store':'Open App Store','rustore':'Open RuStore',
  'store_note':'Stores currently offer earlier versions.<br>The new games and screens below preview the upcoming 1.2.0 update.',
  'art_alt':'The Brain Evolution mascot, a coral brain wearing round glasses, beside a number puzzle and geometric shapes',
  'art_caption':'More ways to play','art_version':'13 mini-games in the upcoming 1.2.0 update',
  'explore_eyebrow':'A look inside update 1.2.0','explore_title':'What will you<br>try today?',
  'explore_copy':'From the first number you spot to the final move in a puzzle. The upcoming version brings together 13 different mini-games. Follow your curiosity.',
  'device_label':'Preview device','tab_label':'Game categories in update 1.2.0',
  'preview_label':'1.2.0 preview','expand':'Enlarge screenshot','gallery_note':'Real screens from the upcoming version 1.2.0, captured in iOS Simulator. The versions currently in stores look different.',
  'categories':[
   {'tab':'Numbers','heading':'Find your rhythm.','copy':'One calculation, one sequence, one next goal. Start with challenges where numbers do the talking.','scene':'numbers','alt':'Numbers: a game board containing the numbers 1 to 16',
    'games':[('Calculator','Work through arithmetic problems and enter your answer.'),('Numbers','Find numbers on the board in ascending order.')]},
   {'tab':'Memory','heading':'Look. Remember. Play.','copy':'Notice the details, keep them in mind and put them to the test with your next move.','scene':'memorics','alt':'Memorics: a grid of colourful shapes to remember',
    'games':[('Memorics','Remember shapes and their features.'),('Pairs','Turn over cards and find matching pairs.'),('Geometry','Remember an outline and recreate it by connecting points.')]},
   {'tab':'Logic','heading':'Make every move count.','copy':'Plan a route, find the right number or change just one detail. There is always another way to try.','scene':'sudoku','alt':'Sudoku: the real 9 by 9 puzzle grid and number controls',
    'games':[('Sudoku','Fill the 9 × 9 grid with notes and candidates to help you.'),('Matches','Solve matchstick puzzles.'),('Minesweeper','Reveal cells, flag mines and read the clues.'),('Balltracker','Plan a ball’s route through an obstacle-filled board to the exit.')]},
   {'tab':'Observation','heading':'It is all in the details.','copy':'Among colours, arrows and similar-looking objects, find what matters for your next move.','scene':'spatial','alt':'Quadronica: a board of colourful tiles',
    'games':[('Quadronica','Find rectangles with four matching corner tiles.'),('Arrow Path','Follow the direction of the central arrow.'),('GuessWho','Recognise an object from its distinguishing features.'),('Encyclopedia','Remember facts and answer questions.')]},
  ],
  'ritual_eyebrow':'At your own pace','ritual_title':'A little break.<br>Your own way to play.',
  'ritual_copy':'In the 1.2.0 preview, every mini-game is part of a bigger collection. Return to a favourite challenge or try a different way to play.',
  'steps':[('Pick a game','Numbers, memory, logic or observation. Start with whatever catches your interest.'),('Learn the rules','Look at the task and try your first move. You can return to the rules from the game itself.'),('Keep your story going','In 1.2.0, collect stars, discover in-game ranks and keep your results in your own local profile.')],
  'note_title':'Make progress part of the game.','note_copy':'Stars, medals and seven evolution ranks in 1.2.0 mark your progress through the games. A reason to set your next goal.',
  'faq_title':'Before your first game','faq_eyebrow':'A few answers',
  'faq':[
   ('Which version is shown on this page?','The gallery previews the upcoming version 1.2.0. On October 25, 2026, the App Store offers version 1.0.7 and RuStore offers version 1.1.8. Update 1.2.0 has not been published yet. Check the version available in the store before downloading.'),
   ('Which devices can I use?','The current version is available for iPhone and iPad on the App Store, and for Android on RuStore. The buttons on this page link to the official app listings.'),
   ('How do profiles and progress work in 1.2.0?','The upcoming version lets players create local profiles and keep results separate. Stars, medals and ranks relate to progress through the games.'),
   ('Which languages are available in 1.2.0?','Settings offer English, Russian, Ukrainian, German, Spanish, French, Italian, Polish, Portuguese, Turkish and Hebrew. Some new panels are still displayed in English or Russian.'),
  ],
  'download_eyebrow':'Brain Evolution','download_title':'Your next puzzle<br>is waiting.',
  'download_copy':'Open the app in the store for your device. Version 1.2.0, including the new games shown above, is still being prepared for publication.',
  'available_label':'Currently in stores','ios_current':'iPhone and iPad · version 1.0.7','android_current':'Android · version 1.1.8',
  'checked':'Versions checked on October 25, 2026. See the store for current availability and the latest version.',
  'support':'Support','privacy':'Privacy','developer':'More from the developer','footer_copy':'Small challenges for a curious mind.',
  'dialog_title':'Brain Evolution 1.2.0 preview','close':'Close image','dialog_note':'A real screen from the upcoming version. The published version may look different.',
 }
}


def arrow():
 return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def buttons(c):
 return f'''<div class="store-actions"><a class="button button-mint" href="{APP_STORE}" rel="external noreferrer"><span class="store-platform">iPhone · iPad</span><span>{c['app_store']}</span>{arrow()}</a><a class="button button-outline" href="{RUSTORE}" rel="external noreferrer"><span class="store-platform">Android</span><span>{c['rustore']}</span>{arrow()}</a></div>'''


def page(lang):
 c=COPY[lang];base='../' if lang=='en' else '';home='../../' if lang=='en' else '../';support=base+('support/#english' if lang=='en' else 'support/')
 url='https://chushkin.github.io/brain-evolution/'+('en/' if lang=='en' else '')
 labels={'ru':'Русский','en':'English'}
 language_nav=''.join(f'<span lang="{l}" aria-current="page">{l.upper()}</span>' if l==lang else f'<a href="{"../" if lang=="en" else "en/"}" lang="{l}" hreflang="{l}" aria-label="{labels[l]}">{l.upper()}</a>' for l in ['ru','en'])
 tabs=''.join(f'<button type="button" id="tab-{i}" role="tab" aria-selected="{"true" if i==0 else "false"}" aria-controls="panel-{i}" tabindex="{0 if i==0 else -1}"><span>0{i+1}</span>{e(cat["tab"])}</button>' for i,cat in enumerate(c['categories']))
 panels=[]
 for i,cat in enumerate(c['categories']):
  scene=cat['scene'];screenshot=f'{base}assets/{scene}-iphone-{lang}.webp';ipad=f'{base}assets/{scene}-ipad-{lang}.webp'
  games=''.join(f'<li><h4>{e(name)}</h4><p>{e(desc)}</p></li>' for name,desc in cat['games'])
  panels.append(f'''<section id="panel-{i}" class="game-panel" role="tabpanel" aria-labelledby="tab-{i}" tabindex="0">
  <div class="screen-stage"><span class="preview-stamp">{e(c['preview_label'])}</span><button class="screen-expand" type="button" aria-haspopup="dialog" aria-label="{e(c['expand'])}: {e(cat['alt'])}"><img src="{screenshot}" data-iphone="{screenshot}" data-ipad="{ipad}" data-alt="{e(cat['alt'])}" alt="{e(cat['alt'])} · iPhone · 1.2.0" width="700" height="1517" loading="lazy" decoding="async"/><span>{e(c['expand'])} <span aria-hidden="true">↗</span></span></button></div>
  <div class="game-copy"><p class="eyebrow">0{i+1} / 04 · {e(cat['tab'])}</p><h3>{e(cat['heading'])}</h3><p class="panel-intro">{e(cat['copy'])}</p><ul class="game-list">{games}</ul></div></section>''')
 steps=''.join(f'<article><span class="step-number">0{i+1}</span><h3>{e(title)}</h3><p>{e(desc)}</p></article>' for i,(title,desc) in enumerate(c['steps']))
 faq=''.join(f'<details><summary>{e(title)}<span aria-hidden="true">+</span></summary><p>{e(answer)}</p></details>' for title,answer in c['faq'])
 schema={'@context':'https://schema.org','@type':'SoftwareApplication','name':'Brain Evolution of Thinking','applicationCategory':'GameApplication','operatingSystem':'iOS, Android','url':url,'image':'https://chushkin.github.io/brain-evolution/assets/app-icon.webp','author':{'@type':'Person','name':'Eugene Chushkin','url':'https://chushkin.github.io/'},'sameAs':[APP_STORE,RUSTORE]}
 return f'''<!doctype html>
<html lang="{lang}">
<head>
 <meta charset="utf-8"/>
 <meta name="viewport" content="width=device-width, initial-scale=1"/>
 <meta name="description" content="{e(c['description'])}"/>
 <meta name="theme-color" content="#063d34"/>
 <title>{e(c['title'])}</title>
 <link rel="canonical" href="{url}"/>
 <link rel="alternate" hreflang="ru" href="https://chushkin.github.io/brain-evolution/"/>
 <link rel="alternate" hreflang="en" href="https://chushkin.github.io/brain-evolution/en/"/>
 <link rel="alternate" hreflang="x-default" href="https://chushkin.github.io/brain-evolution/"/>
 <meta property="og:type" content="website"/>
 <meta property="og:title" content="{e(c['title'])}"/>
 <meta property="og:description" content="{e(c['description'])}"/>
 <meta property="og:url" content="{url}"/>
 <meta property="og:locale" content="{'ru_RU' if lang=='ru' else 'en_US'}"/>
 <meta property="og:image" content="https://chushkin.github.io/brain-evolution/assets/brain-evolution-preview.jpg"/>
 <meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/>
 <meta name="twitter:card" content="summary_large_image"/>
 <link rel="icon" type="image/webp" href="{base}assets/app-icon.webp"/>
 <link rel="preload" as="image" href="{base}assets/brain-mascot-1400.webp" imagesrcset="{base}assets/brain-mascot-720.webp 720w, {base}assets/brain-mascot-1400.webp 1400w" imagesizes="(max-width: 980px) 100vw, 55vw"/>
 <link rel="stylesheet" href="{base}styles.css"/>
 <script src="{base}app.js" defer></script>
 <script type="application/ld+json">{json.dumps(schema,ensure_ascii=False)}</script>
</head>
<body>
 <a class="skip-link" href="#main">{e(c['skip'])}</a>
 <header class="site-header"><a class="brand" href="{home}" aria-label="Eugene Chushkin"><span class="brand-mark">EC</span><span>Eugene Chushkin</span></a><nav class="main-nav" aria-label="{e(c['nav_label'])}"><a href="#games">{e(c['nav_games'])}</a><a href="#your-way">{e(c['nav_story'])}</a><a class="nav-download" href="#download">{e(c['nav_get'])}</a></nav><nav class="language-nav" aria-label="Language">{language_nav}</nav></header>
 <main id="main">
  <section class="hero" aria-labelledby="hero-title"><div class="container hero-grid"><div class="hero-copy"><div class="product-lockup"><img src="{base}assets/app-icon.webp" alt="" width="54" height="54"/><div><span>Brain Evolution</span><p>{e(c['product'])}</p></div></div><p class="release-tag"><span aria-hidden="true"></span>{e(c['release'])}</p><h1 id="hero-title">{c['hero_title']}</h1><p class="hero-lead">{e(c['hero_copy'])}</p>{buttons(c)}<p class="store-note">{c['store_note']}</p></div><figure class="hero-art"><img src="{base}assets/brain-mascot-1400.webp" srcset="{base}assets/brain-mascot-720.webp 720w, {base}assets/brain-mascot-1400.webp 1400w" sizes="(max-width:980px) 100vw, 55vw" alt="{e(c['art_alt'])}" width="1400" height="788" fetchpriority="high"/><figcaption><span class="art-star" aria-hidden="true">✳</span><div><strong>{e(c['art_caption'])}</strong><span>{e(c['art_version'])}</span></div></figcaption></figure></div><a class="scroll-cue" href="#games"><span>{e(c['nav_games'])}</span><span aria-hidden="true">↓</span></a></section>

  <section class="explore section-space" id="games" aria-labelledby="games-title"><div class="container"><div class="section-heading"><div><p class="eyebrow">{e(c['explore_eyebrow'])}</p><h2 id="games-title">{c['explore_title']}</h2></div><p>{e(c['explore_copy'])}</p></div><div class="gallery-controls"><div class="game-tabs" role="tablist" aria-label="{e(c['tab_label'])}">{tabs}</div><div class="device-switch" role="group" aria-label="{e(c['device_label'])}"><button type="button" data-device="iphone" aria-pressed="true">iPhone</button><button type="button" data-device="ipad" aria-pressed="false">iPad</button></div></div>{''.join(panels)}<p class="gallery-note">{e(c['gallery_note'])}</p><p id="preview-status" class="sr-only" aria-live="polite"></p></div></section>

  <section class="ritual section-space" id="your-way" aria-labelledby="ritual-title"><div class="container"><div class="section-heading"><div><p class="eyebrow">{e(c['ritual_eyebrow'])}</p><h2 id="ritual-title">{c['ritual_title']}</h2></div><p>{e(c['ritual_copy'])}</p></div><div class="steps">{steps}</div><aside class="progress-note"><span aria-hidden="true">✦</span><div><h3>{e(c['note_title'])}</h3><p>{e(c['note_copy'])}</p></div></aside></div></section>

  <section class="faq section-space" aria-labelledby="faq-title"><div class="container faq-grid"><div><p class="eyebrow">{e(c['faq_eyebrow'])}</p><h2 id="faq-title">{e(c['faq_title'])}</h2><a class="text-link" href="{support}">{e(c['support'])} {arrow()}</a></div><div class="faq-list">{faq}</div></div></section>

  <section class="download section-space" id="download" aria-labelledby="download-title"><div class="container download-grid"><div><img class="download-icon" src="{base}assets/app-icon.webp" alt="Brain Evolution" width="88" height="88"/><p class="eyebrow">{e(c['download_eyebrow'])}</p><h2 id="download-title">{c['download_title']}</h2><p class="download-copy">{e(c['download_copy'])}</p>{buttons(c)}</div><aside class="availability"><p class="eyebrow">{e(c['available_label'])}</p><a href="{APP_STORE}" rel="external noreferrer"><span>App Store</span><strong>{e(c['ios_current'])}</strong>{arrow()}</a><a href="{RUSTORE}" rel="external noreferrer"><span>RuStore</span><strong>{e(c['android_current'])}</strong>{arrow()}</a><p>{e(c['checked'])}</p></aside></div></section>
 </main>
 <footer class="site-footer"><div class="container footer-grid"><div><strong>Brain Evolution</strong><p>{e(c['footer_copy'])}</p><span>© 2026 Eugene Chushkin</span></div><nav aria-label="{e(c['support'])}"><a href="{support}">{e(c['support'])}</a><a href="{PRIVACY}" rel="external noreferrer">{e(c['privacy'])}</a><a href="mailto:{MAIL}">{MAIL}</a><a href="{home}">{e(c['developer'])} <span aria-hidden="true">↗</span></a></nav></div></footer>
 <dialog class="image-dialog" aria-labelledby="dialog-title"><div class="dialog-toolbar"><h2 id="dialog-title">{e(c['dialog_title'])}</h2><button type="button" class="dialog-close" aria-label="{e(c['close'])}"><span aria-hidden="true">×</span></button></div><div class="dialog-body"><img alt="" width="700" height="1517"/></div><p>{e(c['dialog_note'])}</p></dialog>
 <noscript><style>.game-tabs,.device-switch,.screen-expand>span{{display:none}}.screen-expand{{cursor:default}}</style></noscript>
</body></html>
'''


def main():
 for lang in COPY:
  target=ROOT/('en/index.html' if lang=='en' else 'index.html')
  target.parent.mkdir(parents=True,exist_ok=True)
  target.write_text(page(lang),'utf-8')
  print(target.relative_to(ROOT))

if __name__=='__main__':main()
