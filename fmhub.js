import interrelated from './interrelated.js'
import level from 'level'
import tools from './tools.js'

// 检查并创建文件夹
await tools.dirExists('data/level')

// 初始化 leveldb
const db = level("./data/level/fmhub")
//db.put('name', 'Level', function (err) {
//  if (err) return console.log('Ooops!', err) // some kind of I/O error
//
//  // 3) Fetch by key
//  db.get('name', function (err, value) {
//    if (err) return console.log('Ooops!', err) // likely the key was not found
//
//    // Ta da!
//    console.log('name=' + value)
//  })
//})

// 订阅记录, 每个频道可能被多次订阅因而产生大量查询

export default class fmhub {
  constructor() {
    this.用户订阅 = new interrelated()
    this.用户会话 = new interrelated()
    this.终端注视 = new interrelated() // onlookers
  }

  围观作品(对象路径, 围观者会话) {
    // 存储模式为 { key: ws, value: url}
  }

  变更作品(对象路径) {
    // 直接通过 对象路径 查询所有在围观的会话, 然后推送通知
    // 当终端改变了围观某个作品时, 通知修改围观对象
    // 当终端结束了观看某个作品时. 要移除围观,
    // 当终端断开连接时, 要移除围观
    // 于是这也要一套关系绑定...
    // 同一浏览器的多个页面, 使用同一个 ws 连接
  }

  订阅频道(fid, uid) {
    this.用户订阅.关联数据(uid, fid)
    // 要向数据库写入订阅记录
    if (uid !== "0") db.get(uid, (err, value) => {
      if (err) {
        value = JSON.stringify([])
      } else {
        let data = JSON.parse(value)     // 解码
        data.push(fid)                   // 添加
        data = Array.from(new Set(data)) // 去重
        value = JSON.stringify(data)     // 编码
      }
      db.put(uid, value, function (err) {
        if (err) return console.log("写入错误", err)
      })
    })
  }

  取消订阅(fid, uid) {
    this.用户订阅.取消关联(uid, fid)
    // 从数据库删除订阅记录
    if (uid !== "0") db.get(uid, (err, value) => {
      if (err) return console.log("尚无任何订阅")
      let data = JSON.parse(value)             // 解码
      data = data.filter(item => item !== fid) // 移除
      value = JSON.stringify(data)             // 编码
      db.put(uid, function (err) {
        if (err) return console.log("写入错误", err)
      })
    })
  }

  增加会话(uid, ws) {
    let 会话列表 = this.用户会话.A的集合.get(uid)
    this.用户会话.关联数据(uid, ws)
    if (!会话列表) {
      console.log("还没有会话, 则为其添加订阅记录")
      this.加载订阅记录(uid) // 但他可能没有订阅记录
    }
  }

  移除会话(uid, ws) {
    this.用户会话.取消关联(uid, ws)
    if (!this.用户会话.A的集合.get(uid)) {
      console.log("所有会话都被移除了, 也移除订阅记录")
      this.移除用户(uid)
    }
  }

  发送消息(频道, 来源UID, 数据) {
    let msg = JSON.stringify({ fm: 频道, uid: 来源UID, data: 数据 })
    // 订阅列表中
    // A 是用户, 所以是 A 下 B 的集合
    // B 是频道, 向频道下所有用户的会话发送消息, 所以是 B下A的集合用于查询会话列表
    // 会话列表中:
    // A 是用户, 所以是 A 下 B 的 集合
    // B 是 WS, 向用户的每个 WS 发送消息
    this.用户订阅.B中取A(频道, (目标UID) => {
      //console.log(`用户 ${uid} 订阅过此频道`, fm)
      this.用户会话.A中取B(目标UID, (ws) => {
        //console.log(`用户 ${uid} 的会话`)
        ws.send(msg)
      })
    })
  }

  移除用户(uid) {
    this.用户订阅.B中除A(uid)
    this.用户会话.B中除A(uid)
  }

  加载订阅记录(uid) {
    let 默认订阅 = ["chat", "system"]
    默认订阅.forEach(item => {
      console.log("默认订阅:", item)
      this.用户订阅.关联数据(uid, item)
    })
    if (uid !== "0") db.get(uid, (err, value) => {
      if (err) return console.log("尚无任何订阅")
      JSON.parse(value).forEach(item => this.用户订阅.关联数据(uid, item))
    })
  }

  // FM 通道状态监听分为两种情况
  // 1. 当前正在观看某一对象, 因此变更都推送(包括删除, 仅针对当前场景的会话)
  // 2. 订阅此对象的变化, 触发关键变化时收到通知(不包括删除, 所有在线会话都收到推送)

}
