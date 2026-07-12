import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import { extname } from 'path'
import BadRequestError from '../errors/bad-request-error'
import { MIN_FILE_SIZE } from '../config'

export const uploadFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.file) {
        return next(new BadRequestError('Файл не загружен'))
    }
    try {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
        const ext = extname(req.file.originalname)
        const fileName = process.env.UPLOAD_PATH
            ? `/${process.env.UPLOAD_PATH}/${uniqueSuffix}-${ext}`
            : `/${uniqueSuffix}${ext}`
        return res.status(constants.HTTP_STATUS_CREATED).send({
            fileName,
            originalName: req.file?.originalname,
        })
    } catch (error) {
        return next(error)
    }
}

export default {}
