import { CardPublisher } from '../../services/card-publisher';

export default class BulkExportCancellationHandler {
    readonly sender = 'asbplayerv2';
    readonly command = 'bulk-export-cancelled';

    constructor(private readonly _cardPublisher: CardPublisher) {}

    handle(): boolean {
        this._cardPublisher.bulkExportCancelled = true;
        return false;
    }
}
