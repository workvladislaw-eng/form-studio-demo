# Контракт сцени

Актуальне сумісне розширення runtime v2: optional `postprocessing: {enhancedBloom: boolean}`; відсутність означає false. Поле проходить runtime-валідацію та JSON round trip. Новий кришталь має профіль `teal-studio-v3`, попередні профілі зберігаються. Деталі — ADR 0006.

SVG-санітаризація перед розбором прибирає prefixed namespace-декларації (`xmlns:xlink`, `xmlns:inkscape`, `xmlns:sodipodi` та подібні), які часто додають графічні редактори. Вбудовані або зовнішні `xlink`-посилання й надалі відхиляються, якщо вони потребують непідтримуваних ресурсів.

Службова CSS-властивість `enable-background` ігнорується. Перекривні залиті контури зберігаються як окремі водонепроникні solids, щоб логотипи та експортовані boolean-шари не відхилялися; самоперетини окремого контуру й некоректні отвори залишаються помилками.

Відкритий залитий `path` автоматично замикається перед екструзією. Контури з ненульовим `stroke` не підміняються товщиною обводу — їх потрібно спочатку перетворити на залитий outline.

Другий стиль використовує наявний preset amber-glass та background.mode=auto, algorithmVersion=teal-studio-v1, driverPartId першої частини. Кольори й формула процедурного фону версіоновані в docs/decisions/0006-amber-crystal.md; runtime schema не змінюється.

Поточне сумісне розширення runtime v2: `lights` допускає до п’яти area-джерел для безперервної білої смуги (key, key-side, key-top) і двох блакитних акцентів. Попередні сцени з трьома джерелами залишаються валідними; snapshots не переписуються. Обидва adapters читають список джерел без фіксованої кількості.

Версія документа: 0.1 · schemaVersion: 1 · Дата: 2026-10-04.
Статус: нормативний проєкт контракту; JSON Schema та runtime-валідатори мають бути реалізовані до інтеграції рушіїв.

## 1. Загальні правила

Scene — JSON без класів Three.js/Blender, URL, файлових шляхів або виконуваного коду. Ідентифікатори — непрозорі рядки; приклади нижче умовні. Невідомі поля, NaN/Infinity, невідомі enum і відсутні обов’язкові поля відхиляються. Типізовані defaults застосовуються при створенні сцени, потім зберігаються явно. null дозволено лише там, де зазначено.

В MVP objects містить рівно один об’єкт. Його частини визначаються geometry manifest. Усі наведені в прикладі поля обов’язкові; винятки та розширення описані нижче. Поля animation/timeline у v1 не приймаються: майбутня анімація вимагатиме явної версії контракту.

## 2. Координати й одиниці

- Правобічна система: +X праворуч, +Y вгору, +Z від передньої площини об’єкта до початкової камери.
- SVG нормалізується в XY: вісь Y перевертається, центр bounding box стає (0,0), максимальна ширина/висота — 1 scene unit.
- Об’єм симетричний відносно Z=0: межі -depth/2 і +depth/2. Фаска врізається всередину, не розширює задані зовнішні межі.
- metersPerUnit=0.1 у v1. Mesh, positions, camera near/far, depth, bevelRadius, розміри джерел — scene units. Поглинання — inverse meters.
- Quaternion має порядок [x,y,z,w], одиничну довжину з похибкою до 1e-6. Кути, де потрібні, — радіани. Euler не зберігається.
- Transform застосовується scale → rotation → translation. Масштаб у MVP — один додатний scalar; від’ємний/неоднорідний масштаб заборонено. Pivot зафіксований у початку координат mesh.
- Колір UI — sRGB у [0,1]; поле явно містить space. HDRI — лінійний ресурс з метаданими простору.

## 3. Повний мінімальний приклад сцени

```json
{
  "schemaVersion": 1,
  "metersPerUnit": 0.1,
  "objects": [{
    "id": "object_1",
    "geometryRevisionId": "geometry_1",
    "transform": {
      "position": [0, 0, 0],
      "rotation": [0, 0, 0, 1],
      "scale": 1
    },
    "partMaterialAssignments": {"part_1": "material_1"}
  }],
  "materials": [{
    "id": "material_1",
    "preset": "glass",
    "model": "dielectric",
    "baseColor": {"space": "srgb", "value": [1, 1, 1]},
    "roughness": 0.08,
    "metalness": 0,
    "transmission": 1,
    "ior": 1.5,
    "absorptionPerMeter": [1.5, 0.2, 0.1],
    "texture": null
  }],
  "camera": {
    "type": "perspective",
    "position": [0, 0, 2.5],
    "target": [0, 0, 0],
    "up": [0, 1, 0],
    "verticalFovRad": 0.6,
    "near": 0.01,
    "far": 100
  },
  "lights": [{
    "id": "light_1",
    "type": "area",
    "position": [1.5, 2, 2],
    "target": [0, 0, 0],
    "up": [0, 1, 0],
    "width": 2,
    "height": 2,
    "color": {"space": "srgb", "value": [1, 1, 1]},
    "powerWatts": 20
  }],
  "environment": {
    "resourceId": "studio_hdri_1",
    "rotationRad": 0,
    "strength": 1
  },
  "background": {
    "mode": "auto",
    "driverPartId": "part_1",
    "algorithmVersion": "complement-v1",
    "color": {"space": "srgb", "value": [0.18, 0.12, 0.1]}
  },
  "composition": {"aspect": "16:9"},
  "lighting": {"keyAngleRad": 0},
  "colorManagement": {
    "profile": "standard-srgb-v1",
    "exposureEV": 0
  },
  "volumetrics": {
    "enabled": false,
    "density": 0.004,
    "anisotropy": 0.35,
    "intensity": 1.4
  },
  "styleOrigin": {"id": "glass-studio", "version": 1}
}
```

Це структурний приклад, а не затверджений художній пресет. Він потребує існування ресурсів geometry_1 і studio_hdri_1 у відповідному каталозі.

## 4. Геометрія як окремий ресурс

GeometryRevision: id, assetId, generatorVersion, parameters, status, manifest, error. Status: queued | processing | ready | failed. Manifest=null до ready, error=null крім failed.

Parameters: depth (0.005–1), bevelRadius (0–depth/2), bevelSegments (integer 1–12), curveTolerance (0.00001–0.001 scene units). Стартові: 0.1, 0.01, 3, 0.0001. Це допустимі межі вводу, а не гарантія придатності кожного контуру. Фаска з геометрично некоректним радіусом повертає invalid_geometry, не коригується непомітно.

Manifest містить meshResourceId, meshSha256, bounds, triangleCount, closedManifold, parts [{id, primitiveIndices}], sourceNormalization, parameters і generatorVersion. GLB містить лише канонічний mesh: nodes з identity transforms, позиції, індекси, нормалі, UV0 і tangents. Одна частина може відповідати кільком primitives. Матеріали з GLB ігноруються; джерело матеріалів — Scene.

partId призначається після імпорту і зберігається при зміні глибини/фаски. Повторне завантаження іншого SVG створює новий asset і нову відповідність частин. Кожна частина повинна мати рівно одне призначення матеріалу. Невідомі частини/матеріали — помилка.

## 5. Матеріали

| Поле | Обмеження |
|---|---|
| preset | glass, metal, chrome; позначає стартову родину, фактичні значення зберігаються |
| model | dielectric для glass; conductor для metal/chrome |
| roughness | 0–1 |
| metalness | 0 для glass; 1 для metal/chrome |
| transmission | 1 для glass; 0 для metal/chrome |
| ior | 1–2.5; для conductor зберігається 1.5 і не використовується |
| absorptionPerMeter | Три скінченні невід’ємні коефіцієнти в лінійних RGB-каналах; conductor має [0,0,0] |
| baseColor | Для glass [1,1,1]; його відтінок задає absorption. Для conductor — колір відбиття |
| texture | null або {resourceId, repeat:[u,v], rotationRad, normalScale}; repeat>0, normalScale 0–2 |

Кольоровий glass UI перетворює бажану пропускну здатність T у коефіцієнти sigma=-ln(max(T,epsilon))/d за явно визначеної еталонної товщини d у метрах. Рендер споживає вже обчислені sigma. Параметри UI не повинні повторно змінювати збережений колір на сервері.

Texture resource — незмінний бібліотечний manifest із необов’язковими normal/roughness maps і їх hash. UV-простір спільний, tangent-space normal: +Y. Roughness map множиться на scalar roughness і обмежується [0,1]. Інших каналів у v1 немає.

## 6. Камера, світло, фон

Камера perspective; verticalFovRad >0 і <pi, near>0, far>near. position не дорівнює target; up — одиничний і не паралельний напряму погляду. Камера дивиться вздовж локальної -Z. Зміна aspect зберігає вертикальний FOV.

Area light — прямокутник, локальна -Z спрямована до target, up визначає поворот. width/height>0, powerWatts>=0, максимум 3 джерела у v1. Power є енергетичним параметром контракту; перетворення в рушії визначає RENDER_SPEC. Температура в UI перетворюється на RGB до збереження.

Environment.resourceId може бути null; тоді світлове оточення чорне. Strength>=0. Rotation — навколо канонічної +Y. Background є нескінченним однорідним тлом без підлоги та контактних тіней у v1; оточення для відбиттів задається окремо.

Background.mode: auto | manual. Для manual driverPartId і algorithmVersion дорівнюють null. Для auto driverPartId існує в manifest, algorithmVersion визначений. Рендер завжди використовує збережений background.color. StyleOrigin може бути null; зміни пресета не переписують параметри сцени.

## 7. Експорт і незмінність

ExportSettings зберігаються у RenderJob, а не Scene: purpose=preview|final, format=png|jpg, transparent=boolean, jpegQuality=integer|null. Для png jpegQuality=null; для jpg — 1–100 і transparent=false. Preview завжди png; його transparent може бути true. Розміри обчислюються з Scene.composition.aspect за MVP_SPEC, не передаються довільно клієнтом.

SceneRevision: id, projectId, baseRevisionId (null для першої), schemaVersion, sceneSnapshot, contentHash, createdAt. ID і timestamps призначає сервер. Збережена ревізія незмінна. Усі resourceId резолвляться в незмінні bytes/hash, а не «останню версію» файлу.

Hash: SHA-256 від канонічного UTF-8 JSON із рекурсивно відсортованими ключами, порядком масивів без змін і нормалізованими числами. Використати одну реалізацію canonical JSON і golden fixtures для TS/Python; не писати два незалежних serializer. Metadata (id, timestamp, owner) не входять до scene contentHash. Render manifest окремо містить asset hashes, renderer profile і export settings.

Міграція schemaVersion створює нову ревізію; старі jobs зберігають старий snapshot і profile. Непідтримувану версію відхиляти, не інтерпретувати наближено.


## Поточний етап прототипу: графітове скло (2026-10-10)

Цей етап замінює попередній вибір чотирьох стилів у редакторі: один glass dielectric з графітовим поглинанням, emission = 0, чорний непрозорий фон у PNG/JPG. Колір матеріалу не змінює фон. Сцена використовує чинний runtime-контракт v2; background.mode=manual, color=[0,0,0], driverPartId та algorithmVersion=null. Старі збережені сцени не переписуються.

Перегляд і локальний 4K-експорт використовують один WebGL ланцюжок: HDR RenderPass → UnrealBloomPass → OutputPass (sRGB, NoToneMapping). Bloom імітує розсіювання світла в оптиці, а не об’ємне розсіювання середовища. Cycles не бере участі у цьому експорті. Деталі — docs/decisions/0002-black-chrome-bloom.md.

Уточнення стилю: IOR 1.8, transmission 1, metalness 0, emission 0, roughness 0.065, clearcoat 1; стартова фаска 0.035, 8 сегментів. Три softbox-джерела автоматично супроводжують локальні осі об’єкта за законом дзеркального відбиття відносно камери. Їх світові координати записуються в scene JSON при зміні ракурсу. Це кероване студійне освітлення, а не нерухомі джерела. Фон залишається чорним. На довільних увігнутих SVG видимість смуги залежить також від геометрії та перекриття поверхонь.

`lighting.keyAngleRad` — необов’язковий кут повороту ключового softbox навколо вертикальної осі у радіанах, діапазон `[-π, π]`, значення за замовченням `0`. Редактор показує його у градусах; відсутнє поле у старій сцені трактується як `0`.
