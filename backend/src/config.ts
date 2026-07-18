import { CookieOptions } from 'express'
import ms from 'ms'

export const { PORT = '3000' } = process.env
export const { DB_ADDRESS = 'mongodb://127.0.0.1:27017/weblarek' } = process.env
export const { JWT_SECRET = 'JWT_SECRET' } = process.env
export const ACCESS_TOKEN = {
    secret: process.env.AUTH_ACCESS_TOKEN_SECRET || 'secret-dev',
    expiry: process.env.AUTH_ACCESS_TOKEN_EXPIRY || '10m',
}
export const REFRESH_TOKEN = {
    secret: process.env.AUTH_REFRESH_TOKEN_SECRET || 'secret-dev',
    expiry: process.env.AUTH_REFRESH_TOKEN_EXPIRY || '7d',
    cookie: {
        name: 'refreshToken',
        options: {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: ms(process.env.AUTH_REFRESH_TOKEN_EXPIRY || '7d'),
            path: '/',
        } as CookieOptions,
    },
}

export const { ORIGIN_ALLOW = 'http://localhost:5173' } = process.env

export const RATE_LIMITED = process.env.RATE_LIMITED
    ? process.env.RATE_LIMITED === 'true'
    : true
export const RATE_LIMIT_POINTS = Number(process.env.RATE_LIMIT_POINTS) || 15
export const RATE_LIMIT_DURATION = Number(process.env.RATE_LIMIT_DURATION) || 60
export const { UNLIMITED_PATH = '/auth/csrf-token' } = process.env


export const MAX_PAGE_SIZE = Number(process.env.MAX_PAGE_SIZE) || 10
export const MAX_SEARCH_LENGTH = Number(process.env.MAX_SEARCH_LENGTH) || 100

const BYTES_IN_KB = 1024
const BYTES_IN_MB = 1024 * 1024

const extractSize = (string: string): number => {
    const number = parseInt(string, 10); // Извлекаем число из начала строки
    const unit = string.replace(/^\d+/g, '').toLowerCase(); // Убираем число, остаётся единица
    
    switch (unit) {
        case 'kb':
          return number * BYTES_IN_KB;
        case 'mb':
          return number * BYTES_IN_MB;
        default:
          return 0; // значение по умолчанию
    }
}

export const MAX_FILE_NAME_LENGTH =
    Number(process.env.MAX_FILE_NAME_LENGTH) || 100
export const MIN_FILE_SIZE = process.env.MIN_FILE_SIZE
    ? extractSize(process.env.MIN_FILE_SIZE)
    : 2 * 1024

export const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE
    ? extractSize(process.env.MAX_FILE_SIZE)
    : 10 * 1024 * 1024

export const { UPLOAD_PATH_TEMP = 'temp' } = process.env
