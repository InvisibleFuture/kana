import interrelated from 'interrelated'

export default class {
  constructor() {
    this.用户订阅 = new interrelated()
    this.用户会话 = new interrelated()
  }
  订阅频道(fid, uid) {
    this.用户订阅.set(fid, uid)
  }
  取消订阅(fid, uid) {
    this.用户订阅.delete(fid, uid)
  }
  增加会话(uid, ws) {
    this.用户会话.set(uid, ws)
  }
  移除会话(uid, ws) {
    this.用户会话.delete(uid, ws)
  }
  发送消息(fm, uid, data) {
    let msg = JSON.stringify({ fm, uid, data })
    this.用户订阅.atob(fm, (uid) => {
      //console.log(`用户 ${uid} 订阅的所有频道`)
      this.用户会话.atob(uid, (ws) => {
        //console.log(`用户 ${uid} 的会话`)
        ws.send(msg)
      })
    })
    //console.log(`用户 ${uid} 订阅的所有频道`)
    //this.用户订阅.aall(uid, (fid) => {
    //  console.log(fid)
    //})
    //console.log(`频道 ${fm} 下的所有用户`)
    //this.用户订阅.ball(fm, (uid) => {
    //  console.log(uid)
    //})
  }
  移除用户(uid) {
    this.用户订阅.adelete(uid)
    this.用户会话.adelete(uid)
  }
}
