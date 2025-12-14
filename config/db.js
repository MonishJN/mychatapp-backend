import dotenv from "dotenv";
dotenv.config();


import mysql from 'mysql2/promise';

// localhost setup
const pool = mysql.createPool({
  host: process.env.db_host,
  user: process.env.db_user,
  password: process.env.db_password,
  database: process.env.db_name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});



//railway database setup
// const pool = mysql.createPool(process.env.DATABASE_URL);


export default pool;