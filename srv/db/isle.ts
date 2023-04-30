import { db } from './client'
import { AppSchema } from './schema'

export async function getIrcServer(hostName: string) {
    return await db('irc-server').findOne({ kind: 'irc-server', hostName });
}

export async function listIrcServers() {
    return await db('irc-server').find({ kind: 'irc-server' }).map(obj => obj.hostName).toArray();
}

export async function storeIrcServer(server: AppSchema.IrcServer) {
    const { hostName } = server;
    await db('irc-server').insertOne(server);
    return (await getIrcServer(hostName))!;
}

export async function updateIrcServer(hostName: string, props: Partial<AppSchema.IrcServer>) {
    await db('irc-server').updateOne({ kind: 'irc-server', hostName }, { $set: props });
    return (await getIrcServer(props.hostName || hostName))!;
}

export async function deleteIrcServer(hostName: string) {
    return await db('irc-server').deleteOne({ kind: 'irc-server', hostName });
}

export async function getInsular(hostName: string, nickName: string) {
    return await db('insular').findOne({ kind: 'insular', hostName, nickName });
}

export async function listInsulars(hostName: string) {
    return await db('insular').find({ kind: 'insular', hostName }).map(obj => obj.nickName).toArray();
}

export async function storeInsular(insular: AppSchema.Insular) {
    const { hostName, nickName } = insular;
    await db('insular').insertOne(insular);
    return (await getInsular(hostName, nickName))!;
}

export async function updateInsular(hostName: string, nickName: string, props: Partial<AppSchema.Insular>) {
    await db('insular').updateOne({ kind: 'insular', hostName, nickName }, { $set: props });
    return (await getInsular(props.hostName || hostName, props.nickName || nickName))!;
}

export async function deleteInsular(hostName: string, nickName: string) {
    return await db('insular').deleteOne({ kind: 'insular', hostName, nickName });
}

export async function getTutelar(hostName: string, nickName: string, userId: string) {
    return await db('tutelar').findOne({ kind: 'tutelar', hostName, nickName, userId });
}

export async function listTutelars(hostName: string, nickName: string) {
    return await db('tutelar').find({ kind: 'tutelar', hostName, nickName }).map(obj => obj.userId).toArray();
}

export async function storeTutelar(tutelar: AppSchema.Tutelar) {
    const { hostName, nickName, userId } = tutelar;
    await db('tutelar').insertOne(tutelar);
    return (await getTutelar(hostName, nickName, userId))!;
}

export async function updateTutelar(hostName: string, nickName: string, userId: string, props: Partial<AppSchema.Tutelar>) {
    await db('tutelar').updateOne({ kind: 'tutelar', hostName, nickName, userId }, { $set: props });
    return (await getTutelar(props.hostName || hostName, props.nickName || nickName, props.userId || userId))!;
}

export async function deleteTutelar(hostName: string, nickName: string, userId: string) {
    return await db('tutelar').deleteOne({ kind: 'tutelar', hostName, nickName, userId });
}
