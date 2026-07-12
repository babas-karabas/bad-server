import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import mongoose, { Error as MongooseError } from 'mongoose'
import { join } from 'path'
import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import NotFoundError from '../errors/not-found-error'
import Product from '../models/product'
import movingFile from '../utils/movingFile'
import sanitizeHtml from '../utils/sanitizeHtml'
import { MAX_PAGE_SIZE } from '../config'

// GET /product
const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page = '1', limit = '5' } = req.query

        if (typeof page !== 'string' || typeof limit !== 'string') {
            return next(new BadRequestError('Некорректные параметры пагинации'))
        }

        const pageNumber = Number(page)
        const limitNumber = Number(limit)

        if (
            !Number.isInteger(pageNumber) ||
            pageNumber < 1 ||
            !Number.isInteger(limitNumber) ||
            limitNumber < 1 ||
            limitNumber > MAX_PAGE_SIZE
        ) {
            return next(new BadRequestError('Некорректные параметры пагинации'))
        }

        const options = {
            skip: (pageNumber - 1) * limitNumber,
            limit: limitNumber,
        }
        const products = await Product.find({}, null, options)
        const totalProducts = await Product.countDocuments({})
        const totalPages = Math.ceil(totalProducts / limitNumber)
        return res.send({
            items: products,
            pagination: {
                totalProducts,
                totalPages,
                currentPage: pageNumber,
                pageSize: limitNumber,
            },
        })
    } catch (err) {
        return next(err)
    }
}

// POST /product
const createProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { description, category, price, title, image } = req.body

        // Переносим картинку из временной папки
        if (image) {
            movingFile(
                image.fileName,
                join(__dirname, `../public/${process.env.UPLOAD_PATH_TEMP}`),
                join(__dirname, `../public/${process.env.UPLOAD_PATH}`)
            )
        }

        const product = await Product.create({
            description: sanitizeHtml(description),
            image,
            category: sanitizeHtml(category),
            price,
            title: sanitizeHtml(title),
        })
        return res.status(constants.HTTP_STATUS_CREATED).send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Товар с таким заголовком уже существует')
            )
        }
        return next(error)
    }
}

// TODO: Добавить guard admin
// PUT /product
const updateProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { productId } = req.params
        const const { category, description, image, price, title } = req.body

        // Переносим картинку из временной папки
        if (image) {
            movingFile(
                image.fileName,
                join(__dirname, `../public/${process.env.UPLOAD_PATH_TEMP}`),
                join(__dirname, `../public/${process.env.UPLOAD_PATH}`)
            )
        }

        const product = await Product.findByIdAndUpdate(
            productId,
            {
                $set: {
                    category: sanitizeHtml(category),
                    description: sanitizeHtml(description),
                    price: price ? price : null,
                    image: image ? image : undefined,
                },
            },
            { runValidators: true, new: true }
        ).orFail(() => new NotFoundError('Нет товара по заданному id'))
        return res.send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Товар с таким заголовком уже существует')
            )
        }
        return next(error)
    }
}

// TODO: Добавить guard admin
// DELETE /product
const deleteProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { productId } = req.params

         if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new BadRequestError('Некорректный id'))
        }

        const product = await Product.findByIdAndDelete(productId).orFail(
            () => new NotFoundError('Нет товара по заданному id')
        )
        return res.send(product)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        return next(error)
    }
}

export { createProduct, deleteProduct, getProducts, updateProduct }
