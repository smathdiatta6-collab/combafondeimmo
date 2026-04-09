/**
 * Converts a number to its French word representation.
 * This is a simplified version suitable for financial amounts.
 */
export function numberToWordsFrench(n: number): string {
  if (n === 0) return 'ZÉRO';

  const units = ['', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF'];
  const tens = ['', 'DIX', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE-DIX', 'QUATRE-VINGT', 'QUATRE-VINGT-DIX'];
  const special = ['DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF'];

  function convertLessThanThousand(num: number): string {
    let res = '';

    // Hundreds
    if (num >= 100) {
      const h = Math.floor(num / 100);
      if (h > 1) {
        res += units[h] + ' CENT';
        if (num % 100 === 0) res += 'S'; // Plural cents if exact
      } else {
        res += 'CENT';
      }
      num %= 100;
      if (num > 0) res += ' ';
    }

    // Tens and Units
    if (num >= 20) {
      const t = Math.floor(num / 10);
      const u = num % 10;
      
      if (t === 7) { // 70-79
        res += 'SOIXANTE';
        if (u === 1) res += ' ET ONZE';
        else res += '-' + special[u];
      } else if (t === 9) { // 90-99
        res += 'QUATRE-VINGT';
        res += '-' + special[u];
      } else {
        res += tens[t];
        if (u === 1) res += ' ET UN';
        else if (u > 1) res += '-' + units[u];
        
        // Plural vingts if exact 80
        if (t === 8 && u === 0) res += 'S';
      }
    } else if (num >= 10) {
      res += special[num - 10];
    } else if (num > 0) {
      res += units[num];
    }

    return res.trim();
  }

  let result = '';
  let temp = n;

  // Millions
  if (temp >= 1000000) {
    const m = Math.floor(temp / 1000000);
    result += convertLessThanThousand(m) + ' MILLION';
    if (m > 1) result += 'S';
    temp %= 1000000;
    if (temp > 0) result += ' ';
  }

  // Thousands
  if (temp >= 1000) {
    const k = Math.floor(temp / 1000);
    if (k > 1) {
      result += convertLessThanThousand(k) + ' MILLE';
    } else {
      result += 'MILLE';
    }
    temp %= 1000;
    if (temp > 0) result += ' ';
  }

  // Remainder
  if (temp > 0 || result === '') {
    result += convertLessThanThousand(temp);
  }

  return result.trim().toUpperCase();
}
