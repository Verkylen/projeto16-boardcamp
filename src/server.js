import express from 'express';
import connection from './database.js';
import joi from 'joi';

const server = express();
server.use(express.json());

server.get('/categories', async ({}, res) => {
    try {
        const {rows} = await connection.query('SELECT * FROM categories;');
        res.send(rows);
    } catch {
        res.sendStatus(500);
    }
});

server.post('/categories', async (req, res) => {
    const bodySchema = joi.object({name: joi.string().required()});

    const {body} = req;

    const validation = bodySchema.validate(body);

    if ('error' in validation) {
        res.sendStatus(400);
        return;
    }

    const {name} = body;

    try {
        const {rows} = await connection.query('SELECT name FROM categories WHERE name = $1;', [name]);

        if (rows.length !== 0) {
            res.sendStatus(409);
            return;
        }

        await connection.query('INSERT INTO categories (name) VALUES ($1);', [name]);

        res.sendStatus(201);
    } catch {
        res.sendStatus(500);
    }
});

server.get('/games', async (req, res) => {
    const name = ('name' in req.query) ? req.query.name.toLowerCase() : '';

    try {
        const {rows} = await connection.query(`
            SELECT games.*, categories.name AS "categoryName"
            FROM games JOIN categories
            ON games."categoryId" = categories.id
            WHERE LOWER (games.name) LIKE '${name}%';
        `);

        res.send(rows);
    } catch {
        res.sendStatus(500);
    }
});

server.post('/games', async (req, res) => {
    const bodySchema = joi.object({
        name: joi.string().required(),
        image: joi.string().pattern(new RegExp('^https://')).required(),
        stockTotal: joi.number().integer().positive().required(),
        categoryId: joi.number().integer().positive().required(),
        pricePerDay: joi.number().integer().positive().required(),
    });

    const {body} = req;

    const validation = bodySchema.validate(body, {abortEarly: true});

    if ('error' in validation) {
        res.sendStatus(400);
        return;
    }

    const regex = new RegExp('^[0-9]+$');

    const {name, image, stockTotal, categoryId, pricePerDay} = body;

    const disallows = [
        regex.test(stockTotal) === false,
        regex.test(categoryId) === false,
        regex.test(pricePerDay) === false
    ];

    if (disallows[0] || disallows[1] || disallows[2]) {
        res.sendStatus(400);
        return;
    }

    try {
        const {rows: category} = await connection.query('SELECT * FROM categories WHERE id = $1;', [categoryId]);

        if (category.length === 0) {
            res.sendStatus(400);
            return;
        }

        const {rows: game} = await connection.query('SELECT * FROM games WHERE name = $1;', [name]);

        if (game.length !== 0) {
            res.sendStatus(409);
            return;
        }

        await connection.query(`
            INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay")
            VALUES ($1, $2, $3, $4, $5);
        `, [name, image, stockTotal, categoryId, pricePerDay]);

        res.sendStatus(201);
    } catch {
        res.sendStatus(500);
    }
});

server.get('/customers', async (req, res) => {
    const {query} = req;

    const cpf = ('cpf' in query) ? query.cpf : '';

    try {
        const {rows} = await connection.query(`
            SELECT id, name, phone, cpf, TO_CHAR(birthday :: DATE, 'YYYY-MM-DD') AS birthday
            FROM customers
            WHERE cpf LIKE '${cpf}%';
        `);

        res.send(rows);
    } catch {
        res.sendStatus(500);
    }
});

server.get('/customers/:id', async (req, res) => {
    const paramsSchema = joi.object({id: joi.number().integer().positive().required()});

    const {params} = req;

    const validation = paramsSchema.validate(params);
    
    if ('error' in validation) {
        res.sendStatus(404);
        return;
    }

    const regex = new RegExp('^[0-9]+$');

    const {id} = params;

    if (regex.test(id) === false) {
        res.sendStatus(404);
        return;
    }

    try {
        const {rows} = await connection.query(`
            SELECT id, name, phone, cpf, TO_CHAR(birthday :: DATE, 'YYYY-MM-DD') AS birthday
            FROM customers
            WHERE id = $1;
        `, [id]);

        if (rows.length === 0) {
            res.sendStatus(404);
            return;
        }

        res.send(rows);
    } catch {
        res.sendStatus(500);
    }
});

server.post('/customers', async (req, res) => {
    const bodySchema = joi.object({
        name: joi.string().required(),
        phone: joi.string().pattern(new RegExp('^[0-9]{10,11}$')).required(),
        cpf: joi.string().pattern(new RegExp('^[0-9]{11}$')).required(),
        birthday: joi.string().pattern(new RegExp('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')).required()
    });

    const {body} = req;

    const validation = bodySchema.validate(body, {abortEarly: true});

    if ('error' in validation) {
        res.sendStatus(400);
        return;
    }

    const {name, phone, cpf, birthday} = body;

    const [year, month, date] = birthday.split('-');

    const sameDate = new Date(`${month}-${date}-${year}`);

    if (sameDate.toString() === 'Invalid Date') {
        res.sendStatus(400);
        return;
    }

    const disallows = [
        Number(year) !== sameDate.getFullYear(),
        Number(month) !== sameDate.getMonth() + 1,
        Number(date) !== sameDate.getDate()
    ];

    if (disallows[0] || disallows[1] || disallows[2]) {
        res.sendStatus(400);
        return;
    }

    if (Date.now() - sameDate.getTime() < 0) {
        res.sendStatus(400);
        return;
    }

    try {
        const {rows} = await connection.query('SELECT * FROM customers WHERE cpf = $1;', [cpf]);

        if (rows.length !== 0) {
            res.sendStatus(409);
            return;
        }

        await connection.query(`
            INSERT INTO customers (name, phone, cpf, birthday)
            VALUES ($1, $2, $3, $4);
        `, [name, phone, cpf, birthday]);

        res.sendStatus(201);
    } catch {
        res.sendStatus(500);
        return;
    }
});

server.put('/customers/:id', async (req, res) => {
    const bodySchema = joi.object({
        name: joi.string().required(),
        phone: joi.string().pattern(new RegExp('^[0-9]{10,11}$')).required(),
        cpf: joi.string().pattern(new RegExp('^[0-9]{11}$')).required(),
        birthday: joi.string().pattern(new RegExp('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')).required()
    });

    const {body} = req;

    const bodyValidation = bodySchema.validate(body, {abortEarly: true});

    if ('error' in bodyValidation) {
        res.sendStatus(400);
        return;
    }

    const {name, phone, cpf, birthday} = body;

    const [year, month, date] = birthday.split('-');

    const sameDate = new Date(`${month}-${date}-${year}`);

    if (sameDate.toString() === 'Invalid Date') {
        res.sendStatus(400);
        return;
    }

    const disallows = [
        Number(year) !== sameDate.getFullYear(),
        Number(month) !== sameDate.getMonth() + 1,
        Number(date) !== sameDate.getDate()
    ];

    if (disallows[0] || disallows[1] || disallows[2]) {
        res.sendStatus(400);
        return;
    }

    if (Date.now() - sameDate.getTime() < 0) {
        res.sendStatus(400);
        return;
    }

    const paramsSchema = joi.object({id: joi.number().integer().positive().required()});

    const {params} = req;
    const paramsValidation = paramsSchema.validate(params);
    
    if ('error' in paramsValidation) {
        res.sendStatus(404);
        return;
    }

    const regex = new RegExp('^[0-9]+$');

    const {id} = params;

    if (regex.test(id) === false) {
        res.sendStatus(404);
        return;
    }

    try {
        const {rows} = await connection.query('SELECT * FROM customers WHERE id = $1;', [id]);

        if (rows.length === 0) {
            res.sendStatus(404);
            return;
        }

        await connection.query(`
            UPDATE customers
            SET name = $1, phone = $2, cpf = $3, birthday = $4
            WHERE id = $5;
        `, [name, phone, cpf, birthday, id]);

        res.sendStatus(200);
    } catch {
        res.sendStatus(500);
        return;
    }
});

server.get('/rentals', async (req, res) => {
    const querySchema = joi.object({
        customerId: joi.number().integer().positive(),
        gameId: joi.number().integer().positive()
    });

    const {query} = req;

    const validation = querySchema.validate(query);

    if ('error' in validation) {
        res.sendStatus(405);
        return;
    }

    const queries = Object.entries(query);

    let filter = '';

    if (queries.length !== 0) {
        const [firstSpecifiedIdKey, firstSpecifiedIdValue] = queries[0];

        const regex = new RegExp('^[0-9]+$');
    
        if (regex.test(firstSpecifiedIdValue) === false) {
            res.sendStatus(405);
            return;
        }
            
        if (queries.length === 1) {
            filter = `WHERE "${firstSpecifiedIdKey}" = ${firstSpecifiedIdValue}`;
        }

        if (queries.length === 2) {
            const [secondSpecifiedIdKey, secondSpecifiedIdValue] = queries[1];

            if (regex.test(secondSpecifiedIdValue) === false) {
                res.sendStatus(405);
                return;
            }

            filter = `
                WHERE "${firstSpecifiedIdKey}" = ${firstSpecifiedIdValue}
                AND "${secondSpecifiedIdKey}" = ${secondSpecifiedIdValue}
            `;
        }
    }
    
    try {
        const {rows} = await connection.query(`
            SELECT rentals.*, TO_JSON(c) AS customer, TO_JSON(g) AS game
            FROM rentals JOIN (SELECT id, name FROM customers) c
            ON rentals."customerId" = c.id
            JOIN (
                SELECT games.id, games.name, games."categoryId", categories.name AS "categoryName"
                FROM games JOIN categories
                ON games."categoryId" = categories.id
            ) g
            ON rentals."gameId" = g.id ${filter};
        `);

        res.send(rows);
    } catch {
        res.sendStatus(500);
    }
});

server.post('/rentals', async (req, res) => {
    const schema = joi.number().integer().positive().required();

    const bodySchema = joi.object({
        customerId: schema,
        gameId: schema,
        daysRented: schema
    });

    const {body} = req;

    const validation = bodySchema.validate(body, {abortEarly: true});

    if ('error' in validation) {
        res.sendStatus(400);
        return;
    }

    const regex = new RegExp('^[0-9]+$');

    const {customerId, gameId, daysRented} = body;

    const disallows = [
        regex.test(customerId) === false,
        regex.test(gameId) === false,
        regex.test(daysRented) === false
    ];

    if (disallows[0] || disallows[1] || disallows[2]) {
        res.sendStatus(400);
        return;
    }

    try {
        const {rows: customer} = await connection.query('SELECT * FROM customers WHERE id = $1;', [customerId]);

        if (customer.length === 0) {
            res.sendStatus(400);
            return;
        }

        const {rows: game} = await connection.query('SELECT * FROM games WHERE id = $1;', [gameId]);

        if (game.length === 0) {
            res.sendStatus(400);
            return;
        }

        const {stockTotal, pricePerDay} = game[0];

        const {rows: rentals} = await connection.query('SELECT * FROM rentals WHERE "gameId" = $1;', [gameId]);

        let outOfStock = 0;

        for (const rental of rentals) {
            if (rental.returnDate === null) outOfStock++;
        }

        if (outOfStock >= stockTotal) {
            res.sendStatus(400);
            return;
        }
        
        const nowDate = new Date();

        const date = nowDate.getDate().toString().padStart(2, 0);
        const month = (nowDate.getMonth() + 1).toString().padStart(2, 0);
        const year = nowDate.getFullYear();

        const rentDate = `${year}-${month}-${date}`;

        const originalPrice = Number(daysRented) * Number(pricePerDay);

        await connection.query(`
            INSERT INTO rentals (
                "customerId",
                "gameId",
                "rentDate",
                "daysRented",
                "returnDate",
                "originalPrice",
                "delayFee"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7);
        `, [customerId, gameId, rentDate, daysRented, null, originalPrice, null]);

        res.sendStatus(201);
    } catch {
        res.sendStatus(500);
    }
});

server.post('/rentals/:id/return', async (req, res) => {
    const paramsSchema = joi.number().integer().positive();

    const {id} = req.params;

    const validation = paramsSchema.validate(id);

    if ('error' in validation) {
        res.sendStatus(404);
        return;
    }

    const regex = new RegExp('^[0-9]+$');

    if (regex.test(id) === false) {
        res.sendStatus(404);
        return;
    }

    try {
        const {rows} = await connection.query(`
            SELECT rentals.*, games."pricePerDay" AS "gamePricePerDay"
            FROM rentals JOIN games
            ON rentals."gameId" = games.id
            WHERE rentals.id = $1;
        `, [id]);

        if (rows.length === 0) {
            res.sendStatus(404);
            return;
        }

        if (rows[0].returnDate !== null) {
            res.sendStatus(400);
            return;
        }

        const nowDate = new Date();

        const dayMilliseconds = 24 * 60 * 60 * 1000;

        const {rentDate, daysRented, gamePricePerDay} = rows[0];

        const millisecondsRented = daysRented * dayMilliseconds;

        let delayFee = null;

        const millisecondsDifference = (nowDate - dayMilliseconds) - rentDate;

        if (millisecondsDifference > millisecondsRented) {
            const delayDays = Math.floor(millisecondsDifference / dayMilliseconds);

            delayFee = delayDays * Number(gamePricePerDay);
        }

        const date = nowDate.getDate().toString().padStart(2, 0);
        const month = (nowDate.getMonth() + 1).toString().padStart(2, 0);
        const year = nowDate.getFullYear();
    
        const returnDate = `${year}-${month}-${date}`;

        await connection.query(`
            UPDATE rentals SET "returnDate" = $1, "delayFee" = $2 WHERE id = $3;
        `, [returnDate, delayFee, id]);

        res.sendStatus(200);
    } catch {
        res.sendStatus(500);
    }
});

server.delete('/rentals/:id', async (req, res) => {
    const paramsSchema = joi.string().pattern(new RegExp('^[0-9]+$'));

    const {id} = req.params;

    const validation = paramsSchema.validate(id);

    if ('error' in validation) {
        res.sendStatus(404);
        return;
    }

    try {
        const {rows} = await connection.query('SELECT * FROM rentals WHERE id = $1;', [id]);

        if (rows.length === 0) {
            res.sendStatus(404);
            return;
        }

        if (rows[0].returnDate === null) {
            res.sendStatus(400);
            return;
        }

        await connection.query('DELETE FROM rentals WHERE id = $1;', [id]);

        res.sendStatus(200);
    } catch {
        res.sendStatus(500);
    }
});

const port = 4000;
server.listen(port, () => console.log('Express server listening on localhost:' + port));