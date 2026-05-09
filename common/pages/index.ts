import { PageSettings } from '../settings';

export interface PageMetadata {
    title: string;
    disableCspRuleId: number;
}

export const pageMetadata: { [K in keyof PageSettings]: PageMetadata } = {
    netflix: { title: 'Netflix', disableCspRuleId: 1 },
    youtube: { title: 'YouTube', disableCspRuleId: 2 },
    tver: { title: 'TVer', disableCspRuleId: 3 },
    bandaiChannel: { title: 'Bandai Channel', disableCspRuleId: 4 },
    amazonPrime: { title: 'Amazon Prime', disableCspRuleId: 5 },
    hulu: { title: 'Hulu', disableCspRuleId: 6 },
    disneyPlus: { title: 'Disney Plus', disableCspRuleId: 7 },
    appsDisneyPlus: { title: 'Disney Plus (apps.disneyplus.com)', disableCspRuleId: 8 },
    unext: { title: 'UNext', disableCspRuleId: 9 },
    viki: { title: 'Viki', disableCspRuleId: 10 },
    embyJellyfin: { title: 'Emby/Jellyfin', disableCspRuleId: 11 },
    twitch: { title: 'Twitch', disableCspRuleId: 12 },
    osnPlus: { title: 'OSN Plus', disableCspRuleId: 13 },
    bilibili: { title: 'Bilibili', disableCspRuleId: 14 },
    nrktv: { title: 'NRK TV', disableCspRuleId: 15 },
    plex: { title: 'Plex', disableCspRuleId: 16 },
    yleAreena: { title: 'Yle Areena', disableCspRuleId: 17 },
    hboMax: { title: 'HBO Max', disableCspRuleId: 18 },
    stremio: { title: 'Stremio', disableCspRuleId: 19 },
    cijapanese: { title: 'Comprehensible Japanese', disableCspRuleId: 20 },
    iwanttfc: { title: 'iWantTFC', disableCspRuleId: 21 },
    svtplay: { title: 'SVT Play', disableCspRuleId: 22 },
    urplay: { title: 'UR Play', disableCspRuleId: 23 },
    archive: { title: 'Internet Archive', disableCspRuleId: 24 },
};
