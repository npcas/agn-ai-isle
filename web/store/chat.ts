import { createPrompt, Prompt } from '../../common/prompt'
import { getEncoder } from '../../common/tokenize'
import { AppSchema } from '../../srv/db/schema'
import { EVENTS, events } from '../emitter'
import type { ChatModal } from '../pages/Chat/ChatOptions'
import { safeLocalStorage } from '../shared/util'
import { api } from './api'
import { createStore, getStore } from './create'
import { AllChat, chatsApi } from './data/chats'
import { msgsApi } from './data/messages'
import { usersApi } from './data/user'
import { draftStore } from './drafts'
import { msgStore } from './message'
import { subscribe } from './socket'
import { toastStore } from './toasts'

export { AllChat }

export type ChatState = {
  lastChatId: string | null
  lastFetched: number
  loaded: boolean
  // All user chats a user owns or is a member of
  allChats: AllChat[]
  // All chats for a particular character
  char?: {
    chats: AppSchema.Chat[]
    char: AppSchema.Character
    // Active or more recent chat
  }
  active?: {
    chat: AppSchema.Chat
    char: AppSchema.Character
    replyAs?: string
    participantIds: string[]
  }
  chatProfiles: AppSchema.Profile[]
  // chatBots: AppSchema.Character[]
  // chatBotMap: Record<string, AppSchema.Character>
  memberIds: { [userId: string]: AppSchema.Profile }
  prompt?: Prompt
  opts: {
    modal?: ChatModal
    editing: boolean
    screenshot: boolean
    hideOoc: boolean
  }
}

export type ImportChat = {
  name: string
  greeting: string
  scenario: string
  sampleChat: string
  messages: Array<{ msg: string; characterId?: string; userId?: string }>
}

export type NewChat = {
  name: string
  greeting: string
  scenario: string
  sampleChat: string
  overrides: AppSchema.Chat['overrides']
  mode?: AppSchema.Chat['mode']
}

const initState: ChatState = {
  lastFetched: 0,
  lastChatId: null,
  loaded: false,
  allChats: [],
  char: undefined,
  active: undefined,

  /** All profiles that have ever participated in the active chat */
  chatProfiles: [],

  /** All characters currently in the chat */
  // chatBots: [],
  // chatBotMap: {},

  /** Map of all profiles that have ever participated in the chat */
  memberIds: {},
  opts: {
    editing: false,
    screenshot: false,
    hideOoc: false,
    modal: undefined,
  },
}

const EDITING_KEY = 'chat-detail-settings'

export const chatStore = createStore<ChatState>('chat', {
  lastFetched: 0,
  lastChatId: safeLocalStorage.getItem('lastChatId'),
  loaded: false,
  allChats: [],
  chatProfiles: [],
  // chatBots: [],
  // chatBotMap: {},
  memberIds: {},
  opts: {
    ...getOptsCache(),
    modal: undefined,
    screenshot: false,
  },
})((get, set) => {
  events.on(EVENTS.loggedOut, () => {
    const { opts } = get()
    chatStore.setState({
      ...initState,
      opts: { ...opts, editing: opts.editing, hideOoc: opts.hideOoc },
    })
  })

  events.on(EVENTS.init, (init) => {
    if (init.chats) {
      chatStore.setState({ allChats: init.chats })
    }
  })

  return {
    /**
     * If a user accepts an invite to a chat, their profile has not been fetched and cached
     * To fix this, we'll lazy load them when they send a message and their profile isn't already present
     */
    option<Prop extends keyof ChatState['opts']>(
      prev: ChatState,
      key: Prop,
      value: ChatState['opts'][Prop]
    ) {
      const next = { ...prev.opts, [key]: value }
      next[key] = value
      saveOptsCache(next)
      return { opts: next }
    },
    async getMemberProfile({ memberIds, lastChatId }, chatId: string, id: string) {
      // Only retrieve profiles if the chat is _active_ to avoid unnecessary profile retrieval
      if (!lastChatId || chatId !== lastChatId) return
      if (memberIds[id]) return

      const res = await usersApi.getProfile(id)
      if (res.result) {
        return {
          memberIds: { ...memberIds, [id]: res.result },
        }
      }
    },
    async *getChat(prev, id: string) {
      yield { loaded: false, active: undefined }
      msgStore.setState({
        msgs: [],
        activeChatId: id,
        activeCharId: undefined,
      })
      const res = await chatsApi.getChat(id)
      yield { loaded: true }

      if (res.error) toastStore.error(`Failed to retrieve conversation: ${res.error}`)
      if (res.result) {
        safeLocalStorage.setItem('lastChatId', id)

        msgStore.setState({
          msgs: res.result.messages,
          activeChatId: id,
          activeCharId: res.result.character._id,
        })

        const isMultiChars =
          res.result.chat.characters && Object.keys(res.result.chat.characters).length

        yield {
          lastChatId: id,
          active: {
            chat: res.result.chat,
            char: res.result.character,
            participantIds: res.result.active,
            replyAs: isMultiChars ? undefined : res.result.character._id,
          },
          chatProfiles: res.result.members,
          memberIds: res.result.members.reduce(toMemberKeys, {}),
        }
      }
    },
    setAutoReplyAs({ active }, charId: string | undefined) {
      if (!active) return
      return {
        active: { ...active, replyAs: charId },
      }
    },
    async *editChat(
      { char, allChats, active },
      id: string,
      update: Partial<AppSchema.Chat>,
      onSuccess?: () => void
    ) {
      const res = await chatsApi.editChat(id, update)
      if (res.error) {
        toastStore.error(`Failed to update chat: ${res.error}`)
        return
      }

      if (res.result) {
        onSuccess?.()
        toastStore.success('Updated chat settings')

        yield { allChats: allChats.map((ch) => (ch._id === id ? res.result! : ch)) }

        if (char) {
          yield {
            char: {
              char: char.char,
              chats: char.chats.map((ch) => (ch._id === id ? res.result! : ch)),
            },
          }
        }

        if (active && active.chat._id === id) {
          yield {
            active: {
              ...active,
              chat: res.result!,
              char: active.char,
              participantIds: active.participantIds,
            },
          }
        }
      }
    },
    async *editChatGenSettings(
      { active },
      chatId: string,
      settings: AppSchema.Chat['genSettings'],
      onSucces?: () => void
    ) {
      const res = await chatsApi.editChatGenSettings(chatId, settings)
      if (res.error) {
        toastStore.error(`Failed to update generation settings: ${res.error}`)
        return
      }

      if (res.result) {
        if (active?.chat._id === chatId) {
          yield {
            active: {
              ...active,
              chat: { ...active.chat, genSettings: settings, genPreset: undefined },
            },
          }
          toastStore.success('Updated chat generation settings')
          onSucces?.()
        }
      }
    },
    async *editChatGenPreset({ active }, chatId: string, preset: string, onSucces?: () => void) {
      const res = await chatsApi.editChatGenPreset(chatId, preset)
      if (res.error) toastStore.error(`Failed to update generation settings: ${res.error}`)
      if (res.result) {
        if (active?.chat._id === chatId) {
          yield {
            active: {
              ...active,
              chat: { ...active.chat, genSettings: undefined, genPreset: preset },
            },
          }
          onSucces?.()
        }
      }
    },
    async *getAllChats({ allChats, lastFetched }) {
      const diff = Date.now() - lastFetched
      if (diff < 30000) return

      yield { loaded: false }
      const res = await chatsApi.getAllChats()
      yield { lastFetched: Date.now(), loaded: true }
      if (res.error) {
        toastStore.error(`Could not retrieve chats`)
        return { allChats }
      }

      if (res.result) {
        const chars = res.result.characters.reduce<any>(
          (prev, curr) => ({ ...prev, [curr._id]: curr }),
          {}
        )
        return { allChats: res.result.chats.sort(sortDesc), chars }
      }
    },
    getBotChats: async (_, characterId: string) => {
      const res = await chatsApi.getBotChats(characterId)
      if (res.error) toastStore.error('Failed to retrieve conversations')
      if (res.result) {
        return {
          loaded: true,
          char: {
            char: res.result.character,
            chats: res.result.chats.sort(sortDesc),
          },
        }
      }
    },
    async *createChat(
      { allChats, char },
      characterId: string,
      props: NewChat,
      onSuccess?: (id: string) => void
    ) {
      const res = await chatsApi.createChat(characterId, props)
      if (res.error) toastStore.error(`Failed to create conversation`)
      if (res.result) {
        yield { allChats: [res.result, ...allChats] }

        if (char?.char._id === characterId) {
          yield { char: { ...char, chats: [res.result, ...char.chats] } }
        }

        onSuccess?.(res.result._id)
      }
    },

    async inviteUser(_, chatId: string, userId: string, onSuccess?: () => void) {
      const res = await api.post(`/chat/${chatId}/invite`, { userId })
      if (res.error) return toastStore.error(`Failed to invite user: ${res.error}`)
      if (res.result) {
        toastStore.success(`Invitation sent`)
        onSuccess?.()
      }
    },

    async uninviteUser(_, chatId: string, memberId: string, onSuccess?: () => void) {
      const res = await api.post(`/chat/${chatId}/uninvite`, { userId: memberId })
      if (res.error) return toastStore.error(`Failed to remove user: ${res.error}`)
      if (res.result) {
        toastStore.success(`Member removed from chat`)
        onSuccess?.()
      }
    },

    async *addCharacter(_, chatId: string, charId: string, onSuccess?: () => void) {
      const res = await chatsApi.addCharacter(chatId, charId)
      if (res.error) return toastStore.error(`Failed to invite character: ${res.error}`)
      if (res.result) {
        toastStore.success(`Character added`)
        onSuccess?.()
      }
    },

    async *removeCharacter(_, chatId: string, charId: string, onSuccess?: () => void) {
      const res = await chatsApi.removeCharacter(chatId, charId)
      if (res.error) return toastStore.error(`Failed to remove character: ${res.error}`)

      if (res.result) {
        toastStore.success(`Character removed from chat`)
        onSuccess?.()
      }
    },

    async *deleteChat({ active, allChats, char }, chatId: string, onSuccess?: Function) {
      draftStore.clear(chatId)
      const res = await chatsApi.deleteChat(chatId)
      if (res.error) return toastStore.error(`Failed to delete chat: ${res.error}`)
      if (res.result) {
        toastStore.success('Successfully deleted chat')
        if (active?.chat._id === chatId) {
          yield { active: undefined }
        }

        yield { allChats: allChats.filter((ch) => ch._id !== chatId) }

        if (char?.chats) {
          yield { char: { ...char, chats: char.chats.filter((ch) => ch._id !== chatId) } }
        }

        onSuccess?.()
      }
    },

    async *importChat(
      { allChats, char },
      characterId: string,
      imported: ImportChat,
      onSuccess?: (chat: AppSchema.Chat) => void
    ) {
      const res = await chatsApi.importChat(characterId, imported)
      if (res.error) toastStore.error(`Failed to import chat: ${res.error}`)
      if (res.result) {
        yield { allChats: [res.result, ...allChats] }

        if (char?.char._id === characterId) {
          yield { char: { ...char, chats: [res.result, ...char.chats] } }
        }

        onSuccess?.(res.result)
      }
    },

    async getChatSummary(_, chatId: string) {
      await api.get(`/chat/${chatId}/summary`)
    },

    async showPrompt({ active }, msg: AppSchema.ChatMessage) {
      if (!active) return

      const { msgs } = msgStore.getState()
      const entities = await msgsApi.getPromptEntities()

      const encoder = await getEncoder()
      const prompt = createPrompt(
        {
          ...entities,
          replyAs: entities.characters[active.replyAs ?? active.char._id],
          messages: msgs.filter((m) => m.createdAt < msg.createdAt),
        },
        encoder
      )

      return { prompt }
    },

    closePrompt() {
      return { prompt: undefined }
    },
  }
})

function toMemberKeys(prev: Record<string, AppSchema.Profile>, curr: AppSchema.Profile) {
  prev[curr.userId] = curr
  return prev
}

subscribe('profile-handle-changed', { userId: 'string', handle: 'string' }, (body) => {
  const { chatProfiles, memberIds } = chatStore()
  if (!memberIds[body.userId]) return

  const nextMembers = chatProfiles.map((am) =>
    am.userId === body.userId ? { ...am, handle: body.handle } : am
  )

  const next = { ...memberIds[body.userId], handle: body.handle }

  memberIds[body.userId] = { ...memberIds[body.userId], handle: body.handle }

  chatStore.setState({
    chatProfiles: nextMembers,
    memberIds: { ...memberIds, [body.userId]: next },
  })
})

subscribe('chat-deleted', { chatId: 'string' }, (body) => {
  const { allChats, active, char } = chatStore()
  if (active?.chat._id === body.chatId) {
    chatStore.setState({ active: undefined })
  }

  {
    const next = allChats.filter((ch) => ch._id !== body.chatId)
    chatStore.setState({ allChats: next })
  }

  if (char?.chats) {
    const next = char.chats.filter((ch) => ch._id !== body.chatId)
    chatStore.setState({ char: { ...char, chats: next } })
  }
})

function sortDesc(left: { updatedAt: string }, right: { updatedAt: string }): number {
  return left.updatedAt > right.updatedAt ? -1 : left.updatedAt === right.updatedAt ? 0 : 1
}

subscribe('member-removed', { memberId: 'string', chatId: 'string' }, (body) => {
  const profile = getStore('user').getState().profile
  if (!profile) return

  const { chatProfiles, active } = chatStore.getState()

  if (!active?.chat) return
  if (active.chat._id !== body.chatId) return

  const nextIds = active.participantIds.filter((id) => id !== body.memberId)
  const nextProfiles = chatProfiles.filter((mem) => mem.userId !== body.memberId)
  chatStore.setState({ chatProfiles: nextProfiles, active: { ...active, participantIds: nextIds } })
})

subscribe(
  'member-added',
  {
    chatId: 'string',
    profile: { kind: 'any', userId: 'string', handle: 'string', _id: 'string', avatar: 'string?' },
  },
  (body) => {
    const { active, chatProfiles, memberIds } = chatStore.getState()
    if (!active || active.chat._id !== body.chatId) return

    const nextProfiles = chatProfiles.concat(body.profile)
    const nextProfileMap = { ...memberIds, [body.profile.userId]: body.profile }
    const nextIds = active.participantIds.concat(body.profile.userId)
    const nextChat = {
      ...active.chat,
      memberIds: active.chat.memberIds.concat(body.profile.userId),
    }
    chatStore.setState({
      chatProfiles: nextProfiles,
      memberIds: nextProfileMap,
      active: { ...active, participantIds: nextIds, chat: nextChat },
    })
  }
)

type ChatOptCache = { editing: boolean; hideOoc: boolean }

function saveOptsCache(cache: ChatOptCache) {
  const prev = getOptsCache()
  safeLocalStorage.setItem(EDITING_KEY, JSON.stringify({ ...prev, ...cache }))
}

function getOptsCache(): ChatOptCache {
  const prev =
    safeLocalStorage.getItem(EDITING_KEY) || JSON.stringify({ editing: false, hideOoc: false })
  const body = JSON.parse(prev)
  return { editing: false, hideOoc: false, ...body, modal: undefined }
}

subscribe(
  'chat-character-added',
  { chatId: 'string', active: 'boolean?', character: 'any' },
  (body) => {
    const { active, allChats } = chatStore.getState()

    const nextChats = allChats.map((chat) => {
      if (chat._id !== body.chatId) return chat
      return {
        ...chat,
        characters: Object.assign({}, chat.characters, { [body.character._id]: true }),
      }
    })

    chatStore.setState({ allChats: nextChats })

    if (!active || active.chat._id !== body.chatId) return

    const nextActive = {
      ...(active.chat.characters || {}),
      [body.character._id]: body.active ?? true,
    }

    chatStore.setState({
      active: {
        ...active,
        chat: {
          ...active.chat,
          characters: nextActive,
        },
      },
    })
  }
)

subscribe('chat-character-removed', { chatId: 'string', characterId: 'string' }, (body) => {
  const { active, allChats } = chatStore.getState()

  const nextChats = allChats.map((c) => {
    if (c._id !== body.chatId) return c
    return {
      ...c,
      characters: { ...(c.characters || {}), [body.characterId]: false },
    }
  })
  chatStore.setState({ allChats: nextChats })

  if (!active || active.chat._id !== body.chatId) return

  const nextChatCharacters = { ...(active.chat.characters || {}), [body.characterId]: false }
  chatStore.setState({
    active: {
      ...active,
      chat: {
        ...active.chat,
        characters: nextChatCharacters,
      },
    },
  })
})
