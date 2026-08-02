import { describe, expect, it } from '@jest/globals';
import { HoveredToken } from './dom-annotations';

describe('HoveredToken', () => {
    it('extracts visible token text and track while ignoring ruby text', () => {
        const hoveredToken = new HoveredToken();
        const wrapper = document.createElement('div');
        wrapper.dataset.track = '3';
        wrapper.innerHTML = '<span class="asb-token"> 語<ruby><rb>学</rb><rt>がく</rt></ruby> </span>';
        const inner = wrapper.querySelector('ruby') as HTMLElement;

        hoveredToken.handleMouseOver({ target: inner } as unknown as MouseEvent);

        expect(hoveredToken.parse()).toEqual({ token: '語学', track: 3 });
    });

    it('clears when the hovered token receives mouseout', () => {
        const hoveredToken = new HoveredToken();
        const wrapper = document.createElement('div');
        wrapper.dataset.track = '1';
        wrapper.innerHTML = '<span class="asb-token">word</span>';
        const token = wrapper.querySelector('.asb-token') as HTMLElement;

        hoveredToken.handleMouseOver({ target: token } as unknown as MouseEvent);
        expect(hoveredToken.parse()).toEqual({ token: 'word', track: 1 });

        hoveredToken.handleMouseOut({ target: token } as unknown as MouseEvent);
        expect(hoveredToken.parse()).toBeNull();
    });

    it('preserves the hovered token when mouseout comes from a different element', () => {
        const hoveredToken = new HoveredToken();
        const wrapper = document.createElement('div');
        wrapper.dataset.track = '1';
        wrapper.innerHTML = '<span class="asb-token">word</span><span class="other">other</span>';
        const token = wrapper.querySelector('.asb-token') as HTMLElement;
        const other = wrapper.querySelector('.other') as HTMLElement;

        hoveredToken.handleMouseOver({ target: token } as unknown as MouseEvent);
        hoveredToken.handleMouseOut({ target: other } as unknown as MouseEvent);

        expect(hoveredToken.parse()).toEqual({ token: 'word', track: 1 });
    });
});
