---
sidebar_position: 11
---

import project from '@site/src/project';

# Sottotitoli online {#online-subtitles}

Invece di cercare manualmente i file dei sottotitoli, puoi cercarli e caricarli direttamente da asbplayer. I sottotitoli sono forniti da [Jimaku](https://jimaku.cc), un sito di sottotitoli gestito dalla community e dedicato soprattutto agli anime e ai drama giapponesi.

## Uso {#usage}

1. Apri il pannello laterale su una pagina con un video, quindi fai clic su **Carica sottotitoli**.
2. Fai clic su **Cerca sottotitoli online** (disponibile anche dal menu a discesa delle tracce dei sottotitoli).
3. Il termine di ricerca viene compilato con il titolo della pagina. Se necessario, modificalo, scegli **Anime** o **Drama** e avvia la ricerca.
4. Fai clic su un risultato per visualizzare i file dei sottotitoli, quindi fai clic su un file per caricarlo.

Sono elencati solo i file `.srt` e `.ass`. Le opere aperte di recente appaiono in **Recenti**, così la prossima volta puoi saltare la ricerca.

## Ottenere una chiave API di Jimaku {#api-key}

Jimaku richiede una chiave API per cercare e scaricare i sottotitoli.

1. Crea un account su [jimaku.cc](https://jimaku.cc) e accedi.
2. Apri la [pagina del tuo account](https://jimaku.cc/account) e genera una chiave API.
3. Incolla la chiave nel campo **Chiave API di Jimaku** della finestra di ricerca.

La chiave viene salvata automaticamente, quindi devi farlo una sola volta. Per impostazione predefinita è nascosta; usa l'icona a forma di occhio per mostrarla.

## Rilevamento automatico dell'episodio {#episode-detection}

Per le serie, asbplayer prova a leggere il numero dell'episodio dal titolo della pagina (ad esempio `S01E05`, `EP05` o `第5話`/`第五集`). Se ne trova uno:

- l'indicazione dell'episodio viene rimossa dal termine di ricerca, che così contiene solo il nome della serie;
- l'elenco dei file viene filtrato per quell'episodio, indicato con un contrassegno **EP N**. Fai clic sulla ✕ del contrassegno per visualizzare tutti i file.

Se per l'episodio selezionato non sono disponibili file di sottotitoli utilizzabili, viene mostrato l'elenco completo.

### Regex personalizzata per gli episodi {#episode-regex}

Alcuni siti usano formati di titolo che le regole integrate non riconoscono. In quel caso non viene rilevato alcun episodio e vengono mostrati tutti i file della serie. Una regex personalizzata indica ad asbplayer come leggere l'episodio su quei siti.

Dopo aver aperto una serie, fai clic sull'icona a forma di ingranaggio accanto all'intestazione dell'elenco dei file per mostrare il campo **Regex personalizzata per gli episodi**. L'ingranaggio è evidenziato quando è impostata una regex.

- Il **gruppo di cattura 1** deve contenere il numero dell'episodio (sono validi sia i numeri arabi sia quelli kanji).
- La tua regex viene provata per prima. Se è vuota, non valida o non trova corrispondenze, vengono usate le regole integrate come al solito: può quindi solo ampliare il numero di casi riconosciuti.
- Premi **Invio** per filtrare di nuovo la serie corrente. La modifica al termine di ricerca verrà applicata la prossima volta che apri la finestra.

:::tip
Le regole integrate sono state testate solo sui pochi siti usati dall'autore della funzionalità. Se il formato del titolo di un sito non viene riconosciuto, <a href={`${project.urls.repo}/issues`}>apri una segnalazione</a> includendo un esempio di titolo della pagina (oppure invia una PR a `common/subtitle-sources/jimaku-episode-patterns.ts`) per aiutare a estendere le regole integrate.
:::

Ad esempio, se il titolo delle pagine di un sito è `Some Show - Chapter 07 | SiteName`, usa:

```
Chapter (\d+)
```

## Ringraziamenti {#jimaku-acknowledgements}

Un grande ringraziamento a [Rapptz](https://github.com/Rapptz), che ha creato e mantiene [Jimaku](https://github.com/Rapptz/jimaku) e fornisce l'API che rende possibile questa funzionalità. Se la trovi utile, valuta di sostenere il sito e caricare i tuoi sottotitoli.
