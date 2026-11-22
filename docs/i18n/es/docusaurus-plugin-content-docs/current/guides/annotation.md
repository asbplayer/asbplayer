---
sidebar_position: 1
---

import project from '@site/src/project';

# Anotaciones {#annotation}

asbplayer puede añadir anotaciones a los subtítulos para facilitar el aprendizaje de idiomas. Entre las funciones de anotación se incluyen:

- **Estilo de palabras**: color, subrayado, contorno, etc., según el estado de una palabra.
    - El estado de palabra conocida se puede obtener y sincronizar con Anki o WaniKani, o guardarse localmente en asbplayer (incluye funciones de importación y exportación para añadir palabras conocidas).
- **Anotación de lectura**: muestra las lecturas encima de cada palabra o según su estado.
- **Anotación de frecuencia**: muestra debajo de cada palabra la frecuencia basada en su rango o según su estado (requiere al menos un diccionario de frecuencia basado en rangos).
- **Anotación de acento tonal**: muestra patrones de acento en furigana o en palabras escritas en kana (requiere al menos un diccionario de acento tonal).
- **Anotación de glosario**: muestra definiciones o explicaciones breves de cada palabra.
- **Estadísticas y comprensión**: ofrece información sobre las palabras que conoces en el contenido actual.
- **Reproducción adaptativa**: usa los modos de reproducción y los datos de las anotaciones para optimizar tu aprendizaje.
- **Explorador de palabras**: administra las palabras locales y permite ver las sincronizadas desde fuentes externas.
- **Muchas más funciones en futuras versiones**.

:::info
Las anotaciones requieren una instancia configurada de [Yomitan](https://yomitan.wiki/) y [yomitan-api](https://github.com/yomidevs/yomitan-api).

Si usas la **base de datos local de palabras**, te recomendamos instalar la extensión del navegador de asbplayer para reducir la posibilidad de que el navegador elimine las palabras guardadas. Si no puedes instalar la extensión, considera exportar periódicamente los ajustes o las palabras locales como copia de seguridad.
:::

## Configuración {#setup}

1. Abre los **ajustes** de asbplayer.
2. Ve a la sección **Anotaciones**.
3. Selecciona la pista que quieras configurar.
4. Configura la **URL de Yomitan** para esa pista.
    - Necesitarás una instancia configurada de [Yomitan](https://yomitan.wiki/) y [yomitan-api](https://github.com/yomidevs/yomitan-api).
    - Si la URL no es válida o no se puede alcanzar, asbplayer mostrará un error junto al ajuste.
    - La información de frecuencia requiere que tu instancia de Yomitan tenga disponible al menos un diccionario de frecuencia basado en rangos.
5. (Usuarios de Anki) Configura de qué tarjetas se obtendrá la información del estado de las palabras.
    - Normalmente, conviene dejar [`Mazos de Anki`](../reference/settings.md#anki-decks) vacío para incluir todos los mazos. Suele bastar con filtrar por campos.
    - [`Campos de palabras de Anki`](../reference/settings.md#anki-word-fields) corresponde al campo de la nota de Anki que contiene únicamente la palabra objetivo.
    - [`Campos de oraciones de Anki`](../reference/settings.md#anki-sentence-fields) solo se debe usar para las notas de Anki que no tengan un campo específico para palabras (como los mazos de oraciones). Estas palabras se usan como alternativa si la palabra no está en los campos de palabras de Anki.
    - Para llenar la base de datos, usa [`Reconstruir la base de datos de palabras de Anki`](../reference/settings.md#re-build-anki-word-database) después de configurar estos campos.
6. (Usuarios de WaniKani) Visita [WaniKani > Ajustes > Tokens de API](https://www.wanikani.com/settings/personal_access_tokens) para crear un token para asbplayer.
    - En el campo `Token Description`, escribe `asbplayer`. Deja todas las opciones de `Permissions` sin marcar; asbplayer solo necesita acceso de lectura a tu cuenta de WaniKani.
    - Haz clic en `Generate token` y copia el token generado en [`Token de API de WaniKani`](../reference/settings.md#wanikani-api-token).
    - Para llenar la base de datos, usa [`Reconstruir la base de datos de palabras de WaniKani`](../reference/settings.md#re-build-wanikani-word-database) después de configurar el token de API.
7. Activa las funciones de anotación que quieras (estilo, lectura, frecuencia, acento tonal, etc.) para esa pista. Personaliza los demás ajustes según prefieras.
8. Para ver explicaciones detalladas de cada opción, consulta la sección [Anotaciones](../reference/settings.md#annotation) de la referencia de ajustes. Las acciones de teclado aparecen en el grupo [Atajos de teclado para anotaciones](../reference/settings.md#annotation-keyboard-shortcuts).

## Solución de problemas {#troubleshooting}

Consulta la sección de [problemas frecuentes](../common-issues.md#annotation) para resolver problemas con las anotaciones. Si no encuentras una solución, ponte en contacto con nosotros en <a href={project.urls.discord}>Discord</a> o envía un <a href={`${project.urls.repo}/issues`}>informe de error</a> con información detallada sobre el problema y los pasos para reproducirlo.
