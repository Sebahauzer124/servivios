const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();

const apiKey = process.env.KUCOIN_API_KEY;
const apiSecret = process.env.KUCOIN_API_SECRET;
const passphrase = process.env.KUCOIN_API_PASSPHRASE;

app.get('/balances', async (req, res) => {
  try {
    const timestamp = Date.now().toString();
    const method = 'GET';
    const requestPath = '/api/v1/accounts';
    const body = '';

    const stringToSign = timestamp + method + requestPath + body;

    const signature = crypto.createHmac('sha256', apiSecret).update(stringToSign).digest('base64');
    const encodedPassphrase = crypto.createHmac('sha256', apiSecret).update(passphrase).digest('base64');

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
