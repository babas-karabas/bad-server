import { Request, Express, NextFunction, Response } from 'express'
import multer, { FileFilterCallback } from 'multer'
import { mkdirSync } from 'fs'
import { join, basename } from 'path'
import sharp from 'sharp'
import { unlink } from 'fs/promises'
import BadRequestError from '../errors/bad-request-error'
import {
    MAX_FILE_SIZE,
    MAX_FILE_NAME_LENGTH,
    UPLOAD_PATH_TEMP,
    MIN_FILE_SIZE
} from '../config'

type DestinationCallback = (error: Error | null, destination: string) => void
type FileNameCallback = (error: Error | null, filename: string) => void

const storage = multer.diskStorage({
    destination: (
        _req: Request,
        _file: Express.Multer.File,
        cb: DestinationCallback
    ) => {
        const destinationPath = join(
            __dirname,
            UPLOAD_PATH_TEMP ? `../public/${UPLOAD_PATH_TEMP}` : '../public'
        )

        mkdirSync(destinationPath, { recursive: true })

        cb(null, destinationPath)
    },

    filename: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileNameCallback
    ) => {
        const fileName = basename(file.originalname)
        if (!fileName || fileName.length > MAX_FILE_NAME_LENGTH) {
            return cb(
                new BadRequestError('Имя файла слишком длинное'),
                fileName
            )
        }

        const newFileName = Date.now() + String(Math.round(Math.random() * 1e9))
        return cb(null, newFileName)
    },
})

const types = [
    'image/png',
    'image/jpg',
    'image/jpeg',
    'image/gif',
    'image/svg+xml',
]

const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
) => {
    if (!types.includes(file.mimetype)) {
        return cb(null, false)
    }
    return cb(null, true)
}

export const fileMiddleware = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1,
    },
})

export const validateUploadedFile = async (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    if (!req.file) {
        return next(new BadRequestError('Файл не загружен'))
    }

    const { path: filePath, size } = req.file

    if (size < MIN_FILE_SIZE) {
        await unlink(filePath).catch(() => {})
        return next(new BadRequestError('Размер файла слишком маленький'))
    }

    try {
        const metadata = await sharp(filePath).metadata()
        if (!metadata.width || !metadata.height) {
            throw new Error('Некорректные метаданные изображения')
        }
    } catch (error) {
        await unlink(filePath).catch(() => {})
        return next(new BadRequestError('Передан не валидный файл изображения'))
    }

    return next()
}
