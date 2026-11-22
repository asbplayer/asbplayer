---
sidebar_position: 3
---

import project from '@site/src/project';

import CodeBlock from '@theme/CodeBlock'; // Empty fenced code blocks lose their title and copy button; CodeBlock preserves both.

# Filtrare il testo dei sottotitoli {#subtitle-text-filtering}

Per filtrare determinate parti del testo dei sottotitoli puoi usare un'espressione regolare (regex). asbplayer trova le sequenze che corrispondono al modello regex specificato e le rimuove.

## Configurare il filtro regex {#configure-the-regex-filter}

Nella sezione <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Varie</a> delle impostazioni di asbplayer, individua il campo «Filtro regex sottotitoli». Inserisci una regex adatta per filtrare il contenuto desiderato.
Puoi sostituire il contenuto filtrato inserendo una stringa nel campo «Sostituzione testo filtro regex sottotitoli». Se lo lasci vuoto, il contenuto viene semplicemente rimosso.

### Rimuovere i nomi dei personaggi {#remove-speaker-names}

Rimuovi i nomi dei personaggi racchiusi tra parentesi (ad es. "**（山田）**　元気ですか？")

<details>
<summary>Usa questo filtro</summary>

```text title="Subtitle regex filter"
([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Mantenere le letture giapponesi {#preserve-japanese-readings}

Rimuovi i nomi o le descrizioni tra parentesi, mantenendo le letture giapponesi che seguono immediatamente il testo giapponese. Ad esempio, `（山田）漢字(かんじ)を読む。` diventa `漢字(かんじ)を読む。`. Sia `(かんじ)` sia `（かんじ）` vengono mantenute se precedute immediatamente da un carattere negli intervalli di kanji, hiragana o katakana indicati nella regex.

È un criterio approssimativo: mantiene anche le descrizioni subito dopo il testo giapponese, come `こんにちは（笑）`, e rimuove le letture separate dal testo di riferimento da uno spazio. Non gestisce le parentesi annidate. Lascia vuoto il campo «Sostituzione testo filtro regex sottotitoli».

<details>
<summary>Usa questo filtro</summary>

```text title="Subtitle regex filter"
(?<![一-龯ぁ-ゟ゠-ヿ])[\(（][^\)）]*[\)）]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Unire le righe dei sottotitoli {#merge-subtitle-lines}

Alcuni sottotitoli sono suddivisi su più righe; questa regex li unisce in un'unica riga. Per attivare il filtro, inserisci anche `$1 $2` nel campo «Sostituzione testo filtro regex sottotitoli».

Quando combini questo modello con altri, inseriscilo per ultimo, così un'alternativa più specifica può trovare una corrispondenza prima nella stessa posizione. Le alternative non vengono applicate in passaggi separati. Tutte le corrispondenze usano lo stesso testo sostitutivo; se aggiungi gruppi di cattura ad altre alternative, cambiano i numeri da usare in `$1 $2`.

<details>
<summary>Usa questo filtro</summary>

```text title="Subtitle regex filter"
(.*)\n+(?!-)(.*)
```

```text title="Subtitle regex filter text replacement"
$1 $2
```

</details>

### Rimuovere le interruzioni di riga {#remove-newlines}

Rimuovi tutti i caratteri di nuova riga senza inserire spazi. Ad esempio, due righe contenenti `こんにちは` e `世界` diventano `こんにちは世界`. Lascia vuoto il campo «Sostituzione testo filtro regex sottotitoli». Per inserire invece uno spazio tra le righe, usa l'[esempio di unione delle righe dei sottotitoli](#merge-subtitle-lines).

<details>
<summary>Usa questo filtro</summary>

```text title="Subtitle regex filter"
\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Rimuovere le descrizioni tra parentesi quadre {#remove-bracketed-descriptions}

Rimuovi le indicazioni tra parentesi quadre che descrivono un suono o la musica in riproduzione (ad es. "**\[PLAYFUL MUSIC]**" o "**\-[GASPS]**").

<details>
<summary>Usa questo filtro</summary>

```text title="Subtitle regex filter"
-?\[.*\]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Rimuovere le descrizioni in maiuscolo {#remove-uppercase-descriptions}

In alternativa all'esempio precedente, filtra le descrizioni scritte in maiuscolo senza parentesi quadre (ad es. "**PLAYFUL MUSIC**"). Se la tua lingua usa altre lettere con segni diacritici, puoi aggiungerle all'elenco.

<details>
<summary>Usa questo filtro</summary>

```text title="Subtitle regex filter"
^[\-\(\)\.\s\p{Lu}]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Rimuovere i simboli musicali {#remove-music-symbols}

Qualsiasi combinazione di simboli usata da sola per indicare la musica in riproduzione (ad es. `♪♬♪`).

<details>
<summary>Usa questo filtro</summary>

```text title="Subtitle regex filter"
[♪♬#～〜]+
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Rimuovere le indicazioni degli effetti sonori {#remove-sound-effect-cues}

Rimuovi le indicazioni composte interamente da una descrizione tra parentesi o da simboli musicali, come `[THUNDER RUMBLING]`, `-[GASPS]` o `♪♬♪`. Gli ancoraggi `^` e `$` richiedono che corrisponda l'intero testo del sottotitolo, quindi i dialoghi come `Hello [GASPS]` o `♪ Hello ♪` vengono mantenuti. Lascia vuoto il campo «Sostituzione testo filtro regex sottotitoli».

<details>
<summary>Usa questo filtro</summary>

```text title="Subtitle regex filter"
^-?\[.+\]$|^[♪♬#～〜]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Rimuovere i marcatori da sinistra a destra {#remove-left-to-right-marks}

Rimuovi U+200E, il marcatore invisibile da sinistra a destra (LRM). Ad esempio, il testo `Hello` seguito da un LRM e da `world` diventa `Helloworld`. Inserisci la sequenza di escape letterale `\u200E` nel campo della regex e lascia vuoto il campo «Sostituzione testo filtro regex sottotitoli».

<details>
<summary>Usa questo filtro</summary>

```text title="Subtitle regex filter"
\u200E
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Rimuovere i controlli bidirezionali {#remove-bidi-controls}

Rimuovi tutti i caratteri di controllo bidirezionali Unicode, compresi il marcatore da sinistra a destra (U+200E), quello da destra a sinistra (U+200F) e i controlli di incorporamento, sovrascrittura e isolamento. Lascia vuoto il campo «Sostituzione testo filtro regex sottotitoli». Questi caratteri possono modificare l'ordine di visualizzazione del testo da destra a sinistra o misto; usa il filtro solo se vuoi rimuoverli.

<details>
<summary>Usa questo filtro</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Combinare le regex {#combining-regexes}

Puoi combinare le espressioni regolari con il carattere `|` (non servono spazi tra una e l'altra). Ad esempio, per usare due regex dell'elenco qui sopra, puoi scrivere `-?\[.*\]|[♪♬#～〜]+`. Puoi combinare tutte le regex che vuoi.

### Rimuovere il testo tra parentesi e le interruzioni di riga {#remove-parenthesized-text-and-newlines}

Per rimuovere insieme il testo tra parentesi e tutte le interruzioni di riga, usa:

Lascia vuoto il campo «Sostituzione testo filtro regex sottotitoli». Ad esempio, `（山田）こんにちは` seguito da un'interruzione di riga e da `世界` diventa `こんにちは世界`. Il filtro rimuove sia le parentesi ASCII sia quelle a larghezza intera e il loro contenuto, incluse le letture giapponesi, e unisce le righe senza aggiungere spazi. Non gestisce le parentesi annidate; per queste usa l'[esempio dei nomi dei personaggi](#remove-speaker-names).

<details>
<summary>Usa questo filtro</summary>

```text title="Subtitle regex filter"
[\(（][^\)）]*[\)）]|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Combinare tutti i filtri di rimozione {#combine-all-removal-filters}

Per rimuovere anche i controlli bidirezionali, i nomi dei personaggi tra parentesi (comprese quelle annidate), le descrizioni tra parentesi quadre e i simboli musicali, usa:

Lascia vuoto il campo «Sostituzione testo filtro regex sottotitoli». Questa regex combina gli esempi di rimozione precedenti e unisce le righe senza aggiungere spazi. Rimuove anche le letture giapponesi; se vuoi mantenerle, usa l'[esempio che le conserva](#preserve-japanese-readings).

<details>
<summary>Usa questo filtro</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}|([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])|-?\[.*\]|[♪♬#～〜]+|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

## Caratteri invisibili e sottotitoli vuoti {#invisible-characters}

Un sottotitolo che sembra vuoto può contenere caratteri invisibili, come un LRM. Dopo l'analisi e il filtraggio, asbplayer elimina le voci di testo che contengono solo spazi bianchi, caratteri di controllo o caratteri Unicode ignorabili per impostazione predefinita. I marcatori di direzione all'interno di testo significativo vengono mantenuti, a meno che la regex non li rimuova esplicitamente.

I caratteri invisibili all'inizio o alla fine di una voce possono impedire la corrispondenza con un modello ancorato come `^\[.+\]$`. Se il modello non trova corrispondenze, asbplayer riprova senza gli spazi bianchi e i caratteri di controllo invisibili circostanti, ma elimina la voce solo se il nuovo tentativo non lascia testo significativo. Ad esempio, `[THUNDER]` seguito da un LRM viene rimosso con questo modello e una sostituzione vuota. Il nuovo tentativo mantiene la voce originale se la sostituzione contiene testo significativo.

Quando combini un modello ancorato con un'alternativa per rimuovere i controlli bidirezionali, ricorda che le sostituzioni vengono applicate in un unico passaggio. Ad esempio, applicando `^\[.+\]$|\u200E` a `[THUNDER]` seguito da un LRM, viene rimosso l'LRM ma la descrizione tra parentesi non viene sottoposta a un nuovo tentativo. Per rimuoverli entrambi nello stesso passaggio, usa il modello non ancorato `\[.+\]|\p{Bidi_Control}` con una sostituzione vuota. Questo rimuove anche le descrizioni tra parentesi all'interno dei dialoghi.

## Approfondimenti {#learn}

Scopri come scrivere e testare espressioni regolari personalizzate nel [Playground di Regex Learn](https://regexlearn.com/playground).
