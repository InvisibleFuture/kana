export default class {
  constructor() {
    this.channels = new Map()
    this.users = new Map()
  }
  订阅频道(fid, uid) {
    console.log(`用户 ${uid} 订阅了 ${fid}`)
    let channel = this.channels.get(fid) || new Map()
    if (!channel) this.channels.set(fid, channel)
    channel.set(uid, true)
  }
  取消订阅(fid, uid) {
    console.log(`用户 ${uid} 取消订阅 ${fid} 频道`)
    let channel = this.channels.get(fid)
    channel.delete(uid)
    // TODO: 如果此频道没有用户订阅了, 则将此频道也移除
    // TODO: 如果此用户没有任何订阅了, 则将此用户也移除
  }
  增加会话(uid, ws) {
    console.log(`用户 ${uid} 建立了新的会话连接`)
    let user = this.users.get(uid) || new Map()
    if (!user) this.users.set(uid, user)
    user.set(ws, true)
  }
  移除会话(uid, ws) {
    console.log(`用户 ${uid} 结束了当前会话连接`)
    let user = this.users.get(uid)
    user.delete(ws)
    console.log(`此用户还剩 ${user.size} 个 ws 连接`)
    if (user.size < 1) {
      console.log(`由于用户 ${uid} 已经没有会话, 直接移除此用户记录`)
      this.users.delete(uid)
    }
  }
  发送消息(fm, uid, data) {
    console.log("发送消息", fm, uid, data)
    let msg = JSON.stringify({ fm, uid, data })
    let channel = this.channels.get(fm) || new Map()
    if (!channel) this.channels.set(fm, channel)
    channel.forEach((value, userid) => {
      console.log(userid, value)
      let user = this.users.get(userid)
      if (!user) return console.log("订阅频道的用户不在线, 应移除此订阅");
      user.forEach((value, ws) => {
        ws.send(msg)
      })
    })
  }
  移除用户(uid) {
    console.log(`移除 ${uid} 的所有会话`)
    let user = this.users.get(uid)
    if (user) {
      user.forEach((value, ws) => ws.close()) // 断开用户所有会话
      this.users.delete(uid)                  // 删除用户(所有会话)
    }
    // TODO: 移除所有频道中的此用户
    // TODO: 移除此用户的记录
    // TODO: 断开所有此用户的连接
  }
}
