/**
 * Unified password validation rule:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * This prevents trivially weak passwords like "password" or "12345678".
 * @param {string} password
 * @returns {boolean}
 */
const isValidPassword = (password) => {
  if (typeof password !== 'string') return false;
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
};

/**
 * Returns a human-readable error message for an invalid password.
 * @param {string} password
 * @returns {string|null} null if valid, error message if invalid
 */
const getPasswordError = (password) => {
  if (typeof password !== 'string' || password.length < 8) {
    return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
  }
  if (!/[A-Z]/.test(password)) {
    return 'كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل';
  }
  if (!/[a-z]/.test(password)) {
    return 'كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل';
  }
  if (!/[0-9]/.test(password)) {
    return 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل';
  }
  return null;
};

module.exports = {
  isValidPassword,
  getPasswordError,
};
