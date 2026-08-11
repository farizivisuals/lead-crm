jest.mock('../../supabase', () => ({ supabase: {} }));

import {
  formatKD,
  parseQuantity,
  parsePrice,
  quoteTotal,
  draftTotal,
  toLineItemPayload,
  type DraftLineItem,
} from '../quotes';

const draft = (over: Partial<DraftLineItem> = {}): DraftLineItem => ({
  key: 'k',
  description: 'Item',
  quantity: '1',
  unit_price: '0',
  ...over,
});

describe('parseQuantity', () => {
  it('keeps an explicit zero instead of turning it into one', () => {
    // The web uses `parseFloat(q) || 1`, and 0 || 1 === 1 — so a deliberate
    // quantity of 0 silently became 1 in both the subtotal and the saved row.
    expect(parseQuantity('0')).toBe(0);
  });

  it('falls back to 1 only when the field is not a number', () => {
    expect(parseQuantity('')).toBe(1);
    expect(parseQuantity('abc')).toBe(1);
    expect(parseQuantity('2.5')).toBe(2.5);
  });
});

describe('parsePrice', () => {
  it('treats an unfilled price as zero and keeps three decimals', () => {
    expect(parsePrice('')).toBe(0);
    expect(parsePrice('12.345')).toBe(12.345);
  });
});

describe('formatKD', () => {
  it('always shows three decimals, because a dinar is 1000 fils', () => {
    expect(formatKD(12.345)).toBe('KD 12.345');
    expect(formatKD(2750)).toBe('KD 2,750.000');
    expect(formatKD(0)).toBe('KD 0.000');
  });
});

describe('quoteTotal', () => {
  it('sums quantity times unit price across lines', () => {
    expect(
      quoteTotal([
        { quantity: 2, unit_price: 10.5 },
        { quantity: 3, unit_price: 1.005 },
      ])
    ).toBeCloseTo(24.015, 3);
  });

  it('is zero for no lines', () => {
    expect(quoteTotal([])).toBe(0);
  });
});

describe('draftTotal', () => {
  it('counts a zero-quantity line as zero, not as one unit', () => {
    expect(draftTotal([draft({ quantity: '0', unit_price: '99' })])).toBe(0);
  });
});

describe('toLineItemPayload', () => {
  it('drops blank rows and renumbers position from the surviving order', () => {
    const payload = toLineItemPayload([
      draft({ description: 'First', quantity: '2', unit_price: '5' }),
      draft({ description: '   ' }),
      draft({ description: 'Second', quantity: '1', unit_price: '12.345' }),
    ]);
    expect(payload).toEqual([
      { description: 'First', quantity: 2, unit_price: 5, position: 0 },
      { description: 'Second', quantity: 1, unit_price: 12.345, position: 1 },
    ]);
  });
});
