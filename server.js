const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
// const { Client } = require('pg');
const app = express();
const port = 8080;

// const client = new Client({
//     host: 'localhost',
//     user: 'postgres',
//     port: 5432,
//     password: 'baseline77',
//     database: 'postgres'
// });

// client.connect();
const merchantId = 'JH1T8ZPBVPS71';
app.use(cors());
app.use(bodyParser.json());

app.get('/', async (req, res) => {
    // const webhookData = req.body;
    // console.log(webhookData, "webhookData121")
    try {
        const headers = {
            'Authorization': 'Bearer f87fbb20-020a-0326-426d-8b14244ccd34',
            'accept': 'appli`cation/json'
        };

        const response = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items`, {
            headers: headers
        });

        console.log("API Response:", response.data);
        const items = response.data.elements;

        console.log("API Response:", items);

        for (const item of items) {
            const insertQuery = {
                text: 'INSERT INTO CloverTable (id, Item_Name, Price, Price_Type, Taxes_And_Fees, Item_Color,type) VALUES ($1, $2, $3, $4, $5, $6,$7) ON CONFLICT (id) DO UPDATE SET Item_Name = $2, Price = $3, Price_Type = $4, Taxes_And_Fees = $5, Item_Color = $6,type = $7',
                values: [item.id, item.name, item.price, item.priceType, item.defaultTaxRates, item.isRevenue,'clover'],
            };

            await client.query(insertQuery);
        }

        res.json(response.data);
    } catch (error) {
        console.error("Error fetching items:", error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// app.get('/webhook', async (req, res) => {
//     try {
//         const webhookData = req.body;

//         for (const item of webhookData.items) {
//             // Example: Update existing record based on id
//             const updateQuery = {
//                 text: 'UPDATE CloverTable SET ItemName = $1, Price = $2, PriceType = $3, TaxesAndFees = $4, ItemColor = $5 WHERE id = $6',
//                 values: [item.name, item.price, item.priceType, item.defaultTaxRates, item.isRevenue, item.id],
//             };

//             // Execute the update query
//             await client.query(updateQuery);

//             // If no rows were affected (item with the given id not found), insert a new record
//             if (updateQuery.rowCount === 0) {
//                 const insertQuery = {
//                     text: 'INSERT INTO CloverTable (ItemName, Price, PriceType, TaxesAndFees, ItemColor) VALUES ($1, $2, $3, $4, $5)',
//                     values: [item.name, item.price, item.priceType, item.defaultTaxRates, item.isRevenue],
//                 };

//                 // Execute the insert query
//                 await client.query(insertQuery);
//             }
//         }

//         // Fetch and update items from the Clover API
//         const response = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items`, {
//             headers: {
//                 'Authorization': 'Bearer 553b8e99-9bf5-1dbc-4296-cd19b8af6706',
//                 'accept': 'application/json'
//             }
//         });

//         const items = response.data.elements;

//         for (const item of items) {
//             const insertQuery = {
//                 text: 'INSERT INTO CloverTable (id, ItemName, Price, PriceType, TaxesAndFees, ItemColor) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET ItemName = $2, Price = $3, PriceType = $4, TaxesAndFees = $5, ItemColor = $6',
//                 values: [item.id, item.name, item.price, item.priceType, item.defaultTaxRates, item.isRevenue],
//             };

//             await client.query(insertQuery);
//         }


//         console.log('Webhook data processed successfully:', webhookData);
//         res.json({ success: true });
//     } catch (error) {
//         console.error("Error handling webhook:", error.message);
//         res.status(500).json({ error: 'Internal Server Error' });
//     }
// });


app.post('/webhook', async (req, res) => {
    const webhookData = req.body;
    console.log(webhookData, "webhookData121");
});



app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
