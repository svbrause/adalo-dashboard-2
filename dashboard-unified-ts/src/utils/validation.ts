// Validation utilities

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  // US phone numbers should be 10 digits
  return cleaned.length === 10;
}

export function isValidZipCode(zipCode: string): boolean {
  if (!zipCode) return false;
  // Remove all non-digits
  const cleaned = zipCode.replace(/\D/g, '');
  // US zip codes should be 5 or 9 digits
  return cleaned.length === 5 || cleaned.length === 9;
}

export function formatPhoneInput(input: HTMLInputElement): void {
  let value = input.value.replace(/\D/g, '');
  if (value.length > 10) {
    value = value.slice(0, 10);
  }
  
  if (value.length >= 6) {
    value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
  } else if (value.length >= 3) {
    value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
  }
  
  input.value = value;
}

export function formatZipCodeInput(input: HTMLInputElement): void {
  let value = input.value.replace(/\D/g, '');
  if (value.length > 9) {
    value = value.slice(0, 9);
  }
  
  if (value.length > 5) {
    input.value = `${value.slice(0, 5)}-${value.slice(5)}`;
  } else {
    input.value = value;
  }
}

export function splitName(fullName: string): { first: string; last: string } {
  if (!fullName) return { first: '', last: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0], last: '' };
  }
  const last = parts.pop() || '';
  const first = parts.join(' ');
  return { first, last };
}

/** Accepts string, number (e.g. from Airtable), or null/undefined. Returns digits only. */
export function cleanPhoneNumber(phone: string | number | null | undefined): string {
  if (phone == null) return '';
  const str = typeof phone === 'string' ? phone : String(phone);
  return str.replace(/\D/g, '');
}

/**
 * Format a phone string for display, e.g. "(914) 450-1678".
 * Accepts raw digits, numbers (e.g. from Airtable), or already-formatted strings.
 */
export function formatPhoneDisplay(phone: string | number | null | undefined): string {
  if (phone == null) return '';
  const str = typeof phone === 'string' ? phone : String(phone);
  if (!str.trim()) return '';
  const digits = str.replace(/\D/g, '');
  if (digits.length >= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length >= 3) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return digits || str;
}
