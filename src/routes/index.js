const express = require('express')
const router = express.Router()
const campaingRoutes = require('./campaingRoutes')
const orderRoutes = require('./orderRoutes')
const productRoutes = require('./productRoutes')
const storeRoutes = require('./storeRoutes')
const supplierRoutes = require('./supplierRoutes')
const usersRoutes = require('./usersRoutes')

router.use(express.json())
router.use('/campaing', campaingRoutes)
router.use('/order', orderRoutes)
router.use('/product', productRoutes)
router.use('/store', storeRoutes)
router.use('/supplier', supplierRoutes)
router.use('/users', usersRoutes)

module.exports = router

