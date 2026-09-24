const { submitOrderSchema } = require('../../src/api/validation/orderSchemas');

const validOrder = {
  orderid: 'ord1001',
  customerid: 'cust001',
  customertype: 'Standard',
  productid: 'prod01',
  quantity: 60,
  promiseddeliverydate: '2026-09-25'
};

describe('submitOrderSchema', () => {
  it('accepts a fully valid order', () => {
    const result = submitOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it.each(['orderid', 'customerid', 'customertype', 'productid', 'quantity', 'promiseddeliverydate'])(
    'rejects when %s is missing',
    (field) => {
      const { [field]: _omit, ...rest } = validOrder;
      const result = submitOrderSchema.safeParse(rest);
      expect(result.success).toBe(false);
    }
  );

  it("rejects customertype values other than exactly 'Standard' or 'Priority'", () => {
    for (const bad of ['standard', 'PRIORITY', 'priority', 'Regular', '']) {
      const result = submitOrderSchema.safeParse({ ...validOrder, customertype: bad });
      expect(result.success).toBe(false);
    }
  });

  it('rejects quantity that is zero, negative, or non-integer', () => {
    for (const bad of [0, -5, 1.5]) {
      const result = submitOrderSchema.safeParse({ ...validOrder, quantity: bad });
      expect(result.success).toBe(false);
    }
  });

  it('rejects quantity given as a string', () => {
    const result = submitOrderSchema.safeParse({ ...validOrder, quantity: '60' });
    expect(result.success).toBe(false);
  });

  it('rejects promiseddeliverydate not in YYYY-MM-DD format', () => {
    for (const bad of ['2026/09/25', '09-25-2026', '2026-9-25', 'not-a-date']) {
      const result = submitOrderSchema.safeParse({ ...validOrder, promiseddeliverydate: bad });
      expect(result.success).toBe(false);
    }
  });

  it('reports the offending field name in the error details path', () => {
    const result = submitOrderSchema.safeParse({ ...validOrder, quantity: -1 });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['quantity']);
  });
});
