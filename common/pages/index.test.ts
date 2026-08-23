import { pageMetadata } from '.';
import { expect, it } from '@jest/globals';

it('page csp rule ids are distinct', () => {
    const seenRuleIds: { [ruleId: number]: boolean } = {};
    for (const metadata of Object.values(pageMetadata)) {
        expect(!(metadata.disableCspRuleId in seenRuleIds));
        seenRuleIds[metadata.disableCspRuleId] = true;
    }
});
