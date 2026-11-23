---
sidebar_position: 1
---

import project from '@site/src/project';

# Annotazioni {#annotation}

asbplayer può annotare i sottotitoli per aiutarti a imparare le lingue. Le funzioni di annotazione includono:

- **Stile delle parole**: colore, sottolineatura, contorno e altro in base allo stato della parola
    - Lo stato di conoscenza può provenire da Anki, WaniKani e/o essere tracciato localmente in asbplayer; sono incluse funzioni di importazione ed esportazione per iniziare a compilare le parole conosciute.
- **Annotazione della lettura**: mostra la lettura sopra ogni parola oppure in base al suo stato.
- **Annotazione della frequenza**: mostra la frequenza basata sul rango sotto ogni parola oppure in base al suo stato (è necessario almeno un dizionario di frequenza basato sul rango).
- **Annotazione dell'accento tonale**: mostra gli schemi di accento sui furigana o sulle parole in kana (è necessario almeno un dizionario degli accenti tonali).
- **Annotazione del glossario**: mostra brevi definizioni o spiegazioni per ogni parola.
- **Statistiche e comprensione**: offre informazioni sulle parole che conosci nel contenuto corrente.
- **Riproduzione adattiva**: usa le modalità di riproduzione e i dati delle annotazioni per ottimizzare il tuo apprendimento.
- **Browser delle parole**: gestisce le parole locali e mostra quelle sincronizzate da fonti esterne.
- **Molte altre funzionalità sono previste per le prossime versioni.**

:::info
Per usare le annotazioni, devi configurare un'istanza di [Yomitan](https://yomitan.wiki/) e [yomitan-api](https://github.com/yomidevs/yomitan-api).

Se usi il **database locale delle parole**, ti consigliamo di installare l'estensione per browser di asbplayer, così è meno probabile che il browser elimini le parole salvate. Se non puoi installare l'estensione, valuta di esportare periodicamente le impostazioni e/o le parole locali come backup.
:::

## Configurazione {#setup}

1. Apri le **Impostazioni** di asbplayer.
2. Vai alla sezione **Annotazioni**.
3. Seleziona la traccia da configurare.
4. Configura l'**URL di Yomitan** per quella traccia.
    - Devi configurare un'istanza di [Yomitan](https://yomitan.wiki/) e [yomitan-api](https://github.com/yomidevs/yomitan-api).
    - Se l'URL non è valido o non è raggiungibile, asbplayer mostra un errore accanto all'impostazione.
    - Per visualizzare le informazioni sulla frequenza, nell'istanza di Yomitan deve essere disponibile almeno un dizionario di frequenza basato sul rango.
5. (Per chi usa Anki) Configura le carte da cui ricavare lo stato di conoscenza.
    - In genere, conviene lasciare vuoto [`Mazzi Anki`](../reference/settings.md#anki-decks) per includere tutti i mazzi; di solito basta filtrare in base ai campi.
    - [`Campi parola Anki`](../reference/settings.md#anki-word-fields) corrisponde al campo della nota Anki che contiene solo la parola da imparare.
    - Usa [`Campi frase Anki`](../reference/settings.md#anki-sentence-fields) solo per le note Anki che non hanno un campo dedicato alla parola, come i mazzi di frasi. Queste parole vengono considerate come alternativa se non sono presenti nei campi parola Anki.
    - Per compilare il database, dopo aver configurato questi campi usa [`Ricostruisci database parole Anki`](../reference/settings.md#re-build-anki-word-database).
6. (Per chi usa WaniKani) Vai su [WaniKani > Impostazioni > Token API](https://www.wanikani.com/settings/personal_access_tokens) per creare un token per asbplayer.
    - Nel campo `Token Description` inserisci `asbplayer`; lascia deselezionati tutti i `Permissions`: ad asbplayer serve solo l'accesso in lettura al tuo account WaniKani.
    - Fai clic su `Generate token` e copia il token generato in [`Token API di WaniKani`](../reference/settings.md#wanikani-api-token).
    - Per compilare il database, dopo aver configurato il token API usa [`Ricostruisci database parole WaniKani`](../reference/settings.md#re-build-wanikani-word-database).
7. Attiva le funzioni di annotazione desiderate (stile, lettura, frequenza, accento tonale e così via) per quella traccia. Personalizza le altre impostazioni secondo le tue preferenze.
8. Per le spiegazioni dettagliate di ogni opzione, consulta la sezione [Annotazioni](../reference/settings.md#annotation) del riferimento alle impostazioni. Le azioni da tastiera sono elencate nel gruppo [Scorciatoie da tastiera per le annotazioni](../reference/settings.md#annotation-keyboard-shortcuts).

## Risoluzione dei problemi {#troubleshooting}

Per risolvere i problemi con le annotazioni, consulta la sezione [problemi comuni](../common-issues.md#annotation) della documentazione. Se non trovi una soluzione, chiedi aiuto su <a href={project.urls.discord}>Discord</a> o invia una <a href={`${project.urls.repo}/issues`}>segnalazione di bug</a> descrivendo dettagliatamente il problema e i passaggi per riprodurlo.
