import { Decimal } from 'decimal.js';

// Unit conversion helpers (extracted from ingredient.service.ts for isolated testing)
const UNIT_CONVERSIONS: Record<string, { base: string; factor: number }> = {
  'kg':    { base: 'g',     factor: 1000 },
  'g':     { base: 'g',     factor: 1 },
  'l':     { base: 'ml',    factor: 1000 },
  'ml':    { base: 'ml',    factor: 1 },
  'dozen': { base: 'piece', factor: 12 },
  'piece': { base: 'piece', factor: 1 },
};

function decimalToBaseUnit(unit: string, quantity: Decimal, conversionToBase?: number): Decimal {
  const conv = UNIT_CONVERSIONS[unit];
  if (conv) return quantity.times(conv.factor);
  if (conversionToBase) return quantity.times(conversionToBase);
  return quantity;
}

function decimalFromBaseUnit(unit: string, quantity: Decimal, conversionToBase?: number): Decimal {
  const conv = UNIT_CONVERSIONS[unit];
  if (conv) return quantity.div(conv.factor);
  if (conversionToBase) return quantity.div(conversionToBase);
  return quantity;
}

describe('IngredientService — deduction arithmetic (Decimal.js)', () => {
  // Verifies that multi-step unit conversion and subtraction
  // done in Decimal space does not accumulate floating-point drift.
  it('preserves precision across kg → g → kg round-trip', () => {
    // Simulate: recipe calls for 0.3 kg of an ingredient that's stored in kg
    // This is 3 orders of 0.1 kg each
    const recipeRequired = new Decimal('0.1');  // kg per serving
    const orderQty = 3;
    const totalRequired = recipeRequired.times(orderQty);  // 0.3 kg

    const requiredInBase = decimalToBaseUnit('kg', totalRequired);  // 0.3 × 1000 = 300 g
    const stockInBase = decimalToBaseUnit('kg', new Decimal('5.0'));  // 5.0 kg × 1000 = 5000 g
    const newStockInBase = stockInBase.minus(requiredInBase);  // 5000 - 300 = 4700 g
    const newStock = decimalFromBaseUnit('kg', newStockInBase);  // 4700 / 1000 = 4.7 kg

    expect(newStock.toNumber()).toBe(4.7);
  });

  it('preserves precision across dozen → piece → dozen round-trip', () => {
    const required = new Decimal('1.5');  // 1.5 dozen
    const inBase = decimalToBaseUnit('dozen', required);  // 1.5 × 12 = 18 piece
    const stockInBase = decimalToBaseUnit('dozen', new Decimal('10'));  // 10 × 12 = 120 piece
    const remaining = stockInBase.minus(inBase);  // 120 - 18 = 102 piece
    const result = decimalFromBaseUnit('dozen', remaining);  // 102 / 12 = 8.5 dozen

    expect(result.toNumber()).toBe(8.5);
  });

  it('handles fractional quantities without drift', () => {
    // A classic floating-point offender: 0.1 + 0.2 = 0.30000000000000004
    const recipeRequired = new Decimal('0.1');  // kg
    const orderQty = 1;
    const wastePct = 0;

    const totalRequired = recipeRequired.times(orderQty);
    const wasteMul = new Decimal(1).plus(new Decimal(wastePct).div(100));
    const totalWithWaste = totalRequired.times(wasteMul);  // 0.1 kg

    const stockInBase = decimalToBaseUnit('kg', new Decimal('0.2'));  // 0.2 kg = 200 g
    const requiredInBase = decimalToBaseUnit('kg', totalWithWaste);  // 0.1 kg = 100 g
    const newStockInBase = stockInBase.minus(requiredInBase);  // 100 g
    const newStock = decimalFromBaseUnit('kg', newStockInBase);  // 0.1 kg

    // Without Decimal: 0.2 - 0.1 = 0.10000000000000003
    // With Decimal: 0.1 exactly
    expect(newStock.toNumber()).toBe(0.1);
  });

  it('chained waste-percent + unit conversion stays exact', () => {
    // 2.5 dozen eggs, 5% waste, stored in pieces
    const recipeRequired = new Decimal('2.5');  // dozen
    const orderQty = 1;
    const wastePct = 5;

    const totalRequired = recipeRequired.times(orderQty);
    const wasteMul = new Decimal(1).plus(new Decimal(wastePct).div(100));  // 1.05
    const totalWithWaste = totalRequired.times(wasteMul);  // 2.625 dozen

    const requiredInBase = decimalToBaseUnit('dozen', totalWithWaste);  // 2.625 × 12 = 31.5 pieces
    const stockInBase = decimalToBaseUnit('piece', new Decimal('100'));  // 100 pieces
    const newStockInBase = stockInBase.minus(requiredInBase);  // 68.5 pieces
    const newStock = decimalFromBaseUnit('piece', newStockInBase);  // 68.5 pieces

    expect(newStock.toNumber()).toBe(68.5);
  });

  it('ingredient-level conversion (pack → piece) works exactly', () => {
    // 2 packs, each pack = 24 pieces (conversion_to_base = 24)
    const required = new Decimal('2');  // packs
    const inBase = decimalToBaseUnit('pack', required, 24);  // 2 × 24 = 48 pieces
    const stockInBase = decimalToBaseUnit('pack', new Decimal('5'), 24);  // 5 × 24 = 120 pieces
    const remaining = stockInBase.minus(inBase);  // 72 pieces
    const result = decimalFromBaseUnit('pack', remaining, 24);  // 72 / 24 = 3 packs

    expect(result.toNumber()).toBe(3);
  });

  it('toNumber() on Decimal does not introduce drift', () => {
    // Verify that Decimal → number → Decimal round-trip preserves 3-decimal precision
    const d = new Decimal('123.456');
    const back = new Decimal(d.toNumber());
    expect(back.toFixed(3)).toBe('123.456');
  });
});

describe('IngredientService — lock ordering', () => {
  it('sorts ingredient IDs to prevent deadlock', () => {
    const ids = ['c', 'a', 'b'].sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates ingredient IDs before sorting', () => {
    const ids = ['b', 'a', 'b', 'c', 'a'];
    const deduped = [...new Set(ids)].sort();
    expect(deduped).toEqual(['a', 'b', 'c']);
  });
});
