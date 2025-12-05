import { getYear, isValid, parseISO } from 'date-fns';

// Calculate Easter date using the Anonymous Gregorian algorithm
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month - 1, day);
}

// Get all Brazilian national holidays for a given year
export function getBrazilianHolidays(year: number): Date[] {
  const holidays: Date[] = [];
  
  // Fixed holidays
  holidays.push(new Date(year, 0, 1));   // Ano Novo - 1 de Janeiro
  holidays.push(new Date(year, 3, 21));  // Tiradentes - 21 de Abril
  holidays.push(new Date(year, 4, 1));   // Dia do Trabalho - 1 de Maio
  holidays.push(new Date(year, 8, 7));   // Independência - 7 de Setembro
  holidays.push(new Date(year, 9, 12));  // Nossa Senhora Aparecida - 12 de Outubro
  holidays.push(new Date(year, 10, 2));  // Finados - 2 de Novembro
  holidays.push(new Date(year, 10, 15)); // Proclamação da República - 15 de Novembro
  holidays.push(new Date(year, 11, 25)); // Natal - 25 de Dezembro
  
  // Mobile holidays based on Easter
  const easter = getEasterDate(year);
  
  // Carnaval - 47 days before Easter (Tuesday)
  const carnival = new Date(easter);
  carnival.setDate(easter.getDate() - 47);
  holidays.push(carnival);
  
  // Carnaval Monday
  const carnivalMonday = new Date(easter);
  carnivalMonday.setDate(easter.getDate() - 48);
  holidays.push(carnivalMonday);
  
  // Sexta-feira Santa - 2 days before Easter
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays.push(goodFriday);
  
  // Corpus Christi - 60 days after Easter
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);
  holidays.push(corpusChristi);
  
  return holidays;
}

// Check if a date is a Brazilian holiday
export function isBrazilianHoliday(date: Date): boolean {
  if (!isValid(date)) return false;
  
  const year = getYear(date);
  const holidays = getBrazilianHolidays(year);
  
  return holidays.some(holiday => 
    holiday.getDate() === date.getDate() &&
    holiday.getMonth() === date.getMonth() &&
    holiday.getFullYear() === date.getFullYear()
  );
}
