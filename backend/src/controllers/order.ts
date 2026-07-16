import { NextFunction, Request, Response } from 'express'
import mongoose, { FilterQuery, Error as MongooseError, Types } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order, { IOrder } from '../models/order'
import Product, { IProduct } from '../models/product'
import User from '../models/user'
import escapeRegExp from '../utils/escapeRegExp'
import { sanitize } from '../utils/sanitizer'

// eslint-disable-next-line max-len
// GET /orders?page=2&limit=5&sort=totalAmount&order=desc&orderDateFrom=2024-07-01&orderDateTo=2024-08-01&status=delivering&totalAmountFrom=100&totalAmountTo=1000&search=%2B1

const MAX_PAGE_SIZE = 10
const MAX_SEARCH_LENGTH = 100

export const getOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            page = '1',
            limit = '5',
            sortField = 'createdAt',
            sortOrder = 'desc',
            status,
            totalAmountFrom,
            totalAmountTo,
            orderDateFrom,
            orderDateTo,
            search,
        } = req.query

        if (typeof page !== 'string' || typeof limit !== 'string') {
            return next(new BadRequestError('Некорректные параметры пагинации'))
        }

        const pageNumber = Number(page)
        const parsedLimit = Number(limit)

        if (
            !Number.isInteger(pageNumber) ||
            pageNumber < 1 ||
            !Number.isInteger(parsedLimit) ||
            parsedLimit < 1
        ) {
            return next(new BadRequestError('Некорректные параметры пагинации'))
        }

        const limitNumber = Math.min(parsedLimit, Number(MAX_PAGE_SIZE))

        const filters: FilterQuery<Partial<IOrder>> = {}

        if (status) {
            if (typeof status === 'object') {
                Object.assign(filters, status)
            }
            if (typeof status === 'string') {
                filters.status = status
            }
        }

         if (totalAmountFrom !== undefined) {
            if (typeof totalAmountFrom !== 'string') {
                return next(
                    new BadRequestError('Некорректное значение totalAmountFrom')
                )
            }

            const value = Number(totalAmountFrom)

            if (Number.isNaN(value)) {
                return next(
                    new BadRequestError('Некорректное значение totalAmountFrom')
                )
            }

            filters.totalAmount = {
                ...filters.totalAmount,
                $gte: value,
            }
        }

        if (totalAmountTo !== undefined) {
            if (typeof totalAmountTo !== 'string') {
                return next(
                    new BadRequestError('Некорректное значение totalAmountTo')
                )
            }

            const value = Number(totalAmountTo)

            if (Number.isNaN(value)) {
                return next(
                    new BadRequestError('Некорректное значение totalAmountTo')
                )
            }

            filters.totalAmount = {
                ...filters.totalAmount,
                $lte: value,
            }
        }

        if (orderDateFrom !== undefined) {
            if (typeof orderDateFrom !== 'string') {
                return next(new BadRequestError('Некорректная дата'))
            }

            const date = new Date(orderDateFrom)

            if (Number.isNaN(date.getTime())) {
                return next(new BadRequestError('Некорректная дата'))
            }

            filters.createdAt = {
                ...filters.createdAt,
                $gte: date,
            }
        }

        if (orderDateTo !== undefined) {
            if (typeof orderDateTo !== 'string') {
                return next(new BadRequestError('Некорректная дата'))
            }

            const date = new Date(orderDateTo)

            if (Number.isNaN(date.getTime())) {
                return next(new BadRequestError('Некорректная дата'))
            }

            filters.createdAt = {
                ...filters.createdAt,
                $lte: date,
            }
        }

        const aggregatePipeline: any[] = [
            { $match: filters },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products',
                    foreignField: '_id',
                    as: 'products',
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            { $unwind: '$customer' },
            { $unwind: '$products' },
        ]

        if (search !== undefined) {
            if (
                typeof search !== 'string' ||
                search.length > Number(MAX_SEARCH_LENGTH)
            ) {
                return next(
                    new BadRequestError('Некорректный поисковый запрос')
                )
            }

            const searchRegex = new RegExp(escapeRegExp(search), 'i')
            const searchNumber = Number(search)

            const searchConditions: FilterQuery<IOrder>[] = [{ 'products.title': searchRegex }]

            if (!Number.isNaN(searchNumber)) {
                searchConditions.push({ orderNumber: searchNumber })
            }

            aggregatePipeline.push({
                $match: {
                    $or: searchConditions,
                },
            })

            filters.$or = searchConditions
        }

        const sortFields = [
            'createdAt',
            'orderNumber',
            'status',
            'totalAmount',
        ]

        const sort: { [key: string]: any } = {}

         if (
            typeof sortField === 'string' &&
            sortFields.includes(sortField)
        ) {
            sort[sortField] = sortOrder === 'asc' ? 1 : -1
        } else {
            sort.createdAt = -1
        }

        aggregatePipeline.push(
            { $sort: sort },
            { $skip: (pageNumber - 1) * limitNumber },
            { $limit: limitNumber },
            {
                $group: {
                    _id: '$_id',
                    orderNumber: { $first: '$orderNumber' },
                    status: { $first: '$status' },
                    totalAmount: { $first: '$totalAmount' },
                    products: { $push: '$products' },
                    customer: { $first: '$customer' },
                    createdAt: { $first: '$createdAt' },
                },
            }
        )

        const orders = await Order.aggregate(aggregatePipeline)
        const totalOrders = await Order.countDocuments(filters)
        const totalPages = Math.ceil(totalOrders / limitNumber)

        res.status(200).json({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: pageNumber,
                pageSize: limitNumber,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getOrdersCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const { search, page = '1', limit = '5' } = req.query

        const pageNumber = Number(page)
        const parsedLimit = Number(limit)

        if (!Number.isInteger(pageNumber) || pageNumber < 1) {
            return next(new BadRequestError('Некорректные параметры пагинации'))
        }

        if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
            return next(new BadRequestError('Некорректные параметры пагинации'))
        }

        const limitNumber = Math.min(parsedLimit, Number(MAX_PAGE_SIZE))

        const options = {
            skip: (pageNumber  - 1) * limitNumber,
            limit: limitNumber,
        }

        const user = await User.findById(userId)
            .populate({
                path: 'orders',
                populate: [
                    {
                        path: 'products',
                    },
                    {
                        path: 'customer',
                    },
                ],
            })
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )

        let orders = user.orders as unknown as IOrder[]

         if (search !== undefined) {
            if (
                typeof search !== 'string' ||
                search.length > Number(MAX_SEARCH_LENGTH)
            ) {
                return next(
                    new BadRequestError('Некорректный поисковый запрос')
                )
            }
            // если не экранировать то получаем Invalid regular expression: /+1/i: Nothing to repeat
            const searchRegex = new RegExp(escapeRegExp(search), 'i')
            const searchNumber = Number(search)
            const products = await Product.find({ title: searchRegex })
            const productIds = products.map((product) => product._id)

            orders = orders.filter((order) => {
                // eslint-disable-next-line max-len
                const matchesProductTitle = order.products.some((product) =>
                    productIds.some((id) => id.equals(product._id))
                )
                // eslint-disable-next-line max-len
                const matchesOrderNumber =
                    !Number.isNaN(searchNumber) &&
                    order.orderNumber === searchNumber

                return matchesOrderNumber || matchesProductTitle
            })
        }

        const totalOrders = orders.length
        const totalPages = Math.ceil(totalOrders / limitNumber)

        orders = orders.slice(options.skip, options.skip + options.limit)

        return res.send({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: pageNumber,
                pageSize: limitNumber,
            },
        })
    } catch (error) {
        next(error)
    }
}

// Get order by ID
export const getOrderByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const orderNumber = Number(req.params.orderNumber)

        if (!Number.isSafeInteger(orderNumber)) {
            return next(new BadRequestError('Некорректный номер заказа'))
        }

        const order = await Order.findOne({
            orderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

export const getOrderCurrentUserByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        const orderNumber = Number(req.params.orderNumber)

        if (!Number.isSafeInteger(orderNumber)) {
            return next(new BadRequestError('Некорректный номер заказа'))
        }

        const order = await Order.findOne({
            orderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        if (!order.customer._id.equals(userId)) {
            // Если нет доступа не возвращаем 403, а отдаем 404
            return next(
                new NotFoundError('Заказ по заданному id отсутствует в базе')
            )
        }
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// POST /product
export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const basket: IProduct[] = []
        const products = await Product.find<IProduct>({})
        const userId = res.locals.user._id
        const { address, payment, phone, total, email, items, comment } =
            req.body

        items.forEach((id: Types.ObjectId) => {
            const product = products.find((p) => p._id.equals(id))
            if (!product) {
                throw new BadRequestError(`Товар с id ${id} не найден`)
            }
            if (product.price === null) {
                throw new BadRequestError(`Товар с id ${id} не продается`)
            }
            return basket.push(product)
        })
        const totalBasket = basket.reduce((a, c) => a + c.price, 0)
        if (totalBasket !== total) {
            return next(new BadRequestError('Неверная сумма заказа'))
        }

        const newOrder = new Order({
            totalAmount: total,
            products: items,
            payment,
            phone: sanitize(phone),
            email: sanitize(email),
            comment: sanitize(comment) ?? '',
            customer: userId,
            deliveryAddress: sanitize(address),
        })
        const populateOrder = await newOrder.populate(['customer', 'products'])
        await populateOrder.save()

        return res.status(200).json(populateOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        return next(error)
    }
}

// Update an order
export const updateOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { status } = req.body
        const orderNumber = Number(req.params.orderNumber)

        if (!Number.isSafeInteger(orderNumber) || typeof status !== 'string') {
            return next(new BadRequestError('Некорректные данные заказа'))
        }

        const updatedOrder = await Order.findOneAndUpdate(
            { orderNumber },
            { status },
            { new: true, runValidators: true }
        )
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(updatedOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// Delete an order
export const deleteOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new BadRequestError('Некорректный id'))
        }

        const deletedOrder = await Order.findByIdAndDelete(id)
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(deletedOrder)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}
