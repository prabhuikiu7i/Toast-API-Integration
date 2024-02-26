const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const Client = require('pg').Client;
const app = express();
const port = 8080;

// const client = new Client({
//     host: '3.108.67.115',
//     user: 'postgres',
//     port: 5432,
//     password: 'ResPsql987',
//     database: 'postgres'
// });

// client.connect();

const merchantId = 'JH1T8ZPBVPS71';
app.use(cors());
app.use(bodyParser.json());


app.get('/', async (req, res) => {
    try {

        res.json({ success: true});
    } catch (error) {
        console.error("Error fetching items:", error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.post('/webhook', async (req, res) => {
    const webhookData = req.body;
    try {
        if (webhookData && webhookData.merchants) {
            for (const merchantId in webhookData.merchants) {
                const events = webhookData.merchants[merchantId];

                for (const event of events) {
                    const objectId = event.objectId;
                    const type = event.type;

                    if (type === 'CREATE') {

                        const itemResponse = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items/${objectId}`);
                        const item = itemResponse.data;

                        const insertQuery = {
                            text: 'INSERT INTO CloverTable (id, Item_Name, Price, Price_Type, Taxes_And_Fees, Item_Color, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                            values: [item.id, item.name, item.price, item.priceType, item.defaultTaxRates, item.isRevenue, 'clover'],
                        };

                        await client.query(insertQuery);
                    } else if (type === 'UPDATE') {

                        const itemResponse = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items/${objectId}`);
                        const item = itemResponse.data;

                        const updateQuery = {
                            text: 'UPDATE CloverTable SET Item_Name = $2, Price = $3, Price_Type = $4, Taxes_And_Fees = $5, Item_Color = $6, type = $7 WHERE id = $1',
                            values: [item.id, item.name, item.price, item.priceType, item.defaultTaxRates, item.isRevenue, 'UPDATE'],
                        };
                        await client.query(updateQuery);
                    } else if (type === 'DELETE') {

                        const deleteQuery = {
                            text: 'DELETE FROM CloverTable WHERE id = $1',
                            values: [item.id],
                        };
                        await client.query(deleteQuery);
                    }
                }
            }
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Invalid webhook data format' });
        }
    } catch (error) {
        console.error("Error handling webhook:", error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
