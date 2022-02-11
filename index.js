import nedb from 'nedb'
import express from 'express'
import expressWs from 'express-ws'
import session from 'express-session'
import sessionDb from 'express-session-nedb'
import random from 'string-random'
import formidable from 'formidable'
import md5 from 'md5-node'
import HUB from './fmhub.js'

const databases = new Map() // 所有数据库
const FM = new HUB()        // 频道消息分发器
const messagelist = new Map() // 消息队列的nedb存储

const db = (name) => (databases.get(name) || function () {
  let database = new nedb({ filename: `./data/db/${name}.db`, autoload: true, timestampData: true })
  databases.set(name, database)
  return database
}())

const session_store = sessionDb(session, db('session'))

// 登录验证
const online = function (req, res, next) {
  if (!req.session.account) return res.status(401).send('未登录')
  if (req.session.account.gid !== 1) req.params.uid = req.session.account.uid
  next()
}

// 权限(合并优化)
const admin = function (account, item) {
  return (account.gid === 1 || account.uid === item.uid)
}

// 列表计量
const count_load = async (name, query) => await new Promise(resolve => db(name).count(query, (err, count) => resolve(count)))

// 条件查询
const list_load = async (name, query) => await new Promise(resolve => db(name).find(query, function (err, docs) {
  return resolve(docs.Map((item, index) => Object.assign({}, { _id: item.id })))
}))

const user_load = async (_id) => await new Promise(resolve => db('user').findOne({ _id }, function (err, doc) {
  if (!doc) return resolve(doc)
  // let { salt, password, mobile, email, ...user } = doc
  // 这里只应提取有限简略信息附给列表, 因为个人信息中可能含有大量私有字段
  // 但是..nedb 全在内存, 效率略略略...
  let { _id, gid, name, avatar } = doc
  return resolve({ _id, gid, name, avatar })
}))

// 通讯频道 Frequency Modulation, 游客使用公共账户 uid = 0
function websocketer(ws, req) {
  let uid = req.session?.account?.uid || "0"
  console.log(`用户 ${uid} 连接了服务器`)

  FM.增加会话(uid, ws)

  ws.on('message', function (msg) {
    if (typeof (msg) !== "string") return console.log("消息不是字符串")
    let { fm, data } = JSON.parse(msg) // 消息不是JSON
    FM.发送消息(fm, uid, data)
  })
  ws.on('close', (code) => FM.移除会话(uid, ws))
  ws.on('error', (code) => console.log('link error: ', code))
}

// 会话列表
function session_list(req, res) {
  return session_store.db.find({ "data.account.uid": req.session.account.uid }, function (err, docs) {
    return err ? res.status(500).send('错误') : res.json(docs)
  })
}

// 登录会话
function session_create(req, res) {
  return db('user').findOne({ name: req.body.name }, function (err, doc) {
    if (!doc) return res.status(400).send('账户不存在')
    if (md5(req.body.password + doc.salt) !== doc.password) return res.status(400).send('密码错误')
    return req.session.regenerate(function (err) {
      req.session.account = { uid: doc._id, gid: doc.gid ?? 0 }
      let { salt, password, ...user } = doc
      return res.json(user)
    })
  })
}

// 注销会话 (当前会话)
function sessionDeleteSelf(req, res) {
  return req.session.destroy(function (err) {
    return res.status(err ? 500 : 200).send(err ? '错误' : '退出登录')
  })
}

// 注销会话 (指定会话)
function session_delete(req, res) {
  return req.sessionStore.destroy(req.params.sid, function (err) {
    return err ? res.status(500).send('错误') : res.send('退出登录')
  })
}

// 账户资料 (当前账户)
function profile(req, res) {
  if (!req.session.account) return res.json({ name: '游客', avatar: '', online: false })
  return db('user').findOne({ _id: req.session.account.uid }, function (err, doc) {
    if (err) return res.status(400).send('账户不存在')
    doc.online = true
    delete doc.salt
    delete doc.password
    return res.json(doc)
  })
}

// 列表对象
const object_list = async function (req, res) {
  let { pagesize, page, count, like, post, tid, top, uid, user, sort, desc, ...query } = req.query

  if (tid) query.tid = Number(tid)      // 某些查询参数需要转换类型
  if (top) query.top = Number(top)      // 某些查询参数需要转换类型
  if (uid && uid !== req.session?.account?.uid) query.public = true // 如果查询条件限定为自己的, 则不用限制范围到公开的

  page = Number(page) || 1              // 默认页码1
  pagesize = Number(pagesize) || 20     // 默认分页20
  let skip = (page - 1) * pagesize      // 截取点

  // 登录状态时, 查询自己点赞过的和评论过的
  if (req.session?.account?.uid) {
    if (like) query.$or = await list_load('like', { attach: req.params.name, uid: req.session.account.uid })
    if (post) query.$or = await list_load('post', { attach: req.params.name, uid: req.session.account.uid })
  }

  // 消息限定范围
  if (req.params.name === 'message' && req.session.account.gid !== 1) {
    if (query.to) query.to = req.session.account.uid  // 只能查发给自己的消息
    else query.uid = req.session.account.uid          // 否则默认自己发出去的
  }

  // 要求附带统计信息
  if (count) await new Promise(resolve => db(req.params.name).count(query, function (err, count) {
    res.header('count', count)
    res.header('page', page)
    res.header('pages', Math.ceil(count / pagesize))
    res.header('pagesize', pagesize)
    resolve()
  }))

  desc = (desc === "1") ? 1 : -1
  let is_sort = {}
  switch (sort) {
    case 'top': is_sort.top = desc; break;
    case 'hot': is_sort.hot = desc; break;
    case 'createdAt': is_sort.createdAt = desc; break;
    case 'updatedAt': is_sort.updatedAt = desc; break;
    default:
  }

  return db(req.params.name).find(query).skip(skip).limit(pagesize).sort(sort).exec(async function (err, docs) {
    return res.json(await Promise.all(docs.map(async item => {
      item.posts = await count_load('post', { attach: req.params.name, aid: item._id }) // 附加评论数量
      item.likes = await count_load('like', { attach: req.params.name, aid: item._id }) // 附加点赞数量
      if (req.params.name === 'user') {
        delete item.salt
        delete item.password
        delete item.mobile
        delete item.email
      } else {
        item.user = await user_load(item.uid) // 附加用户信息(user对象没有作者)
      }
      if (req.params.name != 'user' && req.session.account) {
        item.like = !!(await count_load('like', {
          attach: req.params.name,
          aid: item._id,
          uid: req.session.account.uid
        }))
      }
      return item
    })))
  })
}

// 创建对象
const object_create = async function (req, res) {

  if (req.session?.account?.gid != 1) {
    delete req.body._id       // 游客和普通用户禁止设置, 权限
    delete req.body.uid       // 游客和普通用户禁止设置, 权限
    delete req.body.top       // 游客和普通用户禁止设置, 权限
    delete req.body.user      // 游客和普通用户禁止设置, 计算
    delete req.body.createdAt // 游客和普通用户禁止设置, 自动
    delete req.body.updatedAt // 游客和普通用户禁止设置, 自动
    delete req.body.views     // 游客和普通用户禁止设置, 统计
    delete req.body.posts     // 游客和普通用户禁止设置, 统计
    delete req.body.likes     // 游客和普通用户禁止设置, 统计
    delete req.body.files     // 游客和普通用户禁止设置, 统计
  }

  // 如果创建对象是用户作一些特殊处理
  if (req.params.name === 'user') {
    if (!req.body.name) {
      return res.status(400).send('用户名不能为空')
    }
    if (!req.body.password) {
      return res.status(400).send('密码不能为空')
    }
    if (await count_load({ name: req.body.name })) {
      return res.status(400).send('用户名已被占用')
    }
    req.body.name = req.body.name || random(12)                // 默认用户名(检查用户名是否可用)
    req.body.avatar = req.body.avatar || ''                    // 默认用户头像
    req.body.gid = (await count_load('user', {})) ? 0 : 1      // 默认是管理员为首个注册用户
    req.body.salt = random(32)                                 // 密码加盐
    req.body.password = md5(req.body.password + req.body.salt) // 必要设置密码
    req.body.public = true                                     // 默认公开
  } else {
    if (!req.session.account) return res.status(401).send('需要登录')
    req.body.uid = req.session.account.uid                     // 为发表对象附上作者ID
    req.body.public = true                                     // 默认公开
    req.body.views = 0                                         // 再生计数
  }

  // 如果包含标签
  if (req.body.tags && Array.isArray(req.body.tags)) {
    req.body.tags.forEach(item => {
      // 先查询是否存在, 存在则使用返回的_id进行挂载, 不存在则创建新的
      db('tag').findOne({ name: item }, function (err, doc) {
        if (err && !doc) {
          return // 创建新的
        } else {
          return // 使用这个 _id, 向它写入
        }
      })
    })

    // 是否可以创建一个复杂关系型数据库?
    // 以应对映射的共同对象
    // 例如在使用 tag 时, 向 idea 表的 tag 段读写, 即是 tag表的 idea 索引范围
    // (自动构建和维护双向索引)
    // 当删除此 idea 时, 也自动清理掉 tag 对 idea 的连接

  }

  // 如果是挂载对象到指定目标
  if (req.body.attach && req.body.aid) {
    let count = await count_load(req.body.attach, { _id: req.body.aid })
    if (!count) return res.status(404).send('目标挂载对象不存在')
  }

  // 写入对象
  return db(req.params.name).insert(req.body, async function (err, doc) {
    if (!doc) return res.status(500).send('创建失败')
    if (req.params.name !== 'user') {
      doc.user = await user_load(doc.uid)
    } else {
      delete doc.salt
      delete doc.password
    }
    return res.json(doc)
  })
}

// 修改对象
function object_patch(req, res, next) {
  return db(req.params.name).findOne({ _id: req.params._id }, function (err, doc) {
    if (!doc) return res.status(404).send('目标对象不存在')
    if (typeof (req.body.attach) !== "undefined") return res.status(403).send("无权限修改挂载目标")
    if (typeof (req.body.aid) !== "undefined") return res.status(403).send("无权限修改挂载目标")

    // 如果是 user 做一些特殊处理
    if (req.params.name === 'user') {
      if (req.session.account.gid !== 1) {
        if (req.session.account.uid !== doc._id) {
          return res.status(403).send('没有权限修改账户')
        }
        if (typeOf(req.body.gid) == "undefined") {
          return res.status(403).send('没有权限修改权限')
        }
      }
      if (req.body.password) {
        req.body.salt = random(32)                                 // 密码加盐
        req.body.password = md5(req.body.password + req.body.salt) // 设置密码
      }
      if (req.body.name) {
        // 检查用户名是否可用
      }
    } else {
      if (req.session.account.uid !== doc.uid && req.session.account.gid !== 1) {
        return res.status(403).send('没有权限修改对象')
      }
      if (req.body.uid && req.session.account.gid !== 1) {
        return res.status(403).send('没有权限修改归属')
      }
    }
    return db(req.params.name).update({ _id: req.params._id }, { $set: req.body }, function (err, count) {
      if (!count) return res.status(500).send('修改失败')

      // 对象发生了修改, 收集通知用户
      // 执行通知所有关注者

      // 构建消息内容
      let data = { name: req.params.name, _id: req.params._id }

      // 如何加入订阅和取消订阅? 如何判断自己是否已经订阅?
      // 关注了此对象的用户们(如果存在)
      if (Array.isArray(doc.fm)) {
        doc.fm.forEach(uid => {
          FM.发送消息("PATCH", req.session.account.uid, data)
          // 应当是向每个用户发送消息, 而不是向整个频道发送消息
        })
      }

      // 这个范围过大, 应当是关注此对象的, 而不是关注 PATCH 频道的, 因此 PATCH 是此对象消息的内容
      // 但直接使用对象ID与其它对象重复, 还需要标记对象类型..


      // 对象发生了修改, 收集通知终端(也许需要另建一个注视状态绑定)
      let 注视着此对象的终端们 = new Map()

      // 如果已经关注, 则排除对注视终端的重复通知


      // 此处插入 hook
      // 使用方法:
      // kana.item(name || all).patch.
      // kana.list(name || all).post

      // 数据双向绑定
      // 某个用户喜欢的主题
      // 主题被哪些用户喜欢
      // 当某个用户不再喜欢某个主题, 要双向解除绑定

      // like: uid > [pid]
      // like: pid > [uid]
      // 修改立即存储为日志
      // 逐期将日志合并

      // attach
      // thread > post
      // thread < post
      // thread 可以存储 [post]
      // post 可以存储 [thread]
      // 是直接的相互关联, 但数据众多且不在内存中
      // hub的关联在内存中, 但也会向磁盘更新
      // 时常剔除不被使用的, 每次使用使之存活时间增加
      // 每次读取必然缓存一段时间, 而缓存时间由内存压力界定
      // 维持命中率尽量高, 且在接近标准时, 逐渐剔除适合移除的
      // 若是被跑内存呢..?
      // 正常情况下数据的访问率如果都非常高, 则适宜加机器
      // 如果异常情况, 则延迟跑内存ip访问速率

      res.send('修改成功')

      // 会话完全成功后执行
      //if (typeof (msg) !== "string") return console.log("消息不是字符串")
      //let { fm, data } = JSON.parse(msg)
      // 此处需要向所有关注此 item 的用户发送消息, 因此还需要向上传递事件(如果这是一个附属对象)


      // 构建消息内容(由于是作者或管理员修改, 因此不必通知修改者, 消息内容不必特意为修改者书写)


      // 构建将要接受通知的用户队列, 需要去重, 所以使用 map
      // 由于是作者或管理员修改, 因此不必通知修改者, 要将修改者的id特意从最终列表移出
      let userlist = new Map()
      let collect = () => {
        userlist.set(doc.uid, true) // 先加入本对象作者
        // 再加入上级关注者. (如果是附属)
        if (doc.attach && doc.aid) { }

        // 再加入下级关注者.(这似乎需要作双向绑定才行)
        if (doc.attachR) {
          // 有哪些类型附属?
          // 每个类型有哪些对象实体?
          // 此类调用涉及了似乎较为庞大的关系网, 当调用具体对象时, 如何不必对下级作全量查询呢?
          // 在顶级加入结构表显然并不合适
          // 下级格式:
          // then > star {
          //   userlist: {} // 只有系统维护的字段, 如果写入, 先转换到 map, 或是直接去重
          // }
          // 实际就是这个用户是否关注了这个对象, 如果关注了,
          // 如何将上下级关系网中所有用户在不加载大量数据的情况下进行关注状态判定?
          // 分离式: 与账户系统解耦, 方便随时分离和改变数据的存储形式
          //
          // 如果放了挂载点, 查询上下关联时也要分别读取上下的挂载点, 此时是否对上下也全部加载?
        }
      }

      // 从待通知用户队列移除修改者id

      // 执行发送消息
      //let 发送消息 = () => {
      //  FM.发送消息(fm, uid, data)    // 先通知本级关注者(作者)
      //  if (doc.attach && doc.aid) { //再通知上级关注者()
      //    return 发送消息()
      //  }
      //}

    })
  })
}

// 用户的 like 表 (map)
// 当用户下线自动转换为冷数据, 从内存剔除

// 删除对象
const object_remove = function (req, res) {
  return db(req.params.name).findOne({ _id: req.params._id }, async function (err, doc) {
    if (!doc) return res.status(404).send('目标对象不存在')

    // 如果是删除用户作一些特殊处理
    if (req.params.name === 'user') {
      if (req.session.account.gid !== 1 && req.session.account.uid !== doc._id) {
        return res.status(400).send('没有权限删除此账户')
      }
      if (await count_load('account', { _id: req.params.id, gid: 1 }) === 1) {
        return res.status(400).send('不可以删除唯一的管理员账户')
      }
    } else {
      if (req.session.account.gid !== 1 && req.session.account.uid !== doc.uid) {
        return res.status(403).send('没有权限删除此对象')
      }
    }

    // TODO: 处理掉一些附属对象
    // 似乎要遍历所有对象类型?

    return db(req.params.name).remove({ _id: req.params._id }, function (err, count) {
      return count ? res.send('删除成功') : res.status(403).send('删除失败')
      // TODO: 当对象被删除时通过此连接通知所有在线终端
    })
  })
}

// 读取对象
const object_load = function (req, res) {
  return db(req.params.name).findOne({ _id: req.params._id }, async function (err, doc) {
    if (!doc) {
      return res.status(404).send('目标资源不存在')
    }
    if (!doc.public && doc.uid !== session?.account?.uid) {
      return res.status(403).send('没有权限读取')
    }
    if (req.params.name === 'user') {
      delete doc.salt
      delete doc.password
      delete doc.mobile
      delete doc.email
    } else {
      doc.user = await user_load(doc.uid)
    }
    db(req.params.name).update({ _id: req.params._id }, { $set: { views: doc.views ? doc.views + 1 : 1 } })
    return res.json(doc)
    //return res.json({ user: await user_load(doc.uid), ...doc })
  })
}

// 附件上传
const file_upload = function (req, res) {
  return db(req.params.name).findOne({ _id: req.params._id }, function (err, doc) {
    if (!doc) return res.status(404).send('目标对象不存在')
    if (req.session.account.uid !== doc.uid && req.session.account.gid !== 1) {
      return res.status(403).send('没有权限上传')
    }
    return formidable({ multiples: true, uploadDir: 'data/file', keepExtensions: true, maxFieldsSize: 200 * 1024 * 1024 }).parse(req, function (err, fields, files) {
      let list = []
      for (let key in files) {
        (Array.isArray(files[key]) ? files[key] : [files[key]]).map(({ filepath, mimetype, mtime, newFilename, originalFilename, size }) => list.push({
          filepath, mimetype, mtime, newFilename, originalFilename, size
        }))
      }
      return db(req.params.name).update({ _id: req.params._id }, { $addToSet: { file: { $each: list } } }, function (err, count) {
        if (!count) return res.status(500).send('附件挂载对象失败')
        console.log(list)
        return res.json(list)
      })
    })
  })
}

// 头像上传
const uploadavatar = function (req, res) {

  let idable = formidable({
    multiples: true,
    uploadDir: 'data/file',
    keepExtensions: true,
    maxFieldsSize: 200 * 1024 * 1024,
  })

  idable.parse(req, (err, fields, files) => {

    let list = []
    for (let key in files) {
      (Array.isArray(files[key]) ? files[key] : [files[key]]).map((data) => {
        let { filepath, mimetype, newFilename, originalFilename, size } = data
        list.push({ filepath, mimetype, newFilename, originalFilename, size })
      })
    }

    if (!list[0]) return res.status(400).send('未获得图像')

    let avatar = '/data/file/' + list[0].newFilename
    let query = { _id: req.session.account.uid }
    let data = {
      $addToSet: { file: { $each: list } }, // 保存记录
      $set: { avatar },                     // 替换头像
    }

    db('user').update(query, data, (err, count) => {
      if (!count) return res.status(500).send('附件挂载对象失败')
      res.json({ ...list[0], avatar }) // 返回唯一图像
    })

  })
}

const db_compact = function (req, res) {
  db(req.params.name).persistence.compactDatafile()
  return res.send("ok")
}

// 读取对象列表
function index_get(req, res) {
  // 返回对象列表
  let list = []
  databases.forEach((value, key) => {
    list.push(key)
  })
  res.json(list)
}

// 锁定对象列表
function index_patch(req, res) {
  // 指定设定的目标类型
}

// 锁定后手动创建列表(管理员) {
//  
//}

const app = expressWs(express()).app
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(session({ secret: 'kana', name: 'sid', resave: false, saveUninitialized: false, cookie: { maxAge: 180 * 24 * 3600000 }, store: session_store }))
app.use('/data/file/', express.static('data/file'))
app.ws('/', websocketer)
app.route('/').get(index_get)  // (req, res) => res.send(`<DOCTYPE html><p> Hello World</p>`)
app.route('/account').get(profile).post(online, uploadavatar)
app.route('/session').get(online, session_list).post(session_create).delete(online, sessionDeleteSelf)
app.route('/session/:sid').delete(online, session_delete)
app.route('/:name').get(object_list).post(object_create).put(db_compact)
app.route('/:name/:_id').get(object_load).post(online, file_upload).put().patch(online, object_patch).delete(online, object_remove)
app.listen(2333)
