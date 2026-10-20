#!/bin/bash
set -e
npm install
# Niente "db:push --force": il DB ha colonne gestite fuori da shared/schema.ts
# che un push forzato cancellerebbe. Le modifiche di schema si applicano con
# migrazioni SQL idempotenti all'avvio del server (vedi server/tenant-schema.ts).
