# API та життєвий цикл ресурсів

Локальний runtime scene v2 також приймає optional `postprocessing: {enhancedBloom: boolean}`. Валідація визначена у `packages/contracts/schema.ts`, JSON Schema генерується з неї; відсутнє поле означає базовий засвіт. Старі snapshots не змінюються.

Версія: 0.1 · Base path: /api/v1 · Дата: 2026-10-04.
Статус: проєкт контракту; OpenAPI та реалізація ще не створені.

## 1. Спільні правила

JSON UTF-8, UTC timestamps у ISO 8601, IDs — opaque strings. Усі маршрути вимагають автентифікації; локальний test owner дозволений лише в development. Browser session — Secure HttpOnly SameSite cookie; запити мутації мають CSRF-захист і перевірку Origin. Провайдер входу ще не вибраний.

Власник визначається сервером. Кожне посилання на asset/project/geometry/revision/render перевіряється за owner; чужий ресурс повертає 404. Каталог незмінних системних HDRI/стилів доступний користувачам read-only. Довільні URL або storage paths у запитах не приймаються.

Успішні відповіді: {data: ...}. Помилка: {error:{code,message,details,requestId}}. details — без stack trace або файлових шляхів; для валідації містить fields [{path,reason}].

HTTP: 400 некоректний JSON; 401 немає сесії; 404 ресурс недоступний; 409 конфлікт стану/ревізії; 410 результат протермінований; 413 завеликий upload; 422 семантична помилка; 429 квота/частота з Retry-After; 503 тимчасова недоступність сервісу.

Idempotency-Key обов’язковий для POST uploads, projects, geometry-revisions, revisions і renders. Ключ scoped до owner+method+path; зберігається щонайменше 24 години. Однаковий ключ і body повертає той самий ресурс/status; інше body — 409 idempotency_conflict. Унікальний індекс захищає від паралельних дублікатів. Повторення не обходить поточну перевірку доступу.

## 2. Upload та імпорт

**POST /assets/uploads** → 201. Body: {fileName,byteSize,sha256}. byteSize integer 1..5242880. Response: {assetId,uploadUrl,method:"PUT",requiredHeaders,expiresAt}. URL дозволяє запис лише одного ключа з лімітом розміру, TTL 15 хвилин. fileName є лише display metadata, не шляхом.

Клієнт завантажує bytes за URL. Потім **POST /assets/:id/prepare** з {} → 202 {assetId,status}. Повторення prepare не створює другого імпорту. Сервер перевіряє фактичний розмір/hash, XML і допустимий subset; MIME від клієнта недостатній. Після prepare вхідні bytes фіксуються в незмінному ресурсі; повторний PUT не може підмінити використаний оригінал (копія/version ID або еквівалент).

**GET /assets/:id** → 200 {id,status,parts,warnings,error}. Status: awaiting_upload → queued → processing → ready|failed. parts=[] до ready; ready означає нормалізовані контури, а не готовий 3D mesh. Error=null при успіху. Для failed потрібен новий upload після виправлення файлу. Незавершений upload очищається через 24 години.

## 3. Геометрія

**POST /geometry-revisions** → 202. Body: {assetId,parameters:{depth,bevelRadius,bevelSegments,curveTolerance}}. Asset має бути ready; інакше 409 asset_not_ready. Версію генератора призначає сервер. Межі — SCENE_SPEC.

Response: {id,status}. **GET /geometry-revisions/:id** → 200 повний GeometryRevision зі SCENE_SPEC. Для ready відповідь додатково має короткочасний meshUrl і urlExpiresAt; URL не входить у manifest/hash сцени. Для failed є error {code,message,details}. Нові параметри створюють нову revision, старі не змінюють.

## 4. Проєкти й ревізії

**POST /projects** → 201 {id,title,currentRevisionId:null,createdAt}. Body: {title}, 1–120 символів після trim.

**GET /projects/:id** → 200 {id,title,currentRevisionId,revision}. revision=null для порожнього проєкту; інакше повна SceneRevision.

**POST /projects/:id/revisions** → 201. Body: {baseRevisionId,scene}. Для першого save baseRevisionId=null. Сервер транзакційно порівнює з currentRevisionId, перевіряє scene та доступність ready геометрії/ресурсів, обчислює hash, створює revision і оновлює currentRevisionId.

При конфлікті — 409 revision_conflict з details.currentRevisionId. Автоматичного last-write-wins немає. Для локального draft з незавершеною геометрією серверний save не виконується; UI зберігає його локально і показує очікування геометрії. Response: {id,projectId,baseRevisionId,schemaVersion,sceneSnapshot,contentHash,createdAt}.

**GET /projects/:id/revisions/:revisionId** → 200 незмінна ревізія цього проєкту. **GET /projects?cursor=...&limit=20** → 200 {items,nextCursor}; limit 1–100, стабільний порядок updatedAt,id.

**DELETE /projects/:id** → 202 {id,status:"deleting"}. Проєкт відразу приховується для нових операцій; активним jobs надсилається cancel. Асети видаляються лише коли немає посилань з інших проєктів того самого owner; signed URLs короткочасні й можуть діяти до завершення TTL. Очищення асетів, артефактів і резервних копій має задокументовану політику до публічного релізу.

## 5. Стилі

**GET /styles** → 200 {items:[{id,version,title,thumbnailResourceId,defaults}]}. Defaults відповідають підтримуваним полям сцени/геометрії. Старі версії незмінні. Застосування стилю виконується в редакторі, а результат зберігається як звичайна scene revision.

## 6. Створення рендера

**POST /renders** → 202. Приклад body:

```json
{
  "projectId": "project_1",
  "sceneRevisionId": "revision_1",
  "settings": {
    "purpose": "final",
    "format": "png",
    "transparent": false,
    "jpegQuality": null
  }
}
```

Сервер перевіряє належність revision проєкту, ready geometry, ресурси, квоти і ExportSettings. Визначає width/height з aspect; призначає rendererProfileId, seed та незмінний resolved resource manifest. Клієнт не задає GPU, shell arguments, raw Blender parameters чи resolution. У відповіді: {id,status,sceneRevisionId,settings,width,height,rendererProfileId,createdAt}.

Створення DB job і доставка в чергу узгоджуються через transactional outbox або еквівалентний механізм з відновленням. Успішний HTTP-запит не має залишати назавжди загублений job. Квота перевіряється атомарно, а не лише в UI.

**GET /renders/:id** → 200 повертає id, projectId, sceneRevisionId, status, stageProgress, attempt, settings, width, height, rendererProfileId, createdAt, startedAt, finishedAt, error, artifact. Nullable поля мають null до відповідного етапу. stageProgress=null або {stage,completed,total,unit}; це прогрес етапу, не штучний загальний відсоток.

artifact={id,mimeType,width,height,checksum,expiresAt} лише при completed. Download URL видається окремо. Клієнт polling стартово раз на 2 секунди, після 30 секунд — раз на 5, у прихованій вкладці — раз на 15; припиняє після terminal status.

## 7. Стани, retry і cancel

Звичайний шлях: queued → preparing → rendering → encoding → completed. Terminal: completed, failed, canceled. preparing/rendering/encoding → failed для остаточних помилок. Тимчасова помилка або втрачений lease повертає job у queued з новим attempt, доки не вичерпано budget. Стартово максимум 3 attempts загалом; backoff 5/20 секунд з jitter. Параметри профілю під час retry не змінюються.

**POST /renders/:id/cancel** з {} є ідемпотентним. Queued → canceled, відповідь 200. Active → cancel_requested, відповідь 202; worker зупиняє процес і переходить у canceled. Повтор для cancel_requested → 202, canceled → 200. Для completed/failed → 409 terminal_state. Втрата worker у cancel_requested завершується canceled через lease reaper, без retry.

Якщо complete та cancel змагаються, перша успішна транзакція визначає результат: completed вже не скасовується; після cancel_requested публікувати artifact заборонено. Повторний рендер failed/canceled створюється новим POST /renders з новим ключем.

Стартові lease: heartbeat кожні 10 секунд, lease 60 секунд; реальні timeout рендера та пам’ять закріплюються у profile після вимірювань. Кожен attempt має fencing token. Старий worker після закінчення lease не може завершити чи перезаписати новий attempt.

## 8. Завантаження

**GET /renders/:id/download** → 200 {url,expiresAt,fileName,mimeType}, URL read-only на 5 хвилин. До completed — 409 render_not_ready; після видалення артефакту за TTL — 410 artifact_expired. expired artifact не змінює історичний completed status job. UI пропонує новий рендер. Перевірка owner обов’язкова навіть для cache hit.

## 9. Помилки

| Code | Де | Повтор автоматично |
|---|---|---|
| invalid_svg / unsupported_feature | Імпорт | Ні |
| invalid_geometry | Геометрія | Ні |
| validation_error / unsupported_schema | Save/render | Ні |
| resource_limit | Імпорт/геометрія/рендер | Ні |
| asset_not_ready / geometry_not_ready | Залежності | Після завершення залежності клієнтом |
| revision_conflict / idempotency_conflict | Мутації | Ні |
| resource_missing / checksum_mismatch | Worker | Ні, потрібна діагностика |
| storage_unavailable / worker_lost | Worker | Так, у budget |
| render_timeout / render_failed | Worker | Лише якщо класифіковано як тимчасовий збій |
| artifact_expired | Download | Новий job |

Для HTTP-помилок застосовуються статуси розділу 1; для помилок фонового worker GET ресурсу повертає 200 із status=failed та error. Не повертати 500 лише тому, що job невдалий.

## 10. Перевірки перед інтеграцією

OpenAPI має відображати ці payloads і nullable поля. Обов’язкові contract/integration тести: дубль POST під паралельним навантаженням; конфлікт двох saves; чужі IDs у всіх вкладених посиланнях; upload replacement; падіння між DB insert і enqueue; прострочений lease; cancel/complete race; retry budget; expired download; JPG+transparent rejection. У docs-only етапі ці тести ще не виконані.
