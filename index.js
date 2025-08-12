const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.json());

app.post('/sign', (req, res) => {
  const { query, secret } = req.body;
  if (!query || !secret) {
    return res.status(400).json({ error: 'Faltan query o secret' });
  }
  const signature = crypto.createHmac('sha256', secret).update(query).digest('hex');
  res.json({ signature });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Microservicio corriendo en puerto ${PORT}`);
});
