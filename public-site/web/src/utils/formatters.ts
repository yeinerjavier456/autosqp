import { COMPANY_INFO } from '../data/company';

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(amount).replace('COP', '').trim();
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('es-CO').format(amount);
}

export function createWhatsAppLink(message: string, phoneRaw = COMPANY_INFO.phone1Raw): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phoneRaw}?text=${encoded}`;
}

export function calculateLoanMonthlyPayment(
  principal: number,
  annualInterestRate = 0.165, // ~16.5% EA or ~1.28% MV in Colombia
  months: number
): {
  monthlyPayment: number;
  totalInterest: number;
  totalPayment: number;
} {
  if (principal <= 0 || months <= 0) {
    return { monthlyPayment: 0, totalInterest: 0, totalPayment: 0 };
  }

  // Monthly nominal rate approximation
  const monthlyRate = Math.pow(1 + annualInterestRate, 1 / 12) - 1;
  const factor = Math.pow(1 + monthlyRate, months);
  const monthlyPayment = Math.round((principal * (monthlyRate * factor)) / (factor - 1));
  const totalPayment = monthlyPayment * months;
  const totalInterest = totalPayment - principal;

  return {
    monthlyPayment,
    totalInterest,
    totalPayment
  };
}
