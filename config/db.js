import dotenv from "dotenv";
dotenv.config();


import mysql from 'mysql2/promise';

// localhost setup
// const pool = mysql.createPool({
//   host: process.env.db_host,
//   user: process.env.db_user,
//   password: process.env.db_password,
//   database: process.env.db_name,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });

// Railway setup
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});





export default pool;