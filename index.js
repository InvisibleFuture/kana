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


app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(session({
  secret: 'keyboard cat',
  name:'sid',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 180 * 24 * 3600000 },
  store: new NedbStore({filename: './data/db/session.db'}),
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

// 对象: 对象列表
app.route('/:name').get(function(req, res, next) {
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
    if (like) query.$or = list_load('like',{name:req.params.name, uid:req.session.account.uid})
    if (post) query.$or = list_load('post',{name:req.params.name, uid:req.session.account.uid})
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
