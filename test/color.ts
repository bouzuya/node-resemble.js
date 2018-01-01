import * as assert from 'assert';
import { Test, test } from 'beater';
import { getHue, getLuma } from '../src/color';

const category = 'color ';
const tests1: Test[] = [
  test(category + 'getHue', () => {
    assert(getHue({ r: 0xff, g: 0xff, b: 0xff }) === 0); // n/a
    assert(getHue({ r: 0x7f, g: 0x7f, b: 0x7f }) === 0); // n/a
    assert(getHue({ r: 0x00, g: 0x00, b: 0x00 }) === 0); // n/a
    assert(getHue({ r: 0xff, g: 0x00, b: 0x00 }) === 0);
    assert(getHue({ r: 0xbf, g: 0xbf, b: 0x00 }) === 60 / 360);
    assert(getHue({ r: 0x00, g: 0x7f, b: 0x00 }) === 120 / 360);
    assert(getHue({ r: 0x7f, g: 0xff, b: 0xff }) === 180 / 360);
    assert(getHue({ r: 0x7f, g: 0x7f, b: 0xff }) === 240 / 360);
    assert(getHue({ r: 0xbf, g: 0x3f, b: 0xbf }) === 300 / 360);
  }),
  test(category + 'getLuma', () => {
    assert(getLuma({ r: 0xff, g: 0xff, b: 0xff }) === 0xff);
    assert(getLuma({ r: 0x7f, g: 0x7f, b: 0x7f }) === 0x7f);
    assert(getLuma({ r: 0x00, g: 0x00, b: 0x00 }) === 0x00);
    assert(getLuma({ r: 0xff, g: 0x00, b: 0x00 }) === 0x4c);
    assert(getLuma({ r: 0xbf, g: 0xbf, b: 0x00 }) === 0xa9);
    assert(getLuma({ r: 0x00, g: 0x7f, b: 0x00 }) === 0x4b);
    assert(getLuma({ r: 0x7f, g: 0xff, b: 0xff }) === 0xd9);
    assert(getLuma({ r: 0x7f, g: 0x7f, b: 0xff }) === 0x8e);
    assert(getLuma({ r: 0xbf, g: 0x3f, b: 0xbf }) === 0x74);
  }),
];

export { tests1 as tests };
