import project from '@project/common/project';

export * from './settings';
export * from './settings-dictionary';
export * from './settings-provider';
export * from './settings-recipes';
export * from './test-card';
export const supportedLanguages = project.languages.map(({ code }) => code);
