import { configureLogProvider, LogProvider } from '@project/common/util';
import { ExtensionLogStorage } from '@/services/extension-log-storage';

export const extensionLogProvider = new LogProvider(new ExtensionLogStorage());

export function configureExtensionLogProvider(): LogProvider {
    void configureLogProvider(extensionLogProvider);
    return extensionLogProvider;
}
