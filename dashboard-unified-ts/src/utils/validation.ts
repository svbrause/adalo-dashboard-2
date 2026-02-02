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

export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}
