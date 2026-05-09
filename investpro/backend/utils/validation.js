/**
 * Unified password validation rule: minimum 8 characters.
 * No complexity rules (uppercase, numbers, or special characters).
 * @param {string} password 
 * @returns {boolean}
 */
const isValidPassword = (password) => {
  return typeof password === 'string' && password.length >= 8;
};

module.exports = {
  isValidPassword
};
