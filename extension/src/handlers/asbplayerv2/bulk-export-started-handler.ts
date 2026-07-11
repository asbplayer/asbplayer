import { CardPublisher } from '../../services/card-publisher';

export default class BulkExportStartedHandler {
    readonly sender = 'asbplayerv2';
    readonly command = 'bulk-export-started';

    constructor(private readonly _cardPublisher: CardPublisher) {}

    handle(): boolean {
        this._cardPublisher.bulkExportCancelled = false;
        return false;
    }
}
