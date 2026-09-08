import type { SettingsStorage } from '@project/common/settings';

export interface AppSettingsStorage extends SettingsStorage {
    onSettingsUpdated(callback: () => void): () => void;
}
