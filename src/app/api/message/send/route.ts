import { fetchRedis } from "@/helper/redis"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { Message, messageValidator } from "@/lib/validators/message-validator"
import { getServerSession } from "next-auth"
import { nanoid } from "nanoid"
import { toPusherKey } from "@/lib/utils"
import { pusherServer } from "@/lib/pusher"

export async function POST(req: Request) {
    try
    {
        const { text, chatId } = await req.json()
        const session = await getServerSession(authOptions)

        if (!session) return new Response('Unauthorzed', { status: 401 })

        const [userId1, userId2] = chatId.split('--')

        if (session.user.id !== userId1 && session.user.id !== userId2)
        {
            return new Response('Unauthorized ', { status: 401 })
        }

        const friendId = session.user.id === userId1 ? userId2 : userId1

        const friendList = await fetchRedis('smembers', `user:${session.user.id}:friends`) as string[]

        const isFriend = friendList.includes(friendId)

        if (!isFriend) new Response('Unanuthorized', { status: 401 })

        const parsedSender = await fetchRedis('get', `user:${session.user.id}`) as string
        const sender = JSON.parse(parsedSender) as User

        const timestamp = Date.now()

        const messageData: Message = {
            id: nanoid(),
            senderId: session.user.id,
            text,
            timestamp,
        }

        const message = messageValidator.parse(messageData)

        pusherServer.trigger(toPusherKey(`chat:${chatId}`), 'incoming_message', message)

        console.log('message', message)
        await db.zadd(`chat:${chatId}:messages`, {
            score: timestamp,
            member: JSON.stringify(message)
        })

        return new Response('ok')

    } catch (error)
    {

    }
}