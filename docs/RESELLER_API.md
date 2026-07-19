# XtreamPulsar — Reseller API (özet)

Tam doküman + WHMCS modülü `integrations/whmcs/xtreampulsar/` altında ve pilot dağıtımında resellera verilir.

Base: `{panelUrl}/api/v1/reseller-api` · Auth: `X-API-Key: rsk_live_...` (Reseller Panel > API & WHMCS'ten üretilir).

Endpoints: `GET /me`, `GET /packages`, `GET /users`, `POST /users` (packageId veya durationDays+maxConnections), `GET /users/:username`, `POST /users/:username/extend {days}`, `POST /users/:username/status {status}`, `DELETE /users/:username`. Tüm mutasyonlar reseller kredisinden düşer (panel ile birebir).

WHMCS: modülü `modules/servers/xtreampulsar/` altına koy, Hostname=panel URL, Access Hash=reseller API key. Create/Suspend/Unsuspend/Terminate/Renew/TestConnection eşlenir.
