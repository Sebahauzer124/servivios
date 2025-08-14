const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// --- API Keys ---
const apiKey = process.env.KUCOIN_API_KEY;
const apiSecret = process.env.KUCOIN_API_SECRET;
const passphrase = process.env.KUCOIN_API_PASSPHRASE;

// --- Funciones auxiliares ---
function getSignature(timestamp, method, requestPath, body, secret) {
    const prehash = timestamp + method + requestPath + body;
    return crypto.createHmac('sha256', secret).update(prehash).digest('base64');
}

function getPassphrase(secret, passphrase) {
    return crypto.createHmac('sha256', secret).update(passphrase).digest('base64');
}

async function kucoinRequest(method, requestPath, body = '') {
    const timestamp = Date.now().toString();
    const signature = getSignature(timestamp, method, requestPath, body, apiSecret);
    const encodedPassphrase = getPassphrase(apiSecret, passphrase);

    const options = {
        method,
        url: 'https://api.kucoin.com' + requestPath,
        headers: {
            'KC-API-KEY': apiKey,
            'KC-API-SIGN': signature,
            'KC-API-TIMESTAMP': timestamp,
            'KC-API-PASSPHRASE': encodedPassphrase,
            'KC-API-KEY-VERSION': '2',
            'Content-Type': 'application/json'
        }
    };

    if (method === 'GET') return axios(options);
    options.data = body;
    return axios(options);
}

// --- Obtener saldo de trading (tipo 'trade') ---
async function getTradeBalance(currency) {
    const response = await kucoinRequest('GET', '/api/v1/accounts');
    const account = response.data.data.find(acc => acc.currency === currency && acc.type === 'trade');
    return account ? parseFloat(account.available) : 0;
}

// --- Obtener info de un símbolo ---
async function getSymbolInfo(symbol) {
    const response = await kucoinRequest('GET', '/api/v1/symbols');
    return response.data.data.find(s => s.symbol === symbol);
}

// --- Redondear al incremento correcto ---
function roundToIncrement(value, increment) {
    const factor = 1 / parseFloat(increment);
    return Math.floor(value * factor + 1e-12) / factor;
}

// --- Contar decimales de un número ---
function countDecimals(num) {
    if (Math.floor(num) === num) return 0;
    return num.toString().split('.')[1]?.length || 0;
}

// --- Endpoints ---

// Obtener balances
app.get('/balances', async (req, res) => {
    try {
        const response = await kucoinRequest('GET', '/api/v1/accounts');
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

// Comprar
app.post('/buy', async (req, res) => {
    try {
        let { symbol, price, size, type = 'limit' } = req.body;

        if (!symbol || !size || (type === 'limit' && !price)) {
            return res.status(400).json({ error: 'Faltan parámetros obligatorios (symbol, size, price para limit)' });
        }

        symbol = symbol.toUpperCase();
        const symbolInfo = await getSymbolInfo(symbol);
        if (!symbolInfo) return res.status(400).json({ error: `No se encontró info del símbolo ${symbol}` });

        price = roundToIncrement(price, symbolInfo.priceIncrement);

        // Redondeamos tamaño al incremento y aseguramos mínimo
        size = Math.max(parseFloat(symbolInfo.baseMinSize), parseFloat(size));
        size = roundToIncrement(size, symbolInfo.baseIncrement);

        // Validar saldo USDT
        const usdtBalance = await getTradeBalance(symbolInfo.quoteCurrency);
        const cost = parseFloat(price) * parseFloat(size);
        if (usdtBalance < cost) {
            return res.status(400).json({ error: `Saldo insuficiente en ${symbolInfo.quoteCurrency}. Tienes ${usdtBalance}, necesitas ${cost}` });
        }

        const body = JSON.stringify({
            clientOid: Date.now().toString(),
            symbol,
            side: 'buy',
            price,
            size,
            type
        });

        const response = await kucoinRequest('POST', '/api/v1/orders', body);
        res.json(response.data);

    } catch (error) {
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

// Vender
app.post('/sell', async (req, res) => {
    try {
        let { symbol, price, size, type = 'limit' } = req.body;

        if (!symbol || !size || (type === 'limit' && !price)) {
            return res.status(400).json({ error: 'Faltan parámetros obligatorios (symbol, size, price para limit)' });
        }

        symbol = symbol.toUpperCase();
        const symbolInfo = await getSymbolInfo(symbol);
        if (!symbolInfo) return res.status(400).json({ error: `No se encontró info del símbolo ${symbol}` });

        price = roundToIncrement(price, symbolInfo.priceIncrement);

        size = Math.max(parseFloat(symbolInfo.baseMinSize), parseFloat(size));
        size = roundToIncrement(size, symbolInfo.baseIncrement);

        const baseCurrency = symbol.split('-')[0];
        const assetBalance = await getTradeBalance(baseCurrency);
        if (assetBalance < parseFloat(size)) {
            return res.status(400).json({ error: `Saldo insuficiente en ${baseCurrency}. Tienes ${assetBalance}, necesitas ${size}` });
        }

        const body = JSON.stringify({
            clientOid: Date.now().toString(),
            symbol,
            side: 'sell',
            price,
            size,
            type
        });

        const response = await kucoinRequest('POST', '/api/v1/orders', body);
        res.json(response.data);

    } catch (error) {
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

// --- Iniciar servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
