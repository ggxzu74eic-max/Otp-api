// index.js (fixed & safer)

const express = require('express');

const app = express();
app.use(express.json());

// In-memory store (replace with DB/Redis in production)
const otpStore = new Map();

/**
 * Helpers
 */
const now = () => Date.now();
const genOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const TTL_MS = 3 * 60 * 1000;       // 3 minutes
const MAX_ATTEMPTS = 5;

const setOtp = (phone, otp) => {
  otpStore.set(phone, {
    otp,
    expiresAt: now() + TTL_MS,
    attempts: 0,
    used: false,
  });
};

const getOtpRec = (phone) => otpStore.get(phone);

/**
 * Health
 */
app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/**
 * Send OTP
 */
app.post('/send_otp', (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ success: false, code: 'invalid_phone', message: 'ফোন নম্বর দিন' });
    }

    const otp = genOtp();
    setOtp(phone, otp);

    // For testing: print to server logs
    console.log(`📩 OTP for ${phone}: ${otp} (expires in ${TTL_MS / 1000}s)`);

    return res.json({
      success: true,
      message: `OTP পাঠানো হয়েছে`,
      ttl_sec: TTL_MS / 1000,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, code: 'server_error' });
  }
});

/**
 * Verify OTP
 */
app.post('/verify_otp', (req, res) => {
  try {
    const { phone, otp } = req.body || {};
    if (!phone || !otp) {
      return res.status(400).json({ success: false, code: 'bad_request', message: 'ফোন ও OTP দিন' });
    }

    const rec = getOtpRec(phone);
    if (!rec) {
      return res.status(400).json({ success: false, code: 'not_found', message: 'OTP পাওয়া যায়নি' });
    }

    if (rec.used) {
      return res.status(410).json({ success: false, code: 'already_used', message: 'ইতিমধ্যেই ব্যবহার হয়েছে' });
    }

    if (now() > rec.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ success: false, code: 'expired', message: 'OTP-এর মেয়াদ শেষ' });
    }

    if (rec.attempts >= MAX_ATTEMPTS) {
      otpStore.delete(phone);
      return res.status(429).json({ success: false, code: 'too_many_attempts', message: 'চেষ্টা বেশি হয়েছে' });
    }

    rec.attempts += 1;

    if (otp === rec.otp) {
      rec.used = true;
      // optional: otpStore.delete(phone);
      return res.json({ success: true, message: '✅ OTP মিলেছে' });
    }

    const remaining = Math.max(0, MAX_ATTEMPTS - rec.attempts);
    return res.status(400).json({
      success: false,
      code: 'invalid_otp',
      message: '❌ OTP ভুল',
      attempts_left: remaining,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, code: 'server_error' });
  }
});

/**
 * Start
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```0
