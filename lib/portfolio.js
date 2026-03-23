/**
 * Calculate total portfolio value from holdings and a live quote map.
 * @param {Array} holdings - array of holding rows with { ticker, shares }
 * @param {Object} quotes - map of ticker -> { price, ... }
 * @returns {number}
 */
export function calculatePortfolioValue(holdings, quotes) {
  return holdings.reduce((sum, h) => {
    const price = quotes[h.ticker]?.price ?? 0
    return sum + h.shares * price
  }, 0)
}
