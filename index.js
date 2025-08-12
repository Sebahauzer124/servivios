const crypto = require('crypto');
const axios = require('axios');

require('dotenv').config();

const apiKey = process.env.KUCOIN_API_KEY;
const apiSecret = process.env.KUCOIN_API_SECRET;
const passphrase = process.env.KUCOIN_API_PASSPHRASE;

const timestamp = Date.now().toString();
const method = 'GET';
const requestPath = '/api/v1/accounts';
const body = '';

const stringToSign = timestamp + method + requestPath + body;

const signature = crypto.createHmac('sha256', apiSecret).update(stringToSign).digest('base64');
const encodedPassphrase = crypto.createHmac('sha256', apiSecret).update(passphrase).digest('base64');

axios.get('https://api.kucoin.com' + requestPath, {
  headers: {
    'KC-API-KEY': apiKey,
    'KC-API-SIGN': signature,
    'KC-API-TIMESTAMP': timestamp,
    'KC-API-PASSPHRASE': encodedPassphrase,
    'KC-API-KEY-VERSION': '2',
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log(response.data);
})
.catch(error => {
  console.error(error.response ? error.response.data : error.message);
});
