import { Router } from 'express'
import {
    getCurrentUser,
    getCurrentUserRoles,
    login,
    logout,
    refreshAccessToken,
    register,
    updateCurrentUser,
} from '../controllers/auth'
import auth from '../middlewares/auth'
import { csrfProtection } from '../middlewares/csrf'
import {
    validateAuthentication,
    validateUserBody,
} from '../middlewares/validations'

const authRouter = Router()

authRouter.get('/user', auth, getCurrentUser)
authRouter.patch('/me', auth, validateUserBody, updateCurrentUser)
authRouter.get('/user/roles', auth, getCurrentUserRoles)
authRouter.post('/login', csrfProtection, validateAuthentication, login)
authRouter.get('/token', refreshAccessToken)
authRouter.get('/logout', logout)
authRouter.post('/register', csrfProtection, validateUserBody, register)
authRouter.get('/csrf-token', (req, res) => res.json({ csrfToken: req.csrfToken() }))
export default authRouter
