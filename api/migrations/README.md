# Production storage

Перед запуском примените `001-production-storage.sql` через `psql "$DATABASE_URL" -f api/migrations/001-production-storage.sql`.
Установите `NODE_ENV=production`, `DATABASE_URL` и `REDIS_URL` (с аутентификацией Redis).
Startup проверяет соединения и наличие таблиц до открытия HTTP listener. При ошибке
запуск завершается; fallback в память отсутствует. Все реплики используют одну базу
и Redis; API keys сохраняются как HMAC-SHA256 hash, plaintext key не записывается.
Регистрация/отзыв ключей сохраняются в PostgreSQL, validation не использует локальный кэш.

Интеграционная проверка: `TEST_DATABASE_URL=... TEST_REDIS_URL=... npm test -- --runInBand ProductionStorage.integration`.
Используйте отдельную тестовую базу и Redis. Проверка создаёт invoices/keys и проверяет
их доступность после закрытия соединений и создания новых сервисов.
