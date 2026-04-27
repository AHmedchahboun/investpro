const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');

const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '30d' });

const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'غير مصرح' });
    }
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'المستخدم غير موجود' });
    if (user.isFrozen) return res.status(403).json({ success: false, message: 'الحساب مجمد: ' + (user.frozenReason || '') });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'رمز غير صالح' });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ success: false, message: 'للمشرفين فقط' });
  }
  next();
};

const mkLimit = (windowMs, max, message) =>
  rateLimit({ windowMs, max, message: { success: false, message }, standardHeaders: true, legacyHeaders: false });

const loginLimit    = mkLimit(15 * 60 * 1000, 30,  'محاولات تسجيل دخول كثيرة، حاول بعد 15 دقيقة');
const registerLimit = mkLimit(15 * 60 * 1000, 30,  'محاولات تسجيل كثيرة، حاول بعد 15 دقيقة');
const withdrawLimit = mkLimit(15 * 60 * 1000, 15,  'محاولات سحب كثيرة، حاول بعد 15 دقيقة');
const depositLimit  = mkLimit(15 * 60 * 1000, 30,  'محاولات إيداع كثيرة، حاول بعد 15 دقيقة');
const generalLimit  = mkLimit(15 * 60 * 1000, 500, 'طلبات كثيرة، حاول لاحقاً');

module.exports = { protect, adminOnly, generateToken, loginLimit, registerLimit, withdrawLimit, depositLimit, generalLimit };
