import { inheritHtmlMarkup } from './anki';
import { expect, it } from '@jest/globals';

it('inherits marked up html', () => {
    expect(inheritHtmlMarkup('a foo bar', '<c>foo</c> <b>bar</b> is')).toEqual('a <c>foo</c> <b>bar</b>');
});

it('inherits marked up html for nested tags', () => {
    expect(inheritHtmlMarkup('a <c class="term">foo</c> bar', '<b><c class="term">foo</c></b> <b>bar</b> is')).toEqual(
        'a <b><c class="term">foo</c></b> <b>bar</b>'
    );
});

it('inherits marked up html for nested tags 2', () => {
    expect(inheritHtmlMarkup('a foo bar', '<b><c class="term">foo</c></b> <b>bar</b> is')).toEqual(
        'a <b><c class="term">foo</c></b> <b>bar</b>'
    );
});

it('inherits marked up html for nested tags 3', () => {
    expect(
        inheritHtmlMarkup('a <c class="term">foo</c> bar', '<d><b><c class="term">foo</c></b></d> <b>bar</b> is')
    ).toEqual('a <d><b><c class="term">foo</c></b></d> <b>bar</b>');
});

it('inherits marked up html with break lines', () => {
    expect(inheritHtmlMarkup('a foo bar', '<d>foo</d><br> <b>bar</b> is')).toEqual('a <d>foo</d> <b>bar</b>');
});

it('does not inherit marked up html if already marked up', () => {
    expect(
        inheritHtmlMarkup('a <d><b><c class="term">foo</c></b></d> bar', '<b><c class="term">foo</c></b> <b>bar</b> is')
    ).toEqual('a <d><b><c class="term">foo</c></b></d> <b>bar</b>');
});
