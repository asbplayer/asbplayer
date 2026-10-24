import extensionConfig from '@project/common/extension.json';

export * from './settings';
export * from './settings-dictionary';
export * from './settings-provider';
export * from './settings-recipes';
export * from './test-card';
export const supportedLanguages = extensionConfig.languages.map(({ code }) => code);
