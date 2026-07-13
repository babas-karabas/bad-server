import { Request, Express } from 'express'
import multer, { FileFilterCallback, MulterError } from 'multer'
import { mkdirSync } from 'fs'
import { join, basename } from 'path'
import { MAX_FILE_SIZE, MAX_FILE_NAME_LENGTH, MIN_FILE_SIZE } from '../config'

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
            process.env.UPLOAD_PATH_TEMP
                ? `../public/${process.env.UPLOAD_PATH_TEMP}`
                : '../public'
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
        if (!fileName || fileName.length > Number(MAX_FILE_NAME_LENGTH)) {
            return cb(new Error('Имя файла слишком длинное'), fileName)
        }

        const uniqueSuffix = Date.now() + String(Math.round(Math.random() * 1e9))
        const newFileName = uniqueSuffix
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
    if (file.size > Number(MAX_FILE_SIZE)) {
         return cb(new MulterError("LIMIT_FILE_SIZE", 'Размер файла слишком большой'))
    }

    if (file.size < Number(MIN_FILE_SIZE)) {
        return cb(new MulterError("LIMIT_FILE_SIZE", 'Размер файла слишком маленький'))
    }
    return cb(null, true)
}

export default multer({ storage, fileFilter, limits: {
        fileSize: Number(MAX_FILE_SIZE),
        files: 1,
    }, })
