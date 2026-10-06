# Ссылка dashboard до и после #507

`render-dashboard.cjs` исполняет настоящий DashboardApp и utilities: исходную
ревизию `0352aed` и текущие исходники. В обеих формах введено 10 млрд nanoTBC.
Playwright открывает сохранённый DOM и делает PNG.

До: recipient — merchant NFT, amount — 10 млрд, bin отсутствует.
После: recipient — hub, amount — 50 млн nanoTON на gas, сумма TBC — внутри bin.
HTML сохраняет состояние формы; основной guard — автоматические тесты utils
и Sandbox-тест SDK body → реальный MerchantPaymentHub.

Воспроизведение: `node experiments/issue-521/render-dashboard.cjs`, затем открыть
`dashboard-before.html` и `dashboard-after.html` через локальный HTTP server.
