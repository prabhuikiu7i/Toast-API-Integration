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
                        const query = {
                            text: 'SELECT id FROM CloverTable',
                        };

                        const result = await client.query(query);

                        const databaseIds = result.rows.map(row => row.id);

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
                                if (item.itemGroup) {
                                    const itemGroupId = item.itemGroup.id;
                                    const itemGroupResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/item_groups/${itemGroupId}?expand=items`, {
                                        headers: headers,
                                    });

                                    const modifierData = item.modifierGroups.elements;

                                    for (let data of modifierData) {
                                        if (data.modifierIds) {
                                            let modifierIds = data.modifierIds.split(',');
                                            for (let id of modifierIds) {
                                                const itemModifier = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${data.id}/modifiers/${id}`, {
                                                    headers: headers,
                                                    timeout: 20000
                                                });

                                                let modifierResult = itemModifier.data;
                                                const priceInCents = modifierResult.price / 100;

                                                let query = {
                                                    text: 'SELECT modifier_id FROM ModifierTable',
                                                }

                                                const resultQuery = await client.query(query);

                                                const databaseModifierIds = resultQuery.rows.map(row => row.modifier_id);


                                                if (!databaseModifierIds.includes(modifierResult.id)) {
                                                    const modifierQueryVariant = {
                                                        text: 'INSERT INTO ModifierTable (item_id, item_name, modifier_group_id, modifier_group_name, modifier_name, modifier_price, modifier_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                                                        values: [item.id, item.name, data.id, data.name, modifierResult.name, priceInCents, modifierResult.id],
                                                    };

                                                    await client.query(modifierQueryVariant);

                                                }
                                            }
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
                                            let price = groupItem.price / 100;

                                            const insertQueryVariant = {
                                                text: 'INSERT INTO VariantTable (item_id,variant_id, name, variant_name, attributes, price, modifier_groups, categories) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                                                values: [item.id, groupItem.id, itemGroupName, groupItem.name, attributeName, price, modifierGroupName, categoryName],
                                            };

                                            await client.query(insertQueryVariant);
                                        }
                                    }
                                } else {

                                    const modifier_groups = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups`, {
                                        headers: headers
                                    });

                                    //const modifierGData = modifier_groups.data.elements;
                                    const modifierGData = item.modifierGroups.elements;

                                    for (let key of modifierGData) {

                                        if (key.modifierIds) {
                                            const modifierIds = key.modifierIds.split(',');
                                            for (let mid of modifierIds) {
                                                const itemModifier = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${key.id}/modifiers/${mid}`, {
                                                    headers: headers,
                                                    timeout: 25000
                                                });

                                                let modifierResult = itemModifier.data;
                                                const priceInCents = modifierResult.price / 100;

                                                let query = {
                                                    text: 'SELECT modifier_id FROM ModifierTable',
                                                }

                                                const resultQuery = await client.query(query);

                                                const databaseModifierIds = resultQuery.rows.map(row => row.modifier_id);

                                                if (!databaseModifierIds.includes(modifierResult.id)) {
                                                    const modifierQueryVariant = {
                                                        text: 'INSERT INTO ModifierTable (item_id, item_name, modifier_group_id, modifier_group_name, modifier_name, modifier_price, modifier_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                                                        values: [item.id, item.name, key.id, key.name, modifierResult.name, priceInCents, modifierResult.id],
                                                    };

                                                    await client.query(modifierQueryVariant);

                                                }
                                            }

                                        }
                                    }
                                    if (!databaseIds.includes(item.id)) {
                                        const modifierGroupName = item.modifierGroups.elements.map(group => group.name).join(', ');
                                        const categoryName = item.categories.elements.map(category => category.name).join(', ');
                                        let price = item.price / 100;

                                        const insertQuery = {
                                            text: 'INSERT INTO CloverTable (id, Item_Name, Price, Price_Type, Modifier_Groups, Categories, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                                            values: [item.id, item.name, price, item.priceType, modifierGroupName, categoryName, 'clover'],
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
                            headers: headers,
                            timeout: 40000
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
                                            let modifierid = ele.modifierIds.split(',');
                                            for (let id of modifierid) {
                                                let modifierResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}/modifiers`, {
                                                    headers: headers,
                                                    timeout: 30000,
                                                });

                                                let modifierArr = modifierResponse.data.elements;
                                                if (id == objectId) {
                                                    if (modifierArr.length > 0) {
                                                        let modifyResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}/modifiers/${id}`, {
                                                            headers: headers,
                                                            timeout: 25000,
                                                        });

                                                        let modifiers = modifyResponse.data;
                                                        let price = modifiers.price / 100;

                                                        const updateQuery = {
                                                            text: 'UPDATE ModifierTable SET modifier_name = $2, modifier_price = $3 WHERE modifier_id = $1',
                                                            values: [modifiers.id, modifiers.name, price],
                                                        };

                                                        await client.query(updateQuery);
                                                    }
                                                }
                                            }
                                        }

                                        const itemData = modifierResult[0]?.data;
                                        const modifier = { name: modifierResult[0]?.modifierName };
                                        let price = itemData.price / 100;

                                        const updateQuery = {
                                            text: 'UPDATE VariantTable SET variant_name = $2, price = $3, modifier_groups = $4 WHERE variant_id = $1',
                                            values: [itemData.id, itemData.name, price, modifier.name],
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
                                });
                                const modifierdata = modifier_groups?.data?.elements;

                                if (modifierdata) {
                                    for (let ele of modifierdata) {
                                        let modifierNameResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}`, {
                                            headers: headers,
                                        });

                                        let modifierName = modifierNameResponse?.data?.name;

                                        let modifierItemResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}/items`, {
                                            headers: headers,
                                        });

                                        let modifiersItem = modifierItemResponse?.data?.elements;

                                        let matchedItem = modifiersItem.find((x) => x?.id === element?.id);
                                        if (matchedItem) {
                                            const itemResponse = await axios.get(`https://apisandbox.dev.clover.com/v3/merchants/${merchantId}/items/${matchedItem.id}`, {
                                                headers: headers,
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
                                            if (ele.modifierIds) {
                                                let modifierid = ele.modifierIds.split(',');
                                                for (let id of modifierid) {
                                                    if (id == objectId) {
                                                        let modifyResponse = await axios.get(`https://sandbox.dev.clover.com/v3/merchants/${merchantId}/modifier_groups/${ele.id}/modifiers/${id}`, {
                                                            headers: headers,
                                                        });

                                                        let modifiers = modifyResponse.data;
                                                        let price = modifiers.price / 100;

                                                        const updateQuery = {
                                                            text: 'UPDATE ModifierTable SET modifier_name = $2, modifier_price = $3 WHERE modifier_id = $1',
                                                            values: [modifiers.id, modifiers.name, price],
                                                        };

                                                        await client.query(updateQuery);
                                                    }
                                                }
                                            }

                                        }
                                    }

                                    const itemData = CloverModifierResult[0]?.data;
                                    const modifier = { name: CloverModifierResult[0]?.modifierName };

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
                                        let price = itemData.price / 100;
                                        setClauses.push('Price = $' + (setClauses.length + 2));
                                        updateQuery.values.push(price);
                                    }

                                    if (itemData?.priceType) {
                                        setClauses.push('Price_Type = $' + (setClauses.length + 2));
                                        updateQuery.values.push(itemData.priceType);
                                    }

                                    if (modifier?.name) {
                                        setClauses.push('Modifier_Groups = $' + (setClauses.length + 2));
                                        updateQuery.values.push(modifier.name);
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

                        const deleteModifierQuery = {
                            text: `DELETE FROM ModifierTable WHERE modifier_id = '${id}'`
                        };
                        await client.query(deleteModifierQuery);

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
    let orderRefId = '';
    let orderId = '';
    let itemId = '';
    let itemPrice = '';
    let itemName = '';
    let tax = '';
    const createOrderOptions = {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer 1dce5e76-15b4-5806-1202-e004adfb61f1',
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({
            'order-Type': {
                "taxable": true,
                "isDefault": false,
                "filterCategories": false,
                "isHidden": false,
                "isDeleted": false,
                "items": item
            },
            state: "open",
        })
    };

    // Step 1: Create an Order
    fetch('https://sandbox.dev.clover.com/v3/merchants/8RH7MNPJS1JK1/orders', createOrderOptions)
        .then(response => response.json())
        .then(async orderData => {
            orderId = orderData.id;
            const addLineItemOptions = {
                method: 'POST',
                headers: createOrderOptions.headers,
                body: JSON.stringify({
                    "item": {
                        "id": "G1W7MV8M4AY4Y"
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
                    "isRevenue": "false",
                    "taxRates": [
                        {
                            "isDefault": false,
                            "taxAmount": 10,
                            "rate": 10,
                            "name": "test"
                        }
                    ]
                })
            };


            return fetch(`https://sandbox.dev.clover.com/v3/merchants/8RH7MNPJS1JK1/orders/${orderId}/line_items`, addLineItemOptions);
        })
        .then(response => response.json())
        .then(async lineData => {
            console.log('Order created successfully:', lineData);

            orderRefId = lineData.orderRef.id;
            itemId = lineData.item.id;
            itemName = lineData.name;
            itemPrice = lineData.price;

            const taxRatesResponse = await fetch(`https://sandbox.dev.clover.com/v3/merchants/8RH7MNPJS1JK1/orders/${orderId}/line_items/${lineData.id}?expand=taxRates`, {
                headers: {
                    'Authorization': 'Bearer 1dce5e76-15b4-5806-1202-e004adfb61f1',
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                },
            });

            const taxRatesData = await taxRatesResponse.json();


            const addModifierOptions = {
                method: 'POST',
                headers: createOrderOptions.headers,
                body: JSON.stringify({
                    "modifier": {
                        "available": true,
                        "id": "B0HV5W9WX7CSA"
                    },
                    "quantitySold": 1
                })
            };


            const [response2] = await Promise.all([
                fetch(`https://sandbox.dev.clover.com/v3/merchants/8RH7MNPJS1JK1/orders/${orderId}/line_items/${lineData.id}/modifications`, addModifierOptions)
            ]);

            const modifierData = await response2.json();

            let amount = modifierData.amount / 100;

            itemPrice = itemPrice / 100;

            let totalPrice = amount + itemPrice;

            let matchLineItemId = taxRatesData.taxRates.elements.find(x => x.lineItemRef.id === lineData.id);
            if (matchLineItemId) {
                let tax_amount = taxRatesData.taxRates.elements.map(x => x.taxAmount);
                if (tax_amount[0] !== undefined) {
                    tax = tax_amount / 100;
                    totalPrice = totalPrice + tax;
                } else {
                    let tax_rate = taxRatesData.taxRates.elements.map(x => x.rate);
                    tax_rate = tax_rate / 100000;
                    tax = totalPrice * tax_rate / 100;
                    totalPrice = totalPrice + tax;
                }
            }



            const updateOrderOptions = {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer 1dce5e76-15b4-5806-1202-e004adfb61f1',
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                },
                body: JSON.stringify({
                    "total": totalPrice,
                })
            };


            const [res1, res2] = await Promise.all([
                fetch(`https://sandbox.dev.clover.com/v3/merchants/JKBYKFEDGJ251/orders`, updateOrderOptions),
                fetch(`https://sandbox.dev.clover.com/v3/merchants/JKBYKFEDGJ251/orders/${orderRefId}?expand=lineItems`, {
                    headers: {
                        'Authorization': 'Bearer 1dce5e76-15b4-5806-1202-e004adfb61f1',
                        'Content-Type': 'application/json',
                        'accept': 'application/json'
                    }
                })
            ]);


            const PriceData = await res1.json();
            const orderData = await res2.json();


            const orderInsertQuery = {
                text: 'INSERT INTO OrderTable (order_id, item_id, item_name, item_price, modifier_name, modifier_price, tax_amount, total_price, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                values: [orderRefId, itemId, itemName, itemPrice, modifierData.name, amount, tax, totalPrice, orderData.state],
            };
            await client.query(orderInsertQuery);

            res.status(201).json(modifierData);

        }).catch(err => {
            console.error('Error creating order:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        });
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
