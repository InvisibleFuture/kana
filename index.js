import nedb       from 'nedb'
import express    from 'express'
import expressWs  from 'express-ws'
import session    from 'express-session'
import random     from 'string-random'
import formidable from 'formidable'
import md5        from 'md5-node'

process.on('SIGINT', function() {
  console.log('Got SIGINT.  Press Control-D/Control-C to exit.')
  process.exit(0)
})

const app = expressWs(express()).app
const databases = new Map() // 所有数据库
const wsstores  = new Map() // 所有 websocket 连接

const db = (name) => (databases.get(name) || function(){
  let database = new nedb({filename:`./data/db/${name}.db`,autoload:true,timestampData:true})
  databases.set(name, database)
  return database
}())

// 通道: 自动构建 ws 列表
const wsstore = name => (wsstores.get(name) || function() {
  let list = new Map()
  wsstores.set(name, list)
  return list
}())

// 组件: 要求登录 (普通成员路由参数附上uid以分离权限)
const online = function(req, res, next) {
  if (!req.session.account) return res.status(401).send('未登录')
  if (req.session.account.gid != 1) req.params.uid = req.session.account.uid
  next()
}

const SessionStore = function (session) {
  function NedbStore(options, cb) {
    var callback = cb || function () {};
    this.db = db('session');
    this.db.loadDatabase(callback);
  }
  NedbStore.prototype.__proto__ = session.Store.prototype;
  NedbStore.prototype.get = function (sid, callback) {
    this.db.findOne({ sid: sid }, function (err, sess) {
      if (err) { return callback(err); }
      if (!sess) { return callback(null, null); }

      return callback(null, sess.data);
    });
  };
  NedbStore.prototype.set = function (sid, data, callback) {
    this.db.update({ sid: sid }, { sid: sid, data: data }, { multi: false, upsert: true }, function (err) {
      return callback(err);
    });
  };
  NedbStore.prototype.destroy = function (sid, callback) {
    this.db.remove({ sid: sid }, { multi: false }, function (err) {
      return callback(err);
    });
  };
  return NedbStore;
};

const session_store = new (SessionStore(session))

// 列表计量
const count_load = async (name, query) => await new Promise(resolve => db(name).count(query, (err, count) => resolve(count)))

// 条件查询
const list_load = async (name, query) =>  await new Promise(resolve => db(name).find(query, function(err, docs) {
  return resolve(docs.Map((item, index) => Object.assign({}, {_id: item.id})))
}))

const user_load = async (_id) => await new Promise(resolve => accounts.findOne({_id}, function(err, doc) {
  if (!doc) return resolve(doc)
  let { salt, password, mobile, email, ...user } = doc
  return resolve(user)
}))

const ListView = async function(req, res, next) {
  if (req.query.tid) req.query.tid = Number(req.query.tid) // 某些查询参数需要转换类型
  if (req.query.top) req.query.top = Number(req.query.top) // 某些查询参数需要转换类型
  if (req.query.uid || req.query.uid !== req.session?.account?.uid) {
    req.query.public = true // 如果查询条件限定为自己的, 则不用限制范围到公开的
  }
  let { pagesize, page, like, post, ...query } = req.query
  pagesize = Number(pagesize) || 20
  let skip = ((Number(page) || 1) - 1) * pagesize
  // 基于登录状态的查询, 查询点赞过的, 查询评论过的
  if (req.session?.account?.uid) {
    if (like) query.$or = await list_load('like',{name:req.params.name, uid:req.session.account.uid})
    if (post) query.$or = await list_load('post',{name:req.params.name, uid:req.session.account.uid})
  }
  db(req.params.name).find(query).skip(skip).limit(pagesize).sort({createdAt: -1}).exec(async function(err, docs) {
    for (let item of docs) {
      item.posts = await count_load('post', {name:req.params.name, id:item._id}) // 附加评论数量
      item.likes = await count_load('like', {name:req.params.name, id:item._id}) // 附加点赞数量
    }
    if (!req.params.name) {
      docs.forEach(async item => {
        let { salt, password, mobile, email, ...user } = item
        item = user
      })
    }
    if (req.params.user && item.uid && req.params.name !== 'user') docs.forEach(async item => {
      item.user = await user_load(item.uid)
    })
    res.json(docs)
  })
}

const OneView = async function(req, res, next) {
  db(req.params.name).findOne({_id: req.params._id}, async function(err, doc) {
    if (err || !doc) return res.status(404).send('目标资源不存在')
    if (!doc.public && doc.uid !== req.session?.account?.uid) {
      return res.status(403).send('没有权限读取')
    }
    // 附加用户信息
    if (req.query.user) doc.user = await user_load(doc.uid)
    res.send(doc)
  })
}

const object_create = async function(req, res, next) {
  if (req.session?.account?.gid != 1) {
    delete req.body._id       // 普通用户禁止设置
    delete req.body.uid       // 普通用户禁止设置
    delete req.body.top       // 普通用户禁止设置
    delete req.body.user      // 普通用户禁止设置
    delete req.body.createdAt // 普通用户禁止设置
    delete req.body.updatedAt // 普通用户禁止设置
    delete req.body.views     // 普通用户禁止设置
    delete req.body.posts     // 普通用户禁止设置
    delete req.body.likes     // 普通用户禁止设置
    delete req.body.files     // 普通用户禁止设置
  }
  if (!req.params.name) {
    req.body.name = req.body.name || random(12)                // 默认用户名
    req.body.avatar = req.body.avatar || ''                    // 默认用户头像
    req.body.gid = (await count_load('user', {})) ? 0 : 1      // 默认是管理员为首个注册用户
    req.body.salt = random(32)                                 // 密码加盐
    req.body.password = md5(req.body.password + req.body.salt) // 必要设置密码
    req.body.public = true                                     // 默认公开
  } else if (req.session?.account?.uid) {
    req.body.uid = req.session.account.uid                     // 为发表对象附上作者ID
    req.body.public = true                                     // 默认公开
  }
  db(req.params.name ?? 'user').insert(req.body, function(err, doc) {
    doc ? res.json(doc) : res.status(500).send('创建失败')
  })
}

const session_list = (req, res) => session_store.db.find({ "data.account.uid": req.session.account.uid }, function(err, docs) {
  err ? res.status(500).send('错误') : res.json(docs)
})

const session_create = (req, res) => db('user').findOne({name: req.body.name}, function(err, doc) {
  if (!doc) return res.status(400).send('账户不存在')
  if (md5(req.body.password + doc.salt) !== doc.password) return res.status(400).send('密码错误')
  req.session.regenerate(function(err) {
    req.session.account = { uid: doc._id, gid: doc.gid ?? 0 }
    let { salt, password, ...user} = doc
    res.json(user)
  })
})

const session_delete_self = (req, res) => req.session.destroy(function(err) {
  err ? res.status(500).send('错误') : res.send('退出登录')
})

// TODO: 必须是自己的 UID
const session_delete = (req, res) => req.sessionStore.destroy(req.params.sid, function(err) {
  err ? res.status(500).send('错误') : res.send('退出登录')
})

const home = (req, res) => res.send(`<DOCTYPE html><p> Hello World</p>`)
const files_delete = (req, res) => res.status(400).send('拒绝操作')
const files_upload = (req, res) => {
  formidable({ multiples: true, uploadDir: 'data/file', keepExtensions: true, maxFieldsSize: 200 * 1024 * 1024 }).parse(req, function(err, fields, files) {
    let list = []
    for (let key in files) {
      let arr = Array.isArray(files[key]) ? files[key] : [files[key]]
      arr.forEach(({size, path, name, type}) => list.push({size, path, name, type}))
    }
    db(req.params.name).update({_id:req.params._id}, {$addToSet: {file:list}}, {}, function (err, count, docs) {
      if (!count) return res.status(404).send('目标挂载对象不存在')
      res.send(docs)
    })
  })
}

const object_remove = async function(req, res, next) {
  // TODO: 账户操作 会话操作 收藏操作
  if (!req.params.name) {
    if (req.session.account.gid !== 1 && req.session.account.uid !== req.params.id) {
      return res.status(400).send('没有权限删除此账户')
    }
    if (await count_load('account', {_id: req.params.id, gid: 1}) === 1) {
      return res.status(400).send('不可以删除唯一的管理员账户')
    }
  }

  // TODO: 先移除依赖数据 like post...
  let {name, ...query} = req.params
  db(name).remove(query, function(err, count) {
    count ? res.send('删除成功') : res.status(403).send('删除失败')
    // TODO: 当对象被删除时通过此连接通知所有在线终端
  })
}

// app.use('/like', online, admin)
// app.use('/data/file/', express.static('data/file'))

const profile = function(req, res) {
  return db('user').findOne({_id: req.session.account.uid}, function(err, doc) {
    if (err) return res.status(401).send('尚未登录')
    delete doc.salt
    delete doc.password
    return res.json(doc)
  })
}

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(session({secret: 'shizukana', name:'sid', resave: false, saveUninitialized: false, cookie: { maxAge: 180 * 24 * 3600000 }, store: session_store}))

app.route('/').get(home)
app.route('/user').post(object_create)
app.route('/account').get(online, profile)
app.route('/session').get(online, session_list).post(session_create).delete(online, session_delete_self)
app.route('/session/:sid').delete(online, session_delete)                         // 会话
app.route('/:name').get(ListView).post(online, object_create)                     // 列表
app.route('/:name/:_id').get(OneView).put().patch().delete(online, object_remove) // 对象
app.route('/:name/:_id/files').post(online, files_upload)
app.route('/:name/:_id/files/:id').delete(online, files_delete)

app.listen(2333)
