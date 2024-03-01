const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const Client = require('pg').Client;
const app = express();
const port = 8080;

const client = new Client({
    host: '127.0.0.1',
    user: 'postgres',
    port: 5432,
    password: 'ResPsql987',
    database: 'postgres'
});

client.connect();

app.use(cors());
app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
    let body = req.body;
    console.log(body);
    const webhookData = req.body;
    try {
        if (webhookData && webhookData.merchants) {
            for (const merchantId in webhookData.merchants) {
                const events = webhookData.merchants[merchantId];

                for (const event of events) {
                    let objectId = event.objectId;
                    objectId = objectId.split(":")[1];
                    objectId = objectId.toUpperCase();
                    const type = event.type;
                    const headers = {
                        'Authorization': 'Bearer 1dce5e76-15b4-5806-1202-e004adfb61f1',
                        'accept': 'application/json'
                    };

                    if (type === 'CREATE') {

                        const itemResponse = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items/${objectId}`, {
                            headers: headers
                        });
                        const item = itemResponse.data;
                        
                        const insertQuery = {
                            text: 'INSERT INTO CloverTable (id, Item_Name, Price, Price_Type, Modifier_Groups, Categories, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                            values: [item.id, item.name, item.price, item.priceType, item.modifier_groups, item.categories, 'clover'],
                        };

                        await client.query(insertQuery);
                    } else if (type === 'UPDATE') {

                        objectId = objectId.toUpperCase();

                        const itemResponse = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items/${objectId}`, {
                            headers: headers
                        });
                        const item = itemResponse.data;
                        
                        const updateQuery = {
                            text: 'UPDATE CloverTable SET Item_Name = $2, Price = $3, Price_Type = $4, Modifier_Groups = $5, Categories = $6, type = $7 WHERE id = $1',
                            values: [item.id, item.name, item.price, item.priceType, item.modifier_groups, item.categories, objectId],
                        };
                        await client.query(updateQuery);
                    } else if (type === 'DELETE') {

                        let id = objectId.toUpperCase();

                        const deleteQuery = {
                            text: `DELETE FROM CloverTable WHERE id = '${id}'`
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


app.post('/createorder', (req, res) => {
    const item = req.body;
    const options = {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer 1dce5e76-15b4-5806-1202-e004adfb61f1',
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({
            taxable: false,
            isDefault: false,
            filterCategories: false,
            isHidden: false,
            isDeleted: false,
            item
        })
    };

    fetch('https://sandbox.dev.clover.com/v3/merchants/8RH7MNPJS1JK1/orders', options)
        .then(response => response.json())
        .then(data => {
            console.log('Order created successfully:', data);
            res.status(201).json(data);
        })
        .catch(err => {
            console.error('Error creating order:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        });
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
