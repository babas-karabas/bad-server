import { ErrorRequestHandler } from 'express'

const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {

     if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({
            message: 'wrong CSRF token',
            })
    }
    
    const statusCode =
        err.statusCode ||
        err.status ||
        (err.code === 'LIMIT_FILE_SIZE' ? 413 : undefined) ||
        (err.name === 'MulterError' ? 400 : undefined) ||
        500
        
    const message =
        statusCode === 500 ? 'На сервере произошла ошибка' : err.message
    console.log(err)

    res.status(statusCode).send({ message })

    next()
}

export default errorHandler
