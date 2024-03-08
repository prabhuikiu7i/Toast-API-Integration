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
                const items = itemResponse.data.elements;

                for (const item of items) {
                    // Check if the item already exists in the database
                    const checkQuery = {
                        text: 'SELECT id FROM CloverTable WHERE id = $1',
                        values: [item.id],
                    };
                    const checkResult = await client.query(checkQuery);

                    if (checkResult.rows.length === 0) {
                        // Item doesn't exist, insert into the database
                        const modifierGroupName = item.modifierGroups.elements.map(group => group.name).join(', ');
                        const categoryName = item.categories.elements.map(category => category.name).join(', ');

                        const insertQuery = {
                            text: 'INSERT INTO CloverTable (id, Item_Name, Price, Price_Type, Modifier_Groups, Categories, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                            values: [item.id, item.name, item.price, item.priceType, modifierGroupName, categoryName, 'clover'],
                        };
                        await client.query(insertQuery);
                    }
                }
            }
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Invalid webhook data format' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
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

                        for (const merchantId in webhookData.merchants) {
                            const headers = {
                                'Authorization': 'Bearer acbaa9a9-93cc-fd85-5319-453946e0feb7',
                                'accept': 'application/json'
                            };

                            const itemResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/items?expand=categories,modifierGroups`, {
                                headers: headers
                            });

                            const items = itemResponse.data.elements;

                            for (const item of items) {
                                if (item.itemGroup) {
                                    const itemGroupId = item.itemGroup.id;
                                    const itemGroupResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/item_groups/${itemGroupId}?expand=items`, {
                                        headers: headers
                                    });

                                    const itemGroupName = itemGroupResponse.data.name;

                                    const itemGroupItems = itemGroupResponse.data.items.elements;
                                    const queryVariant = {
                                        text: 'SELECT variant_id FROM VariantTable',
                                    };

                                    const resultVariant = await client.query(queryVariant);

                                    const databaseVariantIds = resultVariant.rows.map(row => row.variant_id);

                                    for (const groupItem of itemGroupItems) {
                                        if (!databaseVariantIds.includes(groupItem.id)) {
                                            const attributeName = groupItem.options.elements.map(x => x.name).join(', ');
                                            const modifierGroupName = groupItem.modifierGroups.elements.map(group => group.name).join(', ');
                                            const categoryName = groupItem.categories.elements.map(category => category.name).join(', ');

                                            const insertQueryVariant = {
                                                text: 'INSERT INTO VariantTable (item_id,variant_id, name, variant_name, attributes, price, modifier_groups, categories) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                                                values: [item.id, groupItem.id, itemGroupName, groupItem.name, attributeName, groupItem.price, modifierGroupName, categoryName],
                                            };

                                            await client.query(insertQueryVariant);
                                        }

                                    }
                                } else {
                                    if (!databaseIds.includes(item.id)) {
                                        const modifierGroupName = item.modifierGroups.elements.map(group => group.name).join(', ');
                                        const categoryName = item.categories.elements.map(category => category.name).join(', ');

                                        const insertQuery = {
                                            text: 'INSERT INTO CloverTable (id, Item_Name, Price, Price_Type, Modifier_Groups, Categories, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                                            values: [item.id, item.name, item.price, item.priceType, modifierGroupName, categoryName, 'clover'],
                                        };

                                        await client.query(insertQuery);
                                    }
                                }
                            }
                        }

                    } else if (type === 'UPDATE') {
                        let categoryResult = [];
                        let modifierResult = [];

                        objectId = objectId.toUpperCase();

                        const itemResponse = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items/${objectId}`, {
                            headers: headers
                        });

                        const item = itemResponse.data;
                        console.log(item, 'gasjhdguah')

                        if (item.itemGroup) {
                            const updateQueryVariant = {
                                text: 'UPDATE VariantTable SET variant_name = $2, price = $3 WHERE  variant_id = $1',
                                values: [item.id, item.name, item.price],
                            };

                            await client.query(updateQueryVariant);


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
                                    text: 'UPDATE VariantTable SET variant_name = $2, price = $3,categories = $4 WHERE  variant_id = $1',
                                    values: [item.id, item.name, item.price, category.name],
                                };
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

                                    let modifierItemResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}/items`, {
                                        headers: headers
                                    });

                                    let modifiersItem = modifierItemResponse.data.elements;

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
                                    text: 'UPDATE VariantTable SET variant_name = $2, price = $3,modifier_groups = $4 WHERE  variant_id = $1',
                                    values: [item.id, item.name, item.price, modifier.name],
                                };
                                await client.query(updateQuery);
                            }

                        } else {

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

                                    let modifierItemResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}/items`, {
                                        headers: headers
                                    });

                                    let modifiersItem = modifierItemResponse.data.elements;

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

                        }

                    } else if (type === 'DELETE') {

                        let id = objectId.toUpperCase();

                        const deleteQuery = {
                            text: `DELETE FROM CloverTable WHERE id = '${id}'`
                        };
                        await client.query(deleteQuery);

                        const VariantdeleteQuery = {
                            text: `DELETE FROM VariantTable WHERE variant_id = '${id}'`
                        };
                        await client.query(VariantdeleteQuery);
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
            'order-Type': {
                "taxable": false,
                "isDefault": false,
                "filterCategories": false,
                "isHidden": false,
                "isDeleted": false,
                "items": item
            },
            state: "open"
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
