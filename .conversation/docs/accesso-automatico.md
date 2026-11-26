# Accesso automatico da conorbitale.it

Chi è già dentro conorbitale.it entra in Orbitale Contract senza password,
sia nel riquadro (iframe) sia in una nuova scheda.

## 1. Chiave condivisa (una volta sola)

Sul VPS di Orbitale Contract:

```bash
openssl rand -hex 32
```

Copia il risultato e aggiungilo **identico** in due posti:

- `.env` di Orbitale Contract: `EMBED_SSO_SECRET=<chiave>`
- configurazione del server di conorbitale.it (es. `ORBITALE_CONTRACT_SSO_SECRET=<chiave>`)

Nel `.env` di Orbitale Contract aggiungi anche quali siti possono mostrarlo in un riquadro:

```
EMBED_ALLOWED_ORIGINS=https://www.conorbitale.it,https://conorbitale.it
```

Poi riavvia Orbitale Contract. La chiave non va mai messa nel codice della
pagina (JavaScript del browser) né inviata per email/chat.

nginx deve passare il protocollo (di solito c'è già):
`proxy_set_header X-Forwarded-Proto $scheme;`

## 2. Cosa fa il server di conorbitale.it

Ogni volta che mostra il riquadro, **lato server**, crea un lasciapassare
per l'email dell'utente collegato (valido 60 secondi, usabile una volta):

```
token = "v1." + base64url(payload) + "." + base64url(HMAC_SHA256("v1." + base64url(payload), chiave))
payload = {"email": "<email dell'utente>", "exp": <ora unix + 60>, "nonce": "<uuid casuale>"}
```

Node.js:

```js
const crypto = require("crypto");
function orbitaleContractUrl(email, next) {
  const payload = Buffer.from(JSON.stringify({
    email, exp: Math.floor(Date.now() / 1000) + 60, nonce: crypto.randomUUID(),
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", process.env.ORBITALE_CONTRACT_SSO_SECRET)
    .update("v1." + payload).digest("base64url");
  const url = new URL("https://orbitalecontract.it/sso");
  url.searchParams.set("token", `v1.${payload}.${sig}`);
  if (next) url.searchParams.set("next", next); // es. "/seller"
  return url.toString();
}
```

PHP:

```php
function b64url($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function orbitale_contract_url($email) {
  $payload = b64url(json_encode(['email' => $email, 'exp' => time() + 60, 'nonce' => bin2hex(random_bytes(16))]));
  $sig = b64url(hash_hmac('sha256', 'v1.' . $payload, getenv('ORBITALE_CONTRACT_SSO_SECRET'), true));
  return 'https://orbitalecontract.it/sso?token=' . urlencode("v1.$payload.$sig");
}
```

Nella pagina:

```html
<iframe src="<?= orbitale_contract_url($utente_email) ?>" style="width:100%;height:100vh;border:0"></iframe>
<a href="<?= orbitale_contract_url($utente_email) ?>" target="_blank">Apri in una nuova scheda</a>
```

Ogni link va generato al momento (non salvarlo, non riusarlo): dopo il primo
uso o dopo 60 secondi non vale più.

## 3. Chi entra

- L'email deve essere quella di un account **attivo** di Orbitale Contract
  (es. Elvira: `evigliano.counseling@gmail.com` → account admin
  `elvira.vigliano`; per lavorare da venditrice usa "Entra come venditore").
- Admin → pagina admin, venditore → pagina venditore (o `next`, solo percorsi interni).
- Chi entra così non deve cambiare la password temporanea.

## 4. Limite dei browser

Il sito è su un dominio diverso da conorbitale.it: dentro il riquadro
funziona su Chrome, Edge e Firefox. **Safari (Mac, iPhone, iPad) blocca
l'accesso dentro i riquadri di altri siti**: lì serve il link "Apri in una
nuova scheda", che funziona ovunque.
