const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const apiKey = process.env.KUCOIN_API_KEY;
const apiSecret = process.env.KUCOIN_API_SECRET;
const passphrase = process.env.KUCOIN_API_PASSPHRASE;

// Función para generar firma
function getSignature(timestamp, method, requestPath, body, secret) {
  const prehash = timestamp + method + requestPath + body;
  return crypto.createHmac('sha256', secret).update(prehash).digest('base64');
}

// Función para codificar passphrase
function getPassphrase(secret, passphrase) {
  return crypto.createHmac('sha256', secret).update(passphrase).digest('base64');
}

// Obtener balance de una moneda
async function getBalance(currency) {
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

  const account = response.data.data.find(acc => acc.currency === currency);
  return account ? parseFloat(account.available) : 0;
}

// 📌 Endpoint para ver balances completos
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

// 📌 Comprar con verificación de saldo USDT
app.post('/buy', async (req, res) => {
  try {
    const { symbol, price, size, type = 'limit' } = req.body;
    if (!symbol || !size || (type === 'limit' && !price)) {
      return res.status(400).json({ error: 'Faltan parámetros obligatorios (symbol, size, price para limit)' });
    }

    // Verificar saldo USDT
    const usdtBalance = await getBalance('USDT');
    const cost = parseFloat(price) * parseFloat(size);
    if (usdtBalance < cost) {
      return res.status(400).json({ error: `Saldo insuficiente en USDT. Tienes ${usdtBalance}, necesitas ${cost}` });
    }

    const timestamp = Date.now().toString();
    const method = 'POST';
    const requestPath = '/api/v1/orders';

    const body = JSON.stringify({
      clientOid: Date.now().toString(), // ID único
      symbol,
      side: 'buy',
      price,
      size,
      type
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

// 📌 Vender con verificación de saldo de la moneda
app.post('/sell', async (req, res) => {
  try {
    const { symbol, price, size, type = 'limit' } = req.body;
    if (!symbol || !size || (type === 'limit' && !price)) {
      return res.status(400).json({ error: 'Faltan parámetros obligatorios (symbol, size, price para limit)' });
    }

    // Detectar moneda base
    const baseCurrency = symbol.replace('-USDT', '');
    const assetBalance = await getBalance(baseCurrency);

    if (assetBalance < parseFloat(size)) {
      return res.status(400).json({ error: `Saldo insuficiente en ${baseCurrency}. Tienes ${assetBalance}, necesitas ${size}` });
    }

    const timestamp = Date.now().toString();
    const method = 'POST';
    const requestPath = '/api/v1/orders';

    const body = JSON.stringify({
      clientOid: Date.now().toString(), // ID único
      symbol,
      side: 'sell',
      price,
      size,
      type
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
