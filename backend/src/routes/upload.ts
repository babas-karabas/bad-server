import { Router } from 'express'
import { uploadFile } from '../controllers/upload'
import { fileMiddleware, validateUploadedFile } from '../middlewares/file'

const uploadRouter = Router()
uploadRouter.post('/', fileMiddleware.single('file'), validateUploadedFile, uploadFile)

export default uploadRouter
