// @ts-expect-error: navigator.userAgentData is not yet in the TypeScript lib.dom.d.ts
export const isMacOs = (navigator.userAgentData?.platform ?? navigator.platform)?.toUpperCase()?.indexOf('MAC') > -1;
