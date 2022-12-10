import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const {Pool} = pg;
const connection = new Pool({connectionString: process.env.DATABASE_URL});

console.log(connection);

export default connection;