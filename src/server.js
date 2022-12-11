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
        pricePerDay: joi.number().positive().required()
    });

    const {body} = req;

    const validation = bodySchema.validate(body, {abortEarly: true});

    if ('error' in validation) {
        res.sendStatus(400);
        return;
    }

    const {name, image, stockTotal, categoryId, pricePerDay} = body;

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
    try {
        const {rows} = await connection.query(`
            SELECT id, name, phone, cpf, TO_CHAR(birthday :: DATE, 'YYYY-MM-DD') AS birthday
            FROM customers
            WHERE id = ${req.params.id}';
        `);

        res.send(rows);
    } catch {
        res.sendStatus(500);
    }
});


// server.post('/customers', async (req, res) => {

// });

const port = 4000;
server.listen(port, () => console.log('Express server listening on localhost:' + port));