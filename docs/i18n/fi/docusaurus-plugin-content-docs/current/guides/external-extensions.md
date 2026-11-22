---
sidebar_position: 9.5
---

import project from '@site/src/project';

# Ulkoiset laajennukset {#external-extensions}

Versiosta v1.23 alkaen muut selainlaajennukset voivat viestiä asbplayerin kanssa. Mikä tahansa laajennus, joka muodostaa yhteyden asbplayeriin [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect)-kutsulla ja saa käyttäjältä hyväksynnän, voi lähettää yhteyden kautta [komentoja](../reference/external-api.md).

Tällä tavalla asbplayeriin integroituvan laajennuksen mallipohja on saatavilla <a href={`${project.urls.externalExtensionTemplateRepo}`}>täällä</a>.

## Yhteyden muodostaminen ja käyttäjän hyväksynnän saaminen

asbplayerin kanssa viestiä haluavan laajennuksen on ensin muodostettava yhteys alla olevan esimerkin kaltaisella koodilla. asbplayerin laajennustunnuksen saa selaimen laajennusten hallinnasta (Chromessa `chrome://extensions`, Firefoxissa `about:addons`).

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>, {
    name: 'asbplayer-external-v1', // Must match this string exactly
});
```

Pyydä hyväksyntää `initialize`-komennolla, joka palauttaa heti nykyisen tilan.

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'initialize',
    params: {
        name: 'external-extension-name', // Self-reported name
        version: '1.2.3', // Self-reported version
    },
});
```

Jos laajennusta ei ole hyväksytty, asbplayer merkitsee yhteyden odottavaksi, pyytää käyttäjältä hyväksyntää ja vastaa näin:

```json
{
    "jsonrpc": "2.0",
    "id": "<the id from the initialize request>",
    "result": { "state": "pending" }
}
```

Tarkista `approval-state`-komennolla, onko käyttäjä hyväksynyt yhteyspyynnön.

```json
{
    "jsonrpc": "2.0",
    "id": "<request id>",
    "method": "approval-state",
    "params": {}
}
```

Hyväksynnän jälkeen `approval-state` palauttaa `{ "state": "approved" }` ja yhteyden kautta voi lähettää komentoja. Jos pyyntö hylätään, `approval-state` palauttaa kerran `{ "state": "denied" }`. Tämän jälkeen asbplayer sulkee portin. Hylätty laajennus ei voi pyytää hyväksyntää uudelleen 24 tuntiin.

Komentoja voi lähettää [ohjeissa kuvatulla tavalla](../reference/external-api.md). Esimerkki:

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'get-bound-media',
    params: {},
});
```

asbplayer vastaa onnistuneessa pyynnössä muodossa `{ jsonrpc, id, result }` ja epäonnistuessa muodossa `{ jsonrpc, id, error }`.
