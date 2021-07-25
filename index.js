import nedb       from 'nedb'
import express    from 'express'
import expressWs  from 'express-ws'
import session    from 'express-session'
//import random     from 'string-random'
import formidable from 'formidable'

const app = expressWs(express()).app
//const NedbStore = connect(session)

// 自动载入所有库
// 自动构建 db 列表
const databases = new Map()
const db = (name) => (databases.get(name) || function(){
  let database = new nedb({filename:`./data/db/${name}.db`,autoload:true,timestampData:true})
  databases.set(name, database)
  return database
}())

// 对象列表
// 对象实体
// 对象附件
// 对象评论
// 对象收藏
// 对象点赞
app.get('/', function(req, res, next) {
  res.send('index')
})

app.get('/test', function(req, res, next) {
  res.send(`
  <DOCTYPE html>
  <title>test</title>
  <p> 2333 <p>
  <div id="div"></div>
  <form id="form">
      <input type="file" name="files" multiple accept=".jpg,">
      <input id="btn" type="button" value="确认上传">
  </form>
  <script>
  const btn = document.getElementById("btn");
  const form = document.getElementById("form");
  btn.onclick = function () {
      console.log(1);
      const formData = new FormData(form);
      // 获取数组第一个文件
      //files = formDate.get("files");
      // 返回数组  获取所有文件
      // files = formData.getAll("files");
      // console.log(files);

      const xhr = new XMLHttpRequest();
      xhr.open('post', '/demo/FmnKXZ8lxwGjf4GE/file');
      xhr.send(formData);
      xhr.onload = function () {
          alert(xhr.responseText);
      }
  }
  </script>
  `)
})


// 无论在哪一级别的对象, 都是泛型对象, 因此不必二级restful
// 列表也是对象
//app.use('/:name', function(req, res, next) {
  // log
//})
app.get('/:name', function(req, res, next) {
  db(req.params.name).find({}, function(err, docs) {
    res.json(docs)
  })
})
app.put('/:name', function(req, res, next) {})
app.post('/:name', function(req, res, next) {
  db(req.params.name).insert({name:'2333'}, function(err, doc) {
    res.json(doc)
  })
})
app.patch('/:name', function(req, res, next) {})
app.head('/:name', function(req, res, next) {})
app.options('/:name', function(req, res, next) {})
app.get('/:name/:id', function(req, res, next) {})
app.put('/:name/:id', function(req, res, next) {})
app.post('/:name/:id', function(req, res, next) {})
app.patch('/:name/:id', function(req, res, next) {})
app.options('/:name/:id', function(req, res, next) {})
app.head('/:name/:id', function(req, res, next) {})

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

