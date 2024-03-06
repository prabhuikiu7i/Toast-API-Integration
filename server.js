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

app.post('/send-data', async (req, res) => {
    let body = req.body;
    console.log(body);
    const webhookData = req.body;
    try {
        if (webhookData && webhookData.merchants) {
            for (const merchantId in webhookData.merchants) {
                const headers = {
                    'Authorization': 'Bearer 1dce5e76-15b4-5806-1202-e004adfb61f1',
                    'accept': 'application/json'
                };

                const itemResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/items?expand=categories,modifierGroups`, {
                    headers: headers
                });
                const item = itemResponse.data.elements;

                item.forEach(async item => {
                    const modifierGroupName = item.modifierGroups.elements.map(group => group.name).join(', ');
                    const categoryName = item.categories.elements.map(category => category.name).join(', ');

                    const insertQuery = {
                        text: 'INSERT INTO CloverTable (id, Item_Name, Price, Price_Type, Modifier_Groups, Categories, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                        values: [item.id, item.name, item.price, item.priceType, modifierGroupName, categoryName, 'clover'],
                    };
                    await client.query(insertQuery);
                });

            }
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Invalid webhook data format' });
        }
    } catch (error) {

    }
});


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

                        const query = {
                            text: 'SELECT id FROM CloverTable',
                        };

                        const result = await client.query(query);

                        const databaseIds = result.rows.map(row => row.id);

                        const cloverResponse = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items`, {
                            headers: headers
                        });

                        const cloverIds = cloverResponse.data.elements.map(item => item.id);

                        const missingIds = cloverIds.filter(id => !databaseIds.includes(id));

                        for (const missingId of missingIds) {
                            const missingItemResponse = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items/${missingId}`, {
                                headers: headers
                            });

                            const missingItem = missingItemResponse.data;

                            const insertQuery = {
                                text: 'INSERT INTO CloverTable (id, Item_Name, Price, Price_Type, Modifier_Groups, Categories, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                                values: [missingItem.id, missingItem.name, missingItem.price, missingItem.priceType, missingItem.modifier_groups, missingItem.categories, 'clover'],
                            };

                            await client.query(insertQuery);
                        }

                    } else if (type === 'UPDATE') {
                        let categoryResult = [];
                        let modifierResult = [];

                        objectId = objectId.toUpperCase();

                        const itemResponse = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items/${objectId}`, {
                            headers: headers
                        });

                        const item = itemResponse.data;

                        const categories = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/categories`, {
                            headers: headers
                        });

                        const categoriesdata = categories.data.elements;
                        if (categoriesdata) {
                            for (let ele of categoriesdata) {
                                let categoryNameResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/categories/${ele.id}`, {
                                    headers: headers
                                });

                                let categoryName = categoryNameResponse.data.name;

                                let categoriesItemResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/categories/${ele.id}/items`, {
                                    headers: headers
                                });

                                let categoriesItem = categoriesItemResponse.data.elements;

                                let matchedItem = categoriesItem.find(x => x.id === item.id);
                                if (matchedItem) {
                                    const itemResponse = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items/${matchedItem.id}`, {
                                        headers: headers
                                    });
                                    const categoryObject = {
                                        categoryName: categoryName,
                                        items: itemResponse.data
                                    };
                                    categoryResult.push(categoryObject);
                                } else {
                                    console.log("No matching item found");
                                }
                            }
                            const itemData = categoryResult[0]?.items;
                            const category = { name: categoryResult[0]?.categoryName };
                            const catUpdateQuery = {
                                text: 'UPDATE CloverTable SET',
                                values: [itemData.id],
                            };

                            const catSetClauses = [];

                            if (itemData.name) {
                                catSetClauses.push('Item_Name = $' + (catSetClauses.length + 2));
                                catUpdateQuery.values.push(itemData.name);
                            }

                            if (itemData.price) {
                                catSetClauses.push('Price = $' + (catSetClauses.length + 2));
                                catUpdateQuery.values.push(itemData.price);
                            }

                            if (itemData.priceType) {
                                catSetClauses.push('Price_Type = $' + (catSetClauses.length + 2));
                                catUpdateQuery.values.push(itemData.priceType);
                            }

                            if (category.name) {
                                catSetClauses.push('Categories = $' + (catSetClauses.length + 2));
                                catUpdateQuery.values.push(category.name);
                            }

                            catUpdateQuery.text += ' ' + catSetClauses.join(', ') + ' WHERE id = $1';
                            await client.query(catUpdateQuery);

                        }

                        const modifier_groups = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups`, {
                            headers: headers
                        });

                        const modifierdata = modifier_groups.data.elements;

                        if (modifierdata) {
                            for (let ele of modifierdata) {
                                let modifierNameResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}`, {
                                    headers: headers
                                });

                                let modifierName = modifierNameResponse.data.name;
                                console.log(modifierName, 'djkshgsuiah')

                                let modifierItemResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}/items`, {
                                    headers: headers
                                });

                                let modifiersItem = modifierItemResponse.data.elements;
                                console.log(modifiersItem, 'dfhhgrhf')

                                let matchedItem = modifiersItem.find((x) => x?.id === item?.id);
                                if (matchedItem) {
                                    const itemResponse = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items/${matchedItem.id}`, {
                                        headers: headers
                                    });
                                    const modifierObject = {
                                        modifierName: modifierName,
                                        data: itemResponse.data
                                    };
                                    modifierResult.push(modifierObject);
                                } else {
                                    console.log("No matching item found");
                                }
                            }
                            const itemData = modifierResult[0]?.data;
                            const modifier = { name: modifierResult[0]?.modifierName };
                            const updateQuery = {
                                text: 'UPDATE CloverTable SET',
                                values: [itemData.id],
                            };

                            const setClauses = [];

                            if (itemData.name) {
                                setClauses.push('Item_Name = $' + (setClauses.length + 2));
                                updateQuery.values.push(itemData.name);
                            }

                            if (itemData.price) {
                                setClauses.push('Price = $' + (setClauses.length + 2));
                                updateQuery.values.push(itemData.price);
                            }

                            if (itemData.priceType) {
                                setClauses.push('Price_Type = $' + (setClauses.length + 2));
                                updateQuery.values.push(itemData.priceType);
                            }

                            if (modifier.name) {
                                setClauses.push('Modifier_Groups = $' + (setClauses.length + 2));
                                updateQuery.values.push(modifier.name);
                            }

                            updateQuery.text += ' ' + setClauses.join(', ') + ' WHERE id = $1';
                            await client.query(updateQuery);
                        }

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
