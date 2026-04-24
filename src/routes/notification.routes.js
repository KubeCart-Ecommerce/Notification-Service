const express = require('express');
const router = express.Router();
const { sendNotification, getLogs } = require('../controllers/notification.controller');

// Internal service-to-service (no JWT) — protected by network policy in K8s
router.post('/send', sendNotification);
router.get('/logs', getLogs);

module.exports = router;
