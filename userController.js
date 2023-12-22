const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const { ImgUpload, bucket, bucketName } = require('../controllers/imgUpload');
const { validationResult, Result } = require('express-validator')
const bcrypt = require('bcryptjs')
const conn = require('../config/config')
const randomstring = require('randomstring')
const sendMail = require('../helpers/sendMail')
const jwt = require('jsonwebtoken')
const { JWT_SECRET } = process.env
const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage(),
});



const register = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    conn.query(
        `SELECT * FROM users WHERE LOWER(email) = LOWER(${conn.escape(
            req.body.email
        )})`,
        (err, result) => {
            if (result && result.length) {
                return res.status(409).send({
                    msg: 'This user is already in use',
                });
            } else {
                bcrypt.hash(req.body.password, 10, (err, hash) => {
                    if (err) {
                        return res.status(400).send({
                            msg: err,
                        });
                    } else {
                        conn.query(
                            `INSERT INTO users (name, email, password) VALUES ('${req.body.name}',${conn.escape(
                                req.body.email
                            )},${conn.escape(hash)})`,
                            (err, result) => {
                                if (err) {
                                    return res.status(400).send({
                                        msg: err,
                                    });
                                }

                                let mailsubject = 'Mail Verif';
                                const randomToken = randomstring.generate();
                                let content = '<p> HAHAHA' + req.body.name + ', hahaha <a href="http://localhost:4000/mail-verif?token=' + randomToken + '"> hahaha </a>'
                                sendMail(req.body.email, mailsubject, content)

                                conn.query('UPDATE users set token=? where email=?', [randomToken, req.body.email], function (error, result, fields) {
                                    if (error) {
                                        return res.status(400).send({
                                            msg: err,
                                        });
                                    }
                                })
                                return res.status(200).send({
                                    msg: 'That user has been registered with us',
                                });
                            }
                        );
                    }
                });
            }
        }
    );
};
const verifyMail = (req, res) => {
    var token = req.query.token;

    conn.query('SELECT * FROM users WHERE token=? limit 1', token, function (err, result, fields) {
        if (err) {
            console.log(err.message)
        }

        if (result.length > 0) {
            conn.query(`UPDATE users SET token=null, is_verified = 1 WHERE id = '${result[0].id}'`)
            return res.render('mailVerif', { message: 'Succes sudah di verif bro' });
        } else {
            return res.render('404');
        }
    });
}
const login = (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    conn.query(
        `SELECT * FROM users WHERE email = ${conn.escape(req.body.email)}`,
        (err, result) => {
            if (err) {
                return res.status(400).send({
                    msg: err
                })
            }

            if (!result.length) {
                return res.status(401).send({
                    msg: 'Email or Pass incorrect'
                })
            }

            bcrypt.compare(
                req.body.password,
                result[0]['password'],
                (bErr, bResult) => {
                    if (bErr) {
                        return res.status(400).send({
                            msg: bErr
                        })
                    }

                    if (bResult) {
                        // console.log(JWT_SECRET)
                        const token = jwt.sign({ id: result[0]['id'], is_admin: result[0]['is_admin'] }, JWT_SECRET, { expiresIn: '1h' })
                        conn.query(`
                        UPDATE users SET last_login = now() WHERE id = ${result[0]['id']}`
                        )
                        return res.status(200).send({
                            msg: 'logged in',
                            token,
                            user: result[0]
                        })
                    }

                    return res.status(401).send({
                        msg: 'Email or Pass incorrect'
                    })
                }
            );
        }
    );

}
const getUser = (req, res) => {
    // res.send('TES')
    const authToken = req.headers.authorization.split(' ')[1];
    const decode = jwt.verify(authToken, JWT_SECRET)

    conn.query(`SELECT * FROM users WHERE id=?`, decode.id, function (err, result, fields) {
        if (err) throw err;
        return res.status(200).send({ succces: true, data: result[0], message: 'Fetch success' })
    })
}
const forgetPassword = (req ,res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    var email = req.body.email
    conn.query('SELECT * FROM users where email=? limit 1', email, function(error, result, fields){
        if(error){
            return res.status(400).json({ message:error });
        }

        if(result.length > 0){

            let mailsubject = 'Forget Password'
            const randomString = randomstring.generate()
            console.log(randomString)
            let content = '<p>hahaha, '+result[0].name+'\
            please <a href="http://localhost:4000/reset-password?token='+ randomString +'"> Click </a> to reset </p>\
            '
            sendMail(email, mailsubject,content)
            conn.query(
                `DELETE FROM password_resets WHERE email=${conn.escape(result[0].email)}`
            )

            conn.query(
                `INSERT INTO password_resets (email, token) VALUES (${conn.escape(result[0].email)}, '${randomString}')`
            )

            return res.status(200).send({
                message:"Mail sent successfully for reset password"
            })
        }

        return res.status(401).send({
            message:'Email dosnt exits'
        })
    })


}
const addData = async (req, res) => {
    try {
        // Pastikan request memiliki header yang diperlukan
        const authToken = req.headers.authorization?.split(' ')[1];

        if (!authToken) {
            return res.status(401).json({
                error: true,
                message: 'Unauthorized: Missing JWT token',
            });
        }

        // Gunakan middleware multer untuk menangani form-data
        await new Promise((resolve, reject) => {
            upload.fields([{ name: 'imageBefore', maxCount: 1 }, { name: 'imageAfter', maxCount: 1 }])(req, res, (err) => {
                if (err) {
                    console.error('Error handling form data:', err);
                    reject({
                        error: true,
                        message: 'Failed to handle form data',
                    });
                }
                resolve();
            });
        });

        // Extract the name from the form data
        const name = req.body.name;

        // Validate the name field
        if (!name || typeof name !== 'string') {
            return res.status(400).json({
                error: true,
                message: 'Invalid or missing name in the form data',
            });
        }

        // Extract user information from the JWT token
        const decode = jwt.verify(authToken, JWT_SECRET);

        // Ensure that bucket is defined
        if (!bucket) {
            return res.status(500).json({
                error: true,
                message: 'Google Cloud Storage bucket is not defined',
            });
        }

        // Mengunggah gambar img_before ke Google Cloud Storage
        const fileBefore = req.files['imageBefore'] ? req.files['imageBefore'][0] : null;
        let imgBeforeUrl = null;

        if (fileBefore) {
            const gcsnameBefore = Date.now() + '-' + fileBefore.originalname;
            const blobBefore = bucket.file(gcsnameBefore);

            const streamBefore = blobBefore.createWriteStream({
                metadata: {
                    contentType: fileBefore.mimetype,
                },
            });

            streamBefore.on('error', (err) => {
                console.error('Error uploading img_before to GCS:', err);
                return res.status(500).json({
                    error: true,
                    message: 'Failed to upload img_before to Google Cloud Storage',
                });
            });

            streamBefore.on('finish', () => {
                imgBeforeUrl = `https://storage.googleapis.com/${bucketName}/${gcsnameBefore}`;
                console.log('imgBeforeUrl:', imgBeforeUrl);
            });

            streamBefore.end(fileBefore.buffer);

            // Menunggu hingga unggahan gambar sebelumnya selesai
            await new Promise((resolve) => {
                streamBefore.on('finish', resolve);
            });
        }

        // Mengunggah gambar img_after ke Google Cloud Storage
        const fileAfter = req.files['imageAfter'] ? req.files['imageAfter'][0] : null;
        let imgAfterUrl = null;

        if (fileAfter) {
            const gcsnameAfter = Date.now() + '-' + fileAfter.originalname;
            const blobAfter = bucket.file(gcsnameAfter);

            const streamAfter = blobAfter.createWriteStream({
                metadata: {
                    contentType: fileAfter.mimetype,
                },
            });

            streamAfter.on('error', (err) => {
                console.error('Error uploading img_after to GCS:', err);
                return res.status(500).json({
                    error: true,
                    message: 'Failed to upload img_after to Google Cloud Storage',
                });
            });

            streamAfter.on('finish', () => {
                imgAfterUrl = `https://storage.googleapis.com/${bucketName}/${gcsnameAfter}`;
                console.log('imgAfterUrl:', imgAfterUrl);
            });

            streamAfter.end(fileAfter.buffer);

            // Menunggu hingga unggahan gambar setelahnya selesai
            await new Promise((resolve) => {
                streamAfter.on('finish', resolve);
            });
        }

        // Construct the data to be inserted
        const dataToAdd = {
            name,
            dateTime: new Date(),
            img_before: imgBeforeUrl,
            img_after: imgAfterUrl,
            user_id: decode.id,
        };

        // Perform the database insertion
        conn.query('INSERT INTO data SET ?', dataToAdd, (err, result) => {
            if (err) {
                console.error('Error inserting data:', err);
                return res.status(500).json({
                    error: true,
                    message: 'Failed to add data to the database',
                });
            }

            return res.status(200).json({
                error: false,
                message: 'Success',
            });
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).json({
            error: true,
            message: 'Internal Server Error',
        });
    }
};

// const getData = async (req, res) => {
//     try {
//         // Extract user information from the JWT token
//         const authToken = req.headers.authorization.split(' ')[1];
//         const decode = jwt.verify(authToken, JWT_SECRET);

//         // Perform the database query to get data
//         conn.query(`SELECT * FROM data WHERE user_id=?`, decode.id, (err, result, fields) => {
//             if (err) {
//                 console.error('Error fetching data:', err);
//                 return res.status(500).json({
//                     error: true,
//                     message: 'Failed to fetch data from the database',
//                 });
//             }

//             return res.status(200).json({
//                 success: true,
//                 data: result,
//                 message: 'Fetch success',
//             });
//         });
//     } catch (error) {
//         console.error('Unexpected error:', error);
//         return res.status(500).json({
//             error: true,
//             message: 'Internal Server Error',
//         });
//     }
// };

const getData = async (req, res) => {
    try {
        // Extract user information from the JWT token
        const authToken = req.headers.authorization.split(' ')[1];
        const decode = jwt.verify(authToken, JWT_SECRET);

        // Perform the database query to get data along with user email
        const query = `
            SELECT data.id, data.user_id, users.email, data.name, data.img_before, data.img_after, data.dateTime
            FROM data
            INNER JOIN users ON data.user_id = users.id
            WHERE data.user_id = ?
        `;

        conn.query(query, [decode.id], (err, result, fields) => {
            if (err) {
                console.error('Error fetching data:', err);
                return res.status(500).json({
                    error: true,
                    message: 'Failed to fetch data from the database',
                });
            }

            // Modify the structure of the response
            const modifiedResult = result.map(item => ({
                id: item.id,
                user_id: item.user_id,
                email: item.email,
                name: item.name,
                img_before: item.img_before,
                img_after: item.img_after,
                dateTime: item.dateTime,
            }));

            return res.status(200).json({
                success: true,
                data: modifiedResult,
                message: 'Fetch success',
            });
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).json({
            error: true,
            message: 'Internal Server Error',
        });
    }
};

module.exports = {
    register,
    verifyMail,
    login,
    getUser,
    forgetPassword,
    addData,
    getData
};


