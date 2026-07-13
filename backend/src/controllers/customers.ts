import { NextFunction, Request, Response } from 'express'
import mongoose, { FilterQuery } from 'mongoose'
import NotFoundError from '../errors/not-found-error'
import Order from '../models/order'
import User, { IUser } from '../models/user'
import BadRequestError from '../errors/bad-request-error'
import escapeRegExp from '../utils/escapeRegExp'
import { sanitize } from '../utils/sanitizer'
import { MAX_PAGE_SIZE, MAX_SEARCH_LENGTH } from '../config'

// TODO: Добавить guard admin
// eslint-disable-next-line max-len
// Get GET /customers?page=2&limit=5&sort=totalAmount&order=desc&registrationDateFrom=2023-01-01&registrationDateTo=2023-12-31&lastOrderDateFrom=2023-01-01&lastOrderDateTo=2023-12-31&totalAmountFrom=100&totalAmountTo=1000&orderCountFrom=1&orderCountTo=10
export const getCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            page = '1',
            limit = '10',
            sortField = 'createdAt',
            sortOrder = 'desc',
            registrationDateFrom,
            registrationDateTo,
            lastOrderDateFrom,
            lastOrderDateTo,
            totalAmountFrom,
            totalAmountTo,
            orderCountFrom,
            orderCountTo,
            search,
        } = req.query

        const pageNumber = Number(page)
        const limitNumber = Number(limit)

        if (
            !Number.isInteger(pageNumber) ||
            pageNumber < 1 ||
            !Number.isInteger(limitNumber) ||
            limitNumber < 1 ||
            limitNumber > Number(MAX_PAGE_SIZE)
        ) {
            return next(new BadRequestError('Некорректные параметры пагинации'))
        }

        const filters: FilterQuery<Partial<IUser>> = {}

        if (registrationDateFrom !== undefined) {
            if (typeof registrationDateFrom !== 'string') {
                return next(new BadRequestError('Некорректная дата'))
            }

            const date = new Date(registrationDateFrom)

            if (Number.isNaN(date.getTime())) {
                return next(new BadRequestError('Некорректная дата'))
            }

            filters.createdAt = {
                ...filters.createdAt,
                $gte: date,
            }
        }

        if (registrationDateTo !== undefined) {
            if (typeof registrationDateTo !== 'string') {
                return next(new BadRequestError('Некорректная дата'))
            }

            const endOfDay = new Date(registrationDateTo)

            if (Number.isNaN(endOfDay.getTime())) {
                return next(new BadRequestError('Некорректная дата'))
            }

            endOfDay.setHours(23, 59, 59, 999)
            filters.createdAt = {
                ...filters.createdAt,
                $lte: endOfDay,
            }
        }

        if (lastOrderDateFrom !== undefined) {
            if (typeof lastOrderDateFrom !== 'string') {
                return next(new BadRequestError('Некорректная дата'))
            }

            const date = new Date(lastOrderDateFrom)

            if (Number.isNaN(date.getTime())) {
                return next(new BadRequestError('Некорректная дата'))
            }

            filters.lastOrderDate = {
                ...filters.lastOrderDate,
                $gte: date,
            }
        }

       if (lastOrderDateTo !== undefined) {
            if (typeof lastOrderDateTo !== 'string') {
                return next(new BadRequestError('Некорректная дата'))
            }

            const endOfDay = new Date(lastOrderDateTo)

            if (Number.isNaN(endOfDay.getTime())) {
                return next(new BadRequestError('Некорректная дата'))
            }

            endOfDay.setHours(23, 59, 59, 999)
            filters.lastOrderDate = {
                ...filters.lastOrderDate,
                $lte: endOfDay,
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

        if (orderCountFrom !== undefined) {
            if (typeof orderCountFrom !== 'string') {
                return next(
                    new BadRequestError('Некорректное значение orderCountFrom')
                )
            }

            const value = Number(orderCountFrom)

            if (!Number.isInteger(value)) {
                return next(
                    new BadRequestError('Некорректное значение orderCountFrom')
                )
            }

            filters.orderCount = {
                ...filters.orderCount,
                $gte: value,
            }
        }

        if (orderCountTo !== undefined) {
            if (typeof orderCountTo !== 'string') {
                return next(
                    new BadRequestError('Некорректное значение orderCountTo')
                )
            }

            const value = Number(orderCountTo)

            if (!Number.isInteger(value)) {
                return next(
                    new BadRequestError('Некорректное значение orderCountTo')
                )
            }

            filters.orderCount = {
                ...filters.orderCount,
                $lte: value,
            }
        }

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
            const orders = await Order.find(
                {
                    $or: [{ deliveryAddress: searchRegex }],
                },
                '_id'
            )

            const orderIds = orders.map((order) => order._id)

            filters.$or = [
                { name: searchRegex },
                { lastOrder: { $in: orderIds } },
            ]
        }

        const sort: { [key: string]: any } = {}
        const sortFields = [
            'createdAt',
            'lastOrderDate',
            'totalAmount',
            'orderCount',
            'name',
        ]

        if (
            typeof sortField === 'string' &&
            sortFields.includes(sortField)
        ) {
            sort[sortField] = sortOrder === 'asc' ? 1 : -1
        } else {
            sort.createdAt = -1
        }

        const options = {
            sort,
            skip: (pageNumber - 1) * limitNumber,
            limit: limitNumber,
        }

        const users = await User.find(filters, null, options).populate([
            'orders',
            {
                path: 'lastOrder',
                populate: {
                    path: 'products',
                },
            },
            {
                path: 'lastOrder',
                populate: {
                    path: 'customer',
                },
            },
        ])

        const totalUsers = await User.countDocuments(filters)
        const totalPages = Math.ceil(totalUsers / limitNumber)

        res.status(200).json({
            customers: users,
            pagination: {
                totalUsers,
                totalPages,
                currentPage: pageNumber,
                pageSize: limitNumber,
            },
        })
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Get /customers/:id
export const getCustomerById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new BadRequestError('Некорректный id'))
        }

        const user = await User.findById(id)
        .populate([
            'orders',
            'lastOrder',
        ])
        .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь с заданным id отсутствует в базе'
                    )
            )
        res.status(200).json(user)
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Patch /customers/:id
export const updateCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params

           if (!mongoose.Types.ObjectId.isValid(id)) {
                return next(new BadRequestError('Некорректный id'))
            }

        const { name, email, phone } = req.body

        if (
            (name !== undefined && typeof name !== 'string') ||
            (email !== undefined && typeof email !== 'string') ||
            (phone !== undefined && typeof phone !== 'string')
        ) {
            return next(new BadRequestError('Invalid data'))
        }

        let updatedData;
        if (name !== undefined && email !== undefined && phone !== undefined) {
            updatedData = {
                name: sanitize(name),
                email: sanitize(email),
                phone: sanitize(phone),
        }
    }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            updatedData,
            {
                new: true,
                runValidators: true,
            }
        )
            .populate(['orders', 'lastOrder'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )
        res.status(200).json(updatedUser)
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Delete /customers/:id
export const deleteCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new BadRequestError('Некорректный id'))
        }

        const deletedUser = await User.findByIdAndDelete(id).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        res.status(200).json(deletedUser)
    } catch (error) {
        next(error)
    }
}
