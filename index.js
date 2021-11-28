import nedb from 'nedb'
import express from 'express'
import expressWs from 'express-ws'
import session from 'express-session'
import sessionDb from 'express-session-nedb'
import random from 'string-random'
import formidable from 'formidable'
import md5 from 'md5-node'

//process.on('SIGINT', function () {
//  console.log('Got SIGINT.  Press Control-D/Control-C to exit.')
//  process.exit(0)
//})

const app = expressWs(express()).app
const databases = new Map() // 所有数据库
//const wsstores = new Map() // 所有 websocket 连接

const db = (name) => (databases.get(name) || function () {
  let database = new nedb({ filename: `./data/db/${name}.db`, autoload: true, timestampData: true })
  databases.set(name, database)
  return database
}())

// 通道: 自动构建 ws 列表
// const wsstore = name => (wsstores.get(name) || function () {
//   let list = new Map()
//   wsstores.set(name, list)
//   return list
// }())

const session_store = sessionDb(session, db('session'))

// 登录验证
const online = function (req, res, next) {
  if (!req.session.account) return res.status(401).send('未登录')
  if (req.session.account.gid != 1) req.params.uid = req.session.account.uid
  next()
}

// 列表计量
const count_load = async (name, query) => await new Promise(resolve => db(name).count(query, (err, count) => resolve(count)))

// 条件查询
const list_load = async (name, query) => await new Promise(resolve => db(name).find(query, function (err, docs) {
  return resolve(docs.Map((item, index) => Object.assign({}, { _id: item.id })))
}))

const user_load = async (_id) => await new Promise(resolve => db('user').findOne({ _id }, function (err, doc) {
  if (!doc) return resolve(doc)
  let { salt, password, mobile, email, ...user } = doc
  return resolve(user)
}))

// 特定类型查询时参数特性: message
const message = async function (req, res, next) {
  if (req.query.unread) req.query.unread = (req.query.unread === 'true')
  if (req.query.archive) req.query.archive = (req.query.archive === 'true')
  if (req.query.to) {
    delete req.query.to
    req.query.from = req.session.account.uid
  } else {
    req.query.to = req.session.account.uid
  }
}

const session_list = (req, res) => session_store.db.find({ "data.account.uid": req.session.account.uid }, function (err, docs) {
  err ? res.status(500).send('错误') : res.json(docs)
})

const session_create = (req, res) => db('user').findOne({ name: req.body.name }, function (err, doc) {
  if (!doc) return res.status(400).send('账户不存在')
  if (md5(req.body.password + doc.salt) !== doc.password) return res.status(400).send('密码错误')
  req.session.regenerate(function (err) {
    req.session.account = { uid: doc._id, gid: doc.gid ?? 0 }
    let { salt, password, ...user } = doc
    res.json(user)
  })
})

const sessionDeleteSelf = function (req, res) {
  return req.session.destroy(function (err) {
    return res.status(err ? 500 : 200).send(err ? '错误' : '退出登录')
  })
}

// TODO: 必须是自己的 UID
const session_delete = (req, res) => req.sessionStore.destroy(req.params.sid, function (err) {
  err ? res.status(500).send('错误') : res.send('退出登录')
})

const home = (req, res) => res.send(`<DOCTYPE html><p> Hello World</p>`)

const profile = function (req, res) {
  return db('user').findOne({ _id: req.session.account.uid }, function (err, doc) {
    if (err) return res.status(401).send('尚未登录')
    delete doc.salt
    delete doc.password
    return res.json(doc)
  })
}

// 列表对象
const object_list = async function (req, res) {
  let { pagesize, page, count, like, post, tid, top, uid, user, ...query } = req.query

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

  // 要求附带统计信息
  if (count) await new Promise(resolve => db(req.params.name).count(query, function (err, count) {
    res.header('count', count)
    res.header('page', page)
    res.header('pages', Math.ceil(count / pagesize))
    res.header('pagesize', pagesize)
    resolve()
  }))

  return db(req.params.name).find(query).skip(skip).limit(pagesize).sort({ createdAt: -1 }).exec(async function (err, docs) {
    return res.json(await Promise.all(docs.map(async item => {
      item.posts = await count_load('post', { attach: req.params.name, aid: item._id }) // 附加评论数量
      item.likes = await count_load('like', { attach: req.params.name, aid: item._id }) // 附加点赞数量
      item.user = await user_load(item.uid)                                             // 附加用户信息(user对象没有作者)
      if (req.params.name === 'user') {
        delete item.salt
        delete item.password
        delete item.mobile
        delete item.email
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
    req.body.name = req.body.name || random(12)                // 默认用户名(检查用户名是否可用)
    req.body.avatar = req.body.avatar || ''                    // 默认用户头像
    req.body.gid = (await count_load('user', {})) ? 0 : 1      // 默认是管理员为首个注册用户
    req.body.salt = random(32)                                 // 密码加盐
    req.body.password = md5(req.body.password + req.body.salt) // 必要设置密码
    req.body.public = true                                     // 默认公开
  } else {
    req.body.uid = req.session.account.uid                     // 为发表对象附上作者ID
    req.body.public = true                                     // 默认公开
    req.body.views = 0                                         // 再生计数
  }

  // 如果是挂载对象到指定目标
  if (req.body.attach && req.body.aid) {
    let count = await count_load(req.body.attach, { _id: req.body.aid })
    if (!count) return res.status(404).send('目标挂载对象不存在')
  }

  // 写入对象
  return db(req.params.name).insert(req.body, async function (err, doc) {
    if (!doc) return res.status(500).send('创建失败')
    if (req.params.name !== 'user') doc.user = await user_load(doc.uid)
    return res.json(doc)
  })
}

// 删除对象
const object_remove = function (req, res) {
  return db(req.params.name).findOne({ _id: req.params._id }, async function (err, doc) {
    if (doc) return res.status(404).send('目标对象不存在')

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

    // 处理掉一些附属对象

    return db(req.params.name).remove({ _id: req.params._id }, function (err, count) {
      return count ? res.send('删除成功') : res.status(403).send('删除失败')
      // TODO: 当对象被删除时通过此连接通知所有在线终端
    })
  })
}

// 读取对象
const object_load = function (req, res) {
  return db(req.params.name).findOne({ _id: req.params._id }, async function (err, doc) {
    if (!doc) return res.status(404).send('目标资源不存在')
    if (!doc.public && doc.uid !== session?.account?.uid) return res.status(403).send('没有权限读取')
    db(req.params.name).update({ _id }, { $set: { views: doc.views ? doc.views + 1 : 1 } })
    return res.status(200).json({ user: await user_load(doc.uid), ...doc })
  })
}

// 修改对象
const object_patch = function (req, res) {
  return db(req.params.name).findOne({ _id: req.params._id }, function (err, doc) {
    if (!doc) return res.status(404).send('目标对象不存在')

    // 如果是 user 做一些特殊处理
    if (res.params.name === 'user') {
      if (res.session.account.uid !== doc._id && res.session.account.gid !== 1) {
        return res.status(403).send('没有权限修改账户')
      }
      if (res.body.gid && res.session.account.gid !== 1) {
        return res.status(403).send('没有权限修改权限')
      }
      if (res.body.password) {
        req.body.salt = random(32)                                 // 密码加盐
        res.body.password = md5(req.body.password + req.body.salt) // 设置密码
      }
      if (res.body.name) {
        // 检查用户名是否可用
      }
    } else {
      if (res.session.account.uid !== doc.uid && res.session.account.gid !== 1) {
        return res.status(403).send('没有权限修改对象')
      }
      if (res.body.uid && res.session.account.gid !== 1) {
        return res.status(403).send('没有权限修改归属')
      }
    }
    return db(req.params.name).update({ _id: req.params._id }, data, function (err, count) {
      if (!count) return res.status(500).send('修改失败')
      return res.send('修改成功')
    })
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

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(session({ secret: 'shizukana', name: 'sid', resave: false, saveUninitialized: false, cookie: { maxAge: 180 * 24 * 3600000 }, store: session_store }))
app.use('/data/file/', express.static('data/file'))

app.route('/').get(home)
app.route('/user').post(object_create)
app.route('/account').get(online, profile)
app.route('/session').get(online, session_list).post(session_create).delete(online, sessionDeleteSelf)
app.route('/session/:sid').delete(online, session_delete)
app.route('/:name').get(object_list).post(online, object_create)
app.route('/:name/:_id').get(object_load).post(online, file_upload).put().patch(online, object_patch).delete(online, object_remove)

app.listen(2333)
