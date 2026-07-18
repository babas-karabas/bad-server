import { Request } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
    RATE_LIMIT_DURATION,
    RATE_LIMIT_POINTS,
    RATE_LIMITED,
    UNLIMITED_PATH,
} from '../config'

export const apiLimiter = rateLimit({
    windowMs: RATE_LIMIT_DURATION * 1000,
    max: RATE_LIMIT_POINTS,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => !RATE_LIMITED || UNLIMITED_PATH.includes(req.path),
    message: { error: 'Превышен лимит запросов. Попробуйте позже.' }
})