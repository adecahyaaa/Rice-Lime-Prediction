const express = require('express')
const cors = require('cors')
const bp = require('body-parser')
const app = express()
// const PORT = 4000

const conn = require('./config/config')
const userRouter = require('./routes/userRoute')
const webRouter = require('./routes/webRoute')


app.use(cors())
app.use(bp.json())
app.use(bp.urlencoded({extended:true}))
app.use(express.json())

const PORT = process.env.PORT || 8000
app.listen(PORT, () => {
    console.log(`PORT JALAN DI ${PORT}`)
})

app.get("/", (req, res) => {
    res.send("ASSALAMUALAIKUM MUGIWARA");
});

app.get("/testdb", (req, res) => {
    conn.query("SELECT 1", (err, result) => {
        if (err) {
            res.status(500).json({ error: "Error menguji koneksi database" });
        } else {
            res.json({ message: "Koneksi ke database berhasil!" });
        }
    });
});

app.use('/api-bangkit', userRouter)
app.use('/', webRouter)