import { Filter } from 'mongodb'
import { db } from './client'
import { encryptPassword } from './util'
import { AppSchema } from './schema'

type UsersOpts = {
  username?: string
  page?: number
}

export async function getUsers(opts: UsersOpts = {}) {
  const filter: Filter<AppSchema.User> = {}
  const skip = (opts.page || 0) * 200

  if (opts.username) {
    filter.username = { $regex: new RegExp(opts.username, 'gi') }
  }

  const list = await db('user').find(filter).skip(skip).limit(200).toArray()
  return list
}

export async function changePassword(opts: { username: string; password: string }) {
  const hash = await encryptPassword(opts.password)
  await db('user').updateOne({ kind: 'user', username: opts.username }, { $set: { hash } })
  return true
}

export async function getUserInfo(userId: string) {
  const profile = await db('profile').findOne({ userId })
  const chats = await db('chat').countDocuments({ userId })
  const characters = await db('character').countDocuments({ userId })

  return { userId, chats, characters, handle: profile?.handle, avatar: profile?.avatar }
}
