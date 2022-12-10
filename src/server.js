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
    const name = req.query.name.toLowerCase();

    try {
        const {rows} = await connection.query('SELECT * FROM games WHERE LOWER(name) LIKE ' + `'${name}%';`);
        res.send(rows);
    } catch {
        res.sendStatus(500);
    }
});

server.post('/games', async (req, res) => {
    const bodySchema = joi.object({
        name: joi.string().required(),
        image: 'http://',
        stockTotal: 3,
        categoryId: 1,
        pricePerDay: 1500,
    });
});

const port = 4000;
server.listen(port, () => console.log('Express server listening on localhost:' + port));