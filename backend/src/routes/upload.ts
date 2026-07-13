import { Router } from 'express'
import { uploadFile } from '../controllers/upload'
import fileMiddleware from '../middlewares/file'
import { csrfProtection } from '../middlewares/csrf'

const uploadRouter = Router()
uploadRouter.post('/', csrfProtection, fileMiddleware.single('file'), uploadFile)

export default uploadRouter
