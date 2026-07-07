import { Command, Message, PublishCardMessage } from '@project/common';
import { CardPublisher } from '../../services/card-publisher';

export default class PublishCardHandler {
    private readonly _cardPublisher: CardPublisher;

    constructor(cardPublisher: CardPublisher) {
        this._cardPublisher = cardPublisher;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'publish-card';
    }

    handle(command: Command<Message>) {
        const message = command.message as PublishCardMessage;
        void this._cardPublisher.publish(message);
        return false;
    }
}
