# Quarantined generated surfaces

The former all-in-one server, mutable product/competitor/suggestion/history CRUD, direct OpenRouter pricing calls, custom feature generators, administrative demo CRUD, price trackers, and every `gapFeat_*` route are retained only as unmounted provenance source. `backend/server.js` mounts only authentication and `/api/governed-pricing`.

The legacy `backend/seed.js` drops and rebuilds tables and includes demo users. It is never invoked at startup or migration and is guarded for disposable local development only. None of these surfaces count as supported pricing capability.
