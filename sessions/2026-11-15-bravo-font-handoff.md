# Handoff: 2026-11-15 Bravo font

## Коротко

Шрифт Bravo! подключён локально как основной webfont интерфейса.

## Что изменилось

- `src/web.css`: добавлен `@font-face` для `BravoRG.otf`, `body` использует `Bravo`.
- `src/assets/fonts/BravoRG.otf`: локальный файл шрифта.
- `src/assets/fonts/OFL_Bravo.txt`: сохранено уведомление SIL OFL 1.1.

## Проверка

- `npm run build` — успешно, шрифт попал в production bundle.
- `impeccable detect --json App.tsx src/web.css` — `[]`.
- `git diff --check` — без ошибок.
- Временный архив и распаковка удалены.

## Следующий шаг

Открыть kiosk на целевом экране 1920x1080 и проверить читаемость Bravo для мелких статусов, тарифов и полей; при необходимости разделить display- и body-типографику.
