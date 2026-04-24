const nodemailer = require('nodemailer');
const NotificationLog = require('../models/notification.model');
const logger = require('../config/logger');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const buildEmailHtml = (type, payload) => {
  switch (type) {
    case 'order_confirmation':
      return `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#1d4ed8;">✅ Order Confirmed!</h2>
          <p>Thank you for your order. Your order <strong>#${payload.orderId}</strong> has been placed successfully.</p>
          <h3>Order Summary</h3>
          <table style="width:100%;border-collapse:collapse;">
            ${(payload.items || []).map(i => `
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:8px;">${i.name}</td>
                <td style="padding:8px;">x${i.quantity}</td>
                <td style="padding:8px;">₹${(i.price * i.quantity).toFixed(2)}</td>
              </tr>`).join('')}
          </table>
          <p><strong>Total: ₹${payload.totalAmount ? payload.totalAmount.toFixed(2) : '0.00'}</strong></p>
          <p style="color:#666;font-size:12px;">KubeCart &mdash; Your trusted online store.</p>
        </div>`;
    case 'welcome':
      return `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#1d4ed8;">👋 Welcome to KubeCart!</h2>
          <p>Hi ${payload.firstName || 'there'}, your account has been created successfully.</p>
          <p>Start exploring our products and enjoy shopping!</p>
          <p style="color:#666;font-size:12px;">KubeCart &mdash; Your trusted online store.</p>
        </div>`;
    default:
      return `<div style="font-family:sans-serif;padding:20px;"><p>${payload.message || 'Notification from KubeCart.'}</p></div>`;
  }
};

// POST /api/notifications/send
const sendNotification = async (req, res) => {
  try {
    const { to, type, subject, payload } = req.body;
    if (!to || !type || !subject) {
      return res.status(400).json({ success: false, message: 'to, type, and subject are required' });
    }

    const log = await NotificationLog.create({ to, subject, type, payload: payload || {}, status: 'pending' });

    const transporter = createTransporter();
    const htmlContent = buildEmailHtml(type, payload || {});

    try {
      await transporter.sendMail({
        from: `"KubeCart" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject,
        html: htmlContent,
      });

      log.status = 'sent';
      await log.save();
      logger.info(`Email sent to ${to} [type: ${type}]`);
      res.status(200).json({ success: true, message: 'Notification sent', data: { logId: log._id } });
    } catch (mailErr) {
      log.status = 'failed';
      log.errorMessage = mailErr.message;
      log.retries += 1;
      await log.save();
      logger.error(`Email send failed for ${to}: ${mailErr.message}`);
      res.status(500).json({ success: false, message: 'Failed to send email', data: { logId: log._id } });
    }
  } catch (err) {
    logger.error(`Send notification error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Notification service error' });
  }
};

// GET /api/notifications/logs
const getLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      NotificationLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      NotificationLog.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      data: { logs, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } },
    });
  } catch (err) {
    logger.error(`Get logs error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
};

module.exports = { sendNotification, getLogs };
