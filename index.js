import nedb       from 'nedb'
import express    from 'express'
import expressWs  from 'express-ws'
import session    from 'express-session'
import connect    from 'connect-nedb-session'
import random     from 'string-random'
import formidable from 'formidable'
import md5        from 'md5-node'

process.on('SIGINT', function() {
  console.log('Got SIGINT.  Press Control-D/Control-C to exit.');
  process.exit(0);
});

const app = expressWs(express()).app
const NedbStore = connect(session)


// 数据: 自动构建 db 列表 或自动载入所有库
const databases = new Map()
const db = (name) => (databases.get(name) || function(){
  let database = new nedb({filename:`./data/db/${name}.db`,autoload:true,timestampData:true})
  databases.set(name, database)
  return database
}())

// 缓存: 自动构建 ws 列表
const wsstores  = new Map()
const wsstore = name => (wsstores.get(name) || function() {
  let list = new Map()
  wsstores.set(name, list)
  return list
}())

// 组件: 要求登录 (普通成员路由参数附上uid以分离权限)
const online = function(req, res, next) {
  if (req.session.account) return res.status(401).send('未登录')
  if (req.session.account.gid != 1) req.params.uid = req.session.account.uid
  next()
}

// 组件: 管理权限
const admin = function(req, res, next) {
  req.session.account.gid === 1 ? next() : res.status(403).send('没有权限')
}

// 组件: 移除输入非法信息 (但管理员允许输入)
const remove = function(req, res, next) {
  if (req.session.account.gid != 1) {
    let {_id, uid, createdAt, updatedAt, views, posts, likes, ...body} = req.body
    req.body = body
  }
  next()
}

// 组件: 从缓存载入数据
// 组件: 移除输出敏感信息

const session_store = new NedbStore({filename: './data/db/session.db'})

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(session({
  secret: 'keyboard cat',
  name:'sid',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 180 * 24 * 3600000 },
  store: session_store,
}))

// 只允许管理权限访问
app.use('/session', online, admin)
app.use('/account', online, admin)
app.use('/message', online, admin)
app.use('/attach', online, admin)
app.use('/like', online, admin)
app.use('/data/file/', express.static('data/file'))

const count_load = async function(name, query) {
  await new Promise(resolve => db(name).count(query, function(err, count) {
    resolve(count)
  }))
}

const list_load = async function(name, query) {
  await new Promise(resolve => db(name).find(query, function(err, docs) {
    let list = []
    for (let doc of docs) list.push({_id: doc.id})
    resolve(list)
  }))
}

const count_user = async function(query) {
  await new Promise(resolve => db('account').count(query, function(err, count) {
    resolve(count)
  }))
}

// 账户: 账户列表
app.route('/account').get(online, function(req, res, next) {
  // 账户列表 (列出所有账户并允许条件查询, 但移除敏感数据)
  db('account').find({}, function(err, docs) {
    res.json(docs)
  })
}).post(remove, online, async function(req,res, next) {
  let {salt, password, email, code, gid, ...account} = req.body
  if (password) {
    account.salt = random(32)
    account.password = md5(password + account.salt)
  }
  if (!account.name) account.name = random(12)       // 允许用户名登录则不可重复
  if (!account.avatar) account.avatar = ''           // default avatar
  if (await count_user({}) === 0) account.gid = 1    // 第一个用户默认是管理员
  db('account').insert(account, function(err, doc) { // 注册账户
    doc ? res.json(doc) : res.status(400).send('创建失败')
  })
}).patch(online, function(req, res, next) {
  // 修改当前账户
}).delete(online, function(req, res, next) {
  // 注销当前账户 (将逐步删除所有库中此uid的数据)
  if (req.session.account.gid === 1 && await count_user({gid: 1}) === 1) {
    return res.status(400).send('不可以删除唯一的管理员账户')
  }
  // TODO: 注意需要清空所有库中此uid的记录
})

// 账户: 账户实体
app.route('/account/:id').get(function(req, res, next) {
  db('account').findOne({_id: req.params.id}, function(err, doc) {
    if (!doc) return res.status(404).send('账户不存在')
    if (req.session?.account?.uid != doc._id && req.session?.account?.gid != 1) {
      delete doc.email
      delete doc.mobile
    }
    delete doc.salt
    delete doc.password
    res.json(doc)
  })
}).delete(online, admin, function(req, res, next) {
  if (req.session.account.gid !== 1 && req.session.account.uid !== req.params.id) {
    return res.status(400).send('没有权限删除此账户')
  }
  if (await count_user({_id: req.params.id, gid: 1}) === 1) {
    return res.status(400).send('不可以删除唯一的管理员账户')
  }
  db('account').remove({_id: req.params.id}, function(err, count) {
    count ? res.send('删除成功') : res.status(500).send('删除失败')
  })
  // TODO: 管理员删除指定账户
  // TODO: 注意需要清空所有库中此uid的记录
})

// 会话: 会话列表
app.route('/session').get(function(req, res, next) {
  // TODO: 读取会话列表 (当前有多少设备建立了多少会话)
  // TODO: (管理员列出所有会话, 普通成员只列出自己的会话)
  res.json(session_store.db.data)
}).post(function(req, res, next) { // 创建登录会话 (sign in)
  db('account').findOne({name: account.name}, function(err, doc) {
    if (!doc) return res.status(400).send('账户不存在')
    if (md5(doc.salt + password) != doc.password) return res.status(400).send('密码错误')
    req.session.regenerate(function(err) {
      req.session.account = { uid: doc._id, gid:doc.gid ?? 0 }
      let { salt, password, ...user} = doc
      res.json(user)
    })
  })
}).delete(function(req, res, next) { // 注销当前登录会话 (sign out)
  req.session.destroy(function(err) {
    err ? res.status(500).send('错误') : res.json({message:"exit"})
  })
})

// 会话: 会话实体
app.route('/session/:id').get(function(req, res, next) {
  // 获得指定会话信息
}).delete(function(req, res, next) {
  // 注销指定会话
})

// 对象: 对象列表
app.route('/:name').get(async function(req, res, next) {
  if (req.query.tid) req.query.tid = Number(req.query.tid) // 某些查询参数需要转换类型(暂时)
  if (req.query.top) req.query.top = Number(req.query.top) // 某些查询参数需要转换类型(暂时)
  if (req.query.uid || req.query.uid !== req.session?.account?.uid) {
    req.query.public = true // 如果查询条件限定为自己的, 则不用限制范围到公开的
  }
  let { pagesize, page, like, ...query } = req.query
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
      if (user) item.user = await user_load(item.uid) // 附加用户信息
    }
    res.json(docs)
  })
}).post(remove, online, function(req, res, next) {
  db(req.params.name).insert({public:true, ...req.body}, function(err, doc) {
    doc ? res.json(doc) : res.status(500).send('发布失败')
  })
})

// 对象: 对象实体
app.route('/:name/:_id').get(function(req, res, next) {
  db(req.params.name).findOne({_id: req.params._id}, async function(err, doc) {
    if (err || !doc) return res.status(404).send('目标资源不存在')
    if (!doc.public && doc.uid !== req.session?.account?.uid) {
      return res.status(403).send('没有权限读取')
    }
    // 附加用户信息
    if (req.query.user) doc.user = await user_load(doc.uid)
    res.send(doc)
  })
}).put(remove, online, function(req, res, next) {
  // TODO: 重写对象
}).patch(remove, online, function(req, res, next) {
  // TODO: 修改对象
}).delete(remove, online, function(req, res, next) {
  // TODO: 先移除依赖数据 like post...
  let {name, ...query} = req.params
  db(name).remove(query, function(err, count) {
    count ? res.json({message:'ok'}) : res.status(403).send('没有权限操作')
    // TODO: 当对象被删除时通过此连接通知所有在线终端
  })
})

// 对象: 子级对象列表
app.route('/:name/:id/:child').get(function(req, res, next) {
  db(req.params.child).find({name:req.params.name, id:req.params.id}, function(err, docs) {
    res.json(docs)
  })
}).post(function(req, res, next) {
  formidable({
    multiples: true,
    uploadDir: 'data/file',
    keepExtensions: true,
    maxFieldsSize: 200 * 1024 * 1024
  }).parse(req, function(err, fields, files) {
    let list = []
    for (let key in files) {
      let arr = Array.isArray(files[key]) ? files[key] : [files[key]]
      arr.forEach(({size, path, name, type}) => list.push({size, path, name, type}))
    }
    db(req.params.name).update({_id:req.params.id}, {$addToSet: {file:list}}, {}, function (err, count, docs) {
      console.log(count, docs)
      res.send('ok')
    })
  })
})

// 对象: 子级对象实体
app.route('/:name/:id/:child/:_id').get(function(req, res, next) {
  db(req.params.child).findOne({name:req.params.name, id:req.params.id}, function(err, doc) {
    doc ? res.json(doc) : res.status(404).send('对象不存在')
  })
}).delete(online, function(req, res, nuxt) {
  let { child, query } = req.params
  db.name(child).remove(query, function(err, count) {
    count ? res.json('delete ok') : res.status(400).send('拒绝操作')
  })
})

app.listen(2333)
