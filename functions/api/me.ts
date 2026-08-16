import { currentUser, json } from '../lib/auth'
import type { PagesContext } from '../types'

export const onRequestGet = async (context: PagesContext) => json({ user: await currentUser(context) })
