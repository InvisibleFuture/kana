import interrelated from './interrelated.js'
import level from 'level'
import fs from 'fs'
import path from 'path'

function getStat(path) {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stats) => {
      err ? resolve(false) : resolve(stats)
    })
  })
}

function mkdir(dir) {
  return new Promise((resolve, reject) => {
    fs.mkdir(dir, err => {
      err ? resolve(false) : resolve(true)
    })
  })
}

async function dirExists(dir) {
  let isExists = await getStat(dir)
  if (isExists && isExists.isDirectory()) {
    return true
  } else if (isExists) {
    return false
  }
  let status = await dirExists(path.parse(dir).dir)
  return status ? await mkdir(dir) : null
}

// 检查并创建文件夹
await dirExists('data/level')

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

export default class {
  constructor() {
    this.用户订阅 = new interrelated()
    this.用户会话 = new interrelated()
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

  发送消息(fm, uid, data) {
    let msg = JSON.stringify({ fm, uid, data })
    // 订阅列表中
    // A 是用户, 所以是 A 下 B 的集合
    // B 是频道, 向频道下所有用户的会话发送消息, 所以是 B下A的集合用于查询会话列表
    // 会话列表中:
    // A 是用户, 所以是 A 下 B 的 集合
    // B 是 WS, 向用户的每个 WS 发送消息
    this.用户订阅.B中取A(fm, (uid) => {
      //console.log(`用户 ${uid} 订阅过此频道`, fm)
      this.用户会话.A中取B(uid, (ws) => {
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
}
