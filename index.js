import nedb       from 'nedb'
import express    from 'express'
import expressWs  from 'express-ws'
import session    from 'express-session'
import connect    from 'connect-nedb-session'
import random     from 'string-random'
import formidable from 'formidable'
import md5        from 'md5-node'
import { resolve } from 'path/posix'


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

// 组件: 要求登录
const online = function(req, res, next) {
  req.session.account ? next() : res.status(401).send('未登录')
}

// 组件: 管理权限
const admin = function(req, res, next) {
  req.session.account.gid === 1 ? next() : res.status(403).send('没有权限')
}

// 组件: 移除输入非法信息
const remove = function(req, res, next) {
  delete req.body._id
  delete req.body.uid
  delete req.body.createdAt
  delete req.body.updatedAt
  delete req.body.views
  delete req.body.posts
  delete req.body.likes
  next()
}

// 组件: 从缓存载入数据

// 组件: 操作权限
//const authority = function(req, res, next) {
//  (req.method === 'GET') ? next() : res.status(200).send
//}

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

// 操作对象必须要登录
//app.use('/:name', )

// 对象列表


// 对象实体
// 对象附件
// 对象评论
// 对象收藏
// 对象点赞

// 无论在哪一级别的对象, 都是泛型对象, 因此不必二级restful
// 列表也是对象
//app.use('/:name', function(req, res, next) {
  // log
//})

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

app.get('/:name', function(req, res, next) {
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
})

app.post('/:name', online, remove, function(req, res, next) {
  req.body.uid    = req.session.account.uid // 默认发布者uid
  req.body.public = true                    // 默认发表即公开
  db(req.params.name).insert(req.body, function(err, doc) {
    doc ? res.json(doc) : res.status(500).send('内部错误')
  })
})

//app.put('/:name', online, function(req, res, next) {})
//app.patch('/:name', online, function(req, res, next) {})
//app.head('/:name', function(req, res, next) {})
//app.options('/:name', function(req, res, next) {})
app.get('/:name/:id', function(req, res, next) {
  db(req.params.name).findOne({_id: req.params.id}, async function(err, doc) {
    if (err || !doc) return res.status(404).send('目标资源不存在')
    if (!doc.public && doc.uid !== req.session?.account?.uid) {
      return res.status(403).send('没有权限读取')
    }
    // 附加用户信息
    if (req.query.user) doc.user = await user_load(doc.uid)
  })
})
app.put('/:name/:id', function(req, res, next) {})
//app.post('/:name/:id', function(req, res, next) {})
app.patch('/:name/:id', function(req, res, next) {})
//app.options('/:name/:id', function(req, res, next) {})
//app.head('/:name/:id', function(req, res, next) {})

app.get('/:name/:id/post', function(req, res, next) {
  // 获得此对象的所有post记录
})
app.get('/:name/:id/like', function(req, res, next) {
  // 获得此对象的所有like记录
})
app.get('/:name/:id/file', function(req, res, next) {
  // 获得此对象的所有attach记录
})

app.use('/:name/:id/file/', express.static('data/file'))
app.get('/:name/:id/file/:aid', function(req, res, next) {
  // 检查查询参数, 一般切割后的缩略图和原图格式不通
  // 获得此对象的本体 /:name/:id/attach/xxxx.png
})

app.post('/:name/:id/file', function(req, res, next) {
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

app.post('/:name/:id/file/:aid', function(req, res, next) {
  // 特别的操作?
})

app.delete('/:name/:id/file/:aid', function(req, res, next) {
  // 先验证对象操作权限
  // 此对象中是否包含此文件
  // 此文件是否存在
  // 移除此文件
  db(req.params.name).findOne({_id:req.params.id}, function(err, doc) {
    if (!doc) return res.status(404).send('对象不存在')
    doc.list.forEach(item => {
      // 使用 path 移除对象主体
      if (req.params.aid === item.aid) {
        db(req,params.name).update({_id:req.params.id}, {$pull:{file:item}}, {}, function(err, count, docs) {
          console.log(count)
        })
      }
    })
  })
})


// get    /:name/:id/xxxx.png
// delete /:name/:id/xxxx.png

// get    查询可以带参数, 可以切割图片
// delete 命令不可带参数, 只操作对象实体

// 一个请求分为三个过程
// 1. 异步日志
// 2. 请求运算
// 3. 异步落盘
// 4. 异步回执


app.listen(2333)

