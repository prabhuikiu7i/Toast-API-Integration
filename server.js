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

                                    const modifierData = item.modifierGroups.elements;

                                    for (let data of modifierData) {
                                        if (data.modifierIds) {
                                            let id = data.modifierIds
                                            const itemModifier = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${data.id}/modifiers/${id}`, {
                                                headers: headers,
                                                timeout: 13000
                                            });

                                            let modifierResult = itemModifier.data;

                                            const modifierQueryVariant = {
                                                text: 'UPDATE VariantTable SET modifier_name = $2, modifier_price = $3 WHERE  variant_id = $1',
                                                values: [item.id, modifierResult.name, modifierResult.price],
                                            };

                                            await client.query(modifierQueryVariant);
                                        }

                                    }

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
                                    let modifierGData = item.modifierGroups.elements;

                                    for (let key of modifierGData) {

                                        if (key.modifierIds) {
                                            let id = key.modifierIds
                                            const itemModifier = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${key.id}/modifiers/${id}`, {
                                                headers: headers,
                                                timeout: 13000
                                            });

                                            let modifierResult = itemModifier.data;

                                            const modifierQueryVariant = {
                                                text: 'UPDATE CloverTable SET modifier_name = $2, modifier_price = $3 WHERE  id = $1',
                                                values: [item.id, modifierResult.name, modifierResult.price],
                                            };

                                            await client.query(modifierQueryVariant);
                                        }

                                    }
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
                        let CloverCategoryResult = [];
                        let modifierResult = [];
                        let CloverModifierResult = [];

                        const itemResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/items?expand=categories,modifierGroups`, {
                            headers: headers
                        });

                        const items = itemResponse.data.elements;
                        for (let element of items) {
                            if (element.itemGroup) {
                                const updateQueryVariant = {
                                    text: 'UPDATE VariantTable SET variant_name = $2, price = $3 WHERE  variant_id = $1',
                                    values: [element.id, element.name, element.price],
                                };

                                await client.query(updateQueryVariant);

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

                                        let matchedItem = modifiersItem.find((x) => x?.id === element?.id);
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

                                        for (let ele of modifierdata) {
                                            let id = ele.modifierIds
                                            let modifierResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}/modifiers`, {
                                                headers: headers,
                                                timeout: 25000,
                                            });

                                            let modifierArr = modifierResponse.data.elements;

                                            if (modifierArr.length == 0) {

                                                let modifiedObject = {
                                                    name: null,
                                                    price: null,
                                                };

                                                modifierResult.push(modifiedObject);

                                            } else {
                                                let modifyResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}/modifiers/${id}`, {
                                                    headers: headers,
                                                    timeout: 25000,
                                                });

                                                let modifiers = modifyResponse.data;

                                                let modifiedObject = {
                                                    name: modifiers.name,
                                                    price: modifiers.price
                                                };

                                                modifierResult.push(modifiedObject);
                                            }
                                        }

                                        const itemData = modifierResult[0]?.data;
                                        const modifier = { name: modifierResult[0]?.modifierName };
                                        const ItemGroupmodifyName = { name: modifierResult[1]?.name };
                                        const ItemGroupPrice = { price: modifierResult[1]?.price };

                                        const updateQuery = {
                                            text: 'UPDATE VariantTable SET variant_name = $2, price = $3, modifier_groups = $4, modifier_name = $5, modifier_price = $6 WHERE variant_id = $1',
                                            values: [itemData.id, itemData.name, itemData.price, modifier.name, ItemGroupmodifyName.name || '', ItemGroupPrice.price || ''],
                                        };

                                        await client.query(updateQuery);
                                    }
                                }

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

                                        let matchedItem = categoriesItem.find(x => x.id === element.id);
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
                                    if (itemData) {
                                        const catUpdateQuery = {
                                            text: 'UPDATE VariantTable SET variant_name = $2, price = $3,categories = $4 WHERE  variant_id = $1',
                                            values: [itemData.id, itemData.name, itemData.price, category.name],
                                        };
                                        await client.query(catUpdateQuery);
                                    }
                                }
                            } else {
                                const modifier_groups = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups`, {
                                    headers: headers,
                                    timeout: 15000,
                                });
                                console.log(modifier_groups, "modifier_groups");
                                const modifierdata = modifier_groups?.data?.elements;

                                if (modifierdata) {
                                    for (let ele of modifierdata) {
                                        let modifierNameResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}`, {
                                            headers: headers,
                                            timeout: 12000,
                                        });

                                        let modifierName = modifierNameResponse?.data?.name;

                                        let modifierItemResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}/items`, {
                                            headers: headers,
                                            timeout: 13000,
                                        });

                                        let modifiersItem = modifierItemResponse?.data?.elements;

                                        let matchedItem = modifiersItem.find((x) => x?.id === element?.id);
                                        if (matchedItem) {
                                            const itemResponse = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items/${matchedItem.id}`, {
                                                headers: headers,
                                                timeout: 14000
                                            });
                                            const modifierObject = {
                                                modifierName: modifierName,
                                                data: itemResponse.data
                                            };
                                            CloverModifierResult.push(modifierObject);
                                        } else {
                                            console.log("No matching item found");
                                        }

                                        for (let ele of modifierdata) {
                                            let id = ele.modifierIds;

                                            let modData = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}/modifiers`, {
                                                headers: headers,
                                                timeout: 15000,
                                            });

                                            let res = modData.data;

                                            if (res.elements.length == 0) {

                                                let modifyObject = {
                                                    name: null,
                                                    price: null
                                                };
                                                CloverModifierResult.push(modifyObject);

                                            } else {
                                                let modify = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}/modifiers/${id}`, {
                                                    headers: headers,
                                                    timeout: 15000,
                                                });

                                                let modifyObject = {
                                                    name: modify.data.name,
                                                    price: modify.data.price
                                                };
                                                CloverModifierResult.push(modifyObject);
                                            }
                                        }
                                    }

                                    const itemData = CloverModifierResult[0]?.data;
                                    const modifier = { name: CloverModifierResult[0]?.modifierName };
                                    const modifyName = { name: CloverModifierResult[1]?.name };
                                    const Price = { price: CloverModifierResult[1]?.price };

                                    const updateQuery = {
                                        text: 'UPDATE CloverTable SET',
                                        values: [itemData.id],
                                    };

                                    const setClauses = [];

                                    if (itemData?.name) {
                                        setClauses.push('Item_Name = $' + (setClauses.length + 2));
                                        updateQuery.values.push(itemData.name);
                                    }

                                    if (itemData?.price) {
                                        setClauses.push('Price = $' + (setClauses.length + 2));
                                        updateQuery.values.push(itemData.price);
                                    }

                                    if (itemData?.priceType) {
                                        setClauses.push('Price_Type = $' + (setClauses.length + 2));
                                        updateQuery.values.push(itemData.priceType);
                                    }

                                    if (modifier?.name) {
                                        setClauses.push('Modifier_Groups = $' + (setClauses.length + 2));
                                        updateQuery.values.push(modifier.name);
                                    }

                                    if (modifyName?.name) {
                                        setClauses.push('modifier_name = $' + (setClauses.length + 2));
                                        updateQuery.values.push(modifyName.name);
                                    } else {
                                        setClauses.push('modifier_name = $' + (setClauses.length + 2));
                                        updateQuery.values.push('');
                                    }

                                    if (Price?.price) {
                                        setClauses.push('modifier_price = $' + (setClauses.length + 2));
                                        updateQuery.values.push(Price.price);
                                    } else {
                                        setClauses.push('modifier_price = $' + (setClauses.length + 2));
                                        updateQuery.values.push('');
                                    }

                                    updateQuery.text += ' ' + setClauses.join(', ') + ' WHERE id = $1';
                                    await client.query(updateQuery);
                                }


                                const categories = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/categories`, {
                                    headers: headers
                                });

                                const categoriesdata = categories.data.elements;
                                if (categoriesdata) {
                                    for (let ele of categoriesdata) {
                                        let categoryNameResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/categories/${ele.id}`, {
                                            headers: headers,
                                            timeout: 15000
                                        });

                                        let categoryName = categoryNameResponse.data.name;

                                        let categoriesItemResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/categories/${ele.id}/items`, {
                                            headers: headers,
                                            timeout: 30000
                                        });

                                        let categoriesItem = categoriesItemResponse.data.elements;

                                        let matchedItem = categoriesItem.find(x => x.id === element.id);
                                        if (matchedItem) {
                                            const itemResponse = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items/${matchedItem.id}`, {
                                                headers: headers,
                                                timeout: 17000
                                            });
                                            const categoryObject = {
                                                categoryName: categoryName,
                                                items: itemResponse.data
                                            };
                                            CloverCategoryResult.push(categoryObject);
                                        } else {
                                            console.log("No matching item found");
                                        }
                                    }
                                    const itemData = CloverCategoryResult[0]?.items;
                                    const category = { name: CloverCategoryResult[0]?.categoryName };
                                    if (itemData) {
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
                                }

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
    const createOrderOptions = {
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

    // Step 1: Create an Order
    fetch('https://sandbox.dev.clover.com/v3/merchants/8RH7MNPJS1JK1/orders', createOrderOptions)
        .then(response => response.json())
        .then(async orderData => {
            const orderId = orderData.id;
            const addLineItemOptions = {
                method: 'POST',
                headers: createOrderOptions.headers,
                body: JSON.stringify({
                    "item": {
                        "id": "3EKJ4XRNY73C0"
                    },
                    "printed": "false",
                    "exchanged": "false",
                    "refunded": "false",
                    "refund": {
                        "transactionInfo": {
                            "isTokenBasedTx": "false",
                            "emergencyFlag": "false"
                        }
                    },
                    "isRevenue": "false"
                })
            };

            return fetch(`https://sandbox.dev.clover.com/v3/merchants/8RH7MNPJS1JK1/orders/${orderId}/line_items`, addLineItemOptions);
        })
        .then(response => response.json())
        .then(async lineData => {
            console.log('Order created successfully:', lineData);

            let orderRes = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/8RH7MNPJS1JK1/orders/${lineData.orderRef.id}`, {
                headers: createOrderOptions.headers
            });
            let orderData = orderRes.data;

            const orderInsertQuery = {
                text: 'INSERT INTO OrderTable (order_id, item_id, item_name, price, status) VALUES ($1, $2, $3, $4, $5)',
                values: [lineData.orderRef.id, lineData.item.id, lineData.name, lineData.price, orderData.state],
            };
            await client.query(orderInsertQuery);


            res.status(201).json(lineData);
            res.json({ success: true });
        })
        .catch(err => {
            console.error('Error creating order:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        });
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
