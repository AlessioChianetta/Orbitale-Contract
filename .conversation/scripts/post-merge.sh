#!/bin/bash
set -e
npm install
# Su Replit npm scarica da un proxy interno e lo scrive nel package-lock:
# fuori da Replit (VPS) quell'indirizzo non esiste e "npm install" fallisce.
# Riportiamo sempre gli indirizzi al registro pubblico.
sed -i 's#http://package-firewall.replit.internal/npm/#https://registry.npmjs.org/#g' package-lock.json
# Niente "db:push --force": il DB ha colonne gestite fuori da shared/schema.ts
# che un push forzato cancellerebbe. Le modifiche di schema si applicano con
# migrazioni SQL idempotenti all'avvio del server (vedi server/tenant-schema.ts).
