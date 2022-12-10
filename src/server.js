import express from 'express';
import connection from './database.js';

const server = express();
server.use(express.json());


const port = 4000;
server.listen(port, () => console.log('Express server listening on localhost:' + port));