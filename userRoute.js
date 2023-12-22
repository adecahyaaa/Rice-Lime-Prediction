const express =  require('express');
const router =  express.Router();
const {signUpValidation, loginValidation, forgetValidation} = require('../helpers/validation')
const userController  = require('../controllers/userController')
const {isAuthorize} = require('../middleware/auth')

router.post('/register',signUpValidation, userController.register)
router.post('/login',loginValidation, userController.login)
router.post('/forget-password', forgetValidation, userController.forgetPassword)
router.post('/add', isAuthorize,userController.addData)


router.get('/get-user', isAuthorize, userController.getUser)
router.get('/get-data', isAuthorize, userController.getData)

module.exports = router;