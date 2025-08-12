const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json()); // para leer JSON en el body

const apiKey = process.env.KUCOIN_API_KEY;
const apiSecret = process.env.KUCOIN_API_SECRET;
const passphrase = process.env.KUCOIN_API_PASSPHRASE;

function getSignature(timestamp, method, requestPath, body, secret) {
  const prehash = timestamp + method + requestPath + body;
  return crypto.createHmac('sha256', secret).update(prehash).digest('base64');
}

function getPassphrase(secret, passphrase) {
  return crypto.createHmac('sha256', secret).update(passphrase).digest('base64');
}

app.get('/balances', async (req, res) => {
  try {
    const timestamp = Date.now().toString();
    const method = 'GET';
    const requestPath = '/api/v1/accounts';
    const body = '';

    const signature = getSignature(timestamp, method, requestPath, body, apiSecret);
    const encodedPassphrase = getPassphrase(apiSecret, passphrase);

    const response = await axios.get('https://api.kucoin.com' + requestPath, {
      headers: {
        'KC-API-KEY': apiKey,
        'KC-API-SIGN': signature,
        'KC-API-TIMESTAMP': timestamp,
        'KC-API-PASSPHRASE': encodedPassphrase,
        'KC-API-KEY-VERSION': '2',
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response ? error.response.data : error.message });
  }
});

app.post('/buy', async (req, res) => {
  try {
    const { symbol, side, price, size, type = 'limit' } = req.body;

    if (!symbol || !side || !size || (type === 'limit' && !price)) {
      return res.status(400).json({ error: 'Faltan parámetros obligatorios (symbol, side, size, price para limit)' });
    }

    const timestamp = Date.now().toString();
    const method = 'POST';
    const requestPath = '/api/v1/orders';

    const body = JSON.stringify({
      symbol,
      side,
      price,
      size,
      type,
    });

    const signature = getSignature(timestamp, method, requestPath, body, apiSecret);
    const encodedPassphrase = getPassphrase(apiSecret, passphrase);

    const response = await axios.post('https://api.kucoin.com' + requestPath, body, {
      headers: {
        'KC-API-KEY': apiKey,
        'KC-API-SIGN': signature,
        'KC-API-TIMESTAMP': timestamp,
        'KC-API-PASSPHRASE': encodedPassphrase,
        'KC-API-KEY-VERSION': '2',
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response ? error.response.data : error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
