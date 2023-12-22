const mysql = require('mysql')
const env = require('dotenv')
env.config();
const util = require('util')
const {DB_NAME, DB_HOST, DB_USERNAME, DB_PASSWORD} = process.env



const connection = mysql.createConnection({
    // host: process.env.DB_HOST,
    // user: process.env.DB_USERNAME,
    // password: process.env.DB_PASSWORD,
    // database: process.env.DB_NAME

    host: DB_HOST,
    user: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_NAME
});


connection.connect((err) => {
    if(err){
        console.log("ERROR", err)
    }
    console.log(`DATABASE ${DB_NAME} SUDAH BISA DIGUNAKAN`)
});

connection.query = util.promisify(connection.query).bind(connection)

module.exports = connection;