# かな
Nodejs 构建的 RESTful 风格 WEB API



1. 抽象化以扩大泛用性, 适用于各种形态的项目
2. 无须配置依赖项的, 使用内嵌数据库
3. 单文件,  代码不到 300 行, 易于维护, 易于扩展



由于使用已被大量实践的协议与风格建议, 文档中不再讲解此类细节,  这里将假设你已经了解:

1. RESTful 风格 URL
2. HTTP Method 资源操作方式



## Install
```bash
# clone 到本地
git clone https://github.com/InvisibleFuture/kana.git

# 切换到项目目录
cd kana

# 使用 yarn 或 npm 安装依赖包
yarn

# 使用 node 运行 index 文件
node index

# 也可以使用 pm2 作守护进程
pm2 start node --name kana -- index
```



## 特征


`/:name/:_id`

RESTful 风格 API, url 形式为两段 name是对象类型, _id是对象id. (与 vue 的 router 类同)

如发表一篇文章, 文章类型是 article, 文章 id 是 2333, 则 url为 `/article/2333`






## 使用示例



#### 创建用户

当程序在本地运行时, localhost:2333

```javascript
fetch('/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: 'Kana',
        password: '00000000'
    }),
}).then(Response => Response.json()).then(data => {
  console.log(data)
})

// 返回账户信息
{
    _id: 'ApSXNLoUy',
    name: 'Kana',
    avatar: 'https://xxxx.xxx/xxx.png'
}
```

* 创建的第一个账户默认为管理员账户
* 可以使用管理员权限设置其他账户为管理员
* 默认并没有验证邮箱等检查步骤, 允许直接设置, 也允许用户重名



#### 登录会话

登录行为被认为是创建一个终端到服务器的会话. 因此不是使用 login 或 signin, 而是 session.

```javascript
fetch('/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: 'Kana',
        password: '00000000'
    }),
}).then(Response => Response.json()).then(data => {
  console.log(data)
})
```



#### 会话列表

因此, 可以查看和管理自己所有的终端会话

```javascript
fetch('/session', {
    method: 'GET',
}).then(Response => Response.json()).then(data => {
  console.log(data)
})

[
    {
        sid: 'xxxxxsid',
        uid: 'xxxxxuid',
    }
]
```



#### 注销会话

相应地, 退出行为被认为是删除一个终端到服务端的会话, 因此不使用 loguot 或 signout, 而是 session.

注销当前会话
```javascript
fetch('/session', {
    method: 'DELETE',
}).then(Response => Response.json()).then(data => {
  console.log(data)
})
```



注销指定会话

```javascript
fetch('/session/xxxxxsid', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: 'Kana',
        password: '00000000'
    }),
}).then(Response => Response.json()).then(data => {
  console.log(data)
})
```





#### 修改资料

```javascript
fetch('/user/ApSXNLoUy', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: 'Hana',
        password: '11111111'
    }),
}).then(Response => Response.json()).then(data => {
  console.log(data)
})
```

* PATCH 时, 只发送要修改的字段(例如不需要修改用户名时, 发送的json不带name字段)



#### 上传头像

```html
<!DOCTYPE html>
<input type="file" name="photos", accept="image/*", multiple, onchange="upload($event)"/>

<script>
function upload(event) {
    let data = new FormData();
    //let files = document.querySelector("[type=file]").files;
    //files.map(item => data.append("photos", item))
    data.append("img", event.target.files[0]);
    fetch('/user/ApSXNLoUy', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data'},
        body: data
    }).then(Response => Response.json()).then(data => {
        console.log(data)
    })
}
</script>
```


#### 删除用户

管理员可以直接删除指定用户, 普通用户可以删除自己
```javascript
fetch('/user/ApSXNLoUy', {
    method: 'DELETE',
}).then(Response => Response.json()).then(data => {
  console.log(data)
})
```



#### 创建文章

此处 book 路径是未作限制的, 也可以是其他未被限制的路径.

```javascript
fetch('/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: 'Kana na na na',
        data: 'xx x xx xx xxx xx'
    }),
}).then(Response => Response.json()).then(data => {
  console.log(data)
})

// 返回文章信息
{
    _id: 'ppNXLoUK',
    name: 'Kana na na na',
    data: 'xx x xx xx xxx xx'
}
```



#### 评论文章

这里假设文章类型是 book, 文章 id 是 ppNXLoUK

attach 意为附属于指定对象类型
aid 意为附属于指定对象 id

```javascript
fetch('/post?attach=book&aid=ppNXLoUK', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        data: 'ahahahha~'
    }),
}).then(Response => Response.json()).then(data => {
  console.log(data)
})

{
    _id: 'spNkjLA',
    data: 'ahahahha~'
}
```

#### 评论评论
(二级评论)
这里假设评论类型是 post, 评论 id 是 spNkjLA
受益于评论的实现结构, 也可以对二级评论继续增加三级评论, 也可以无限深度

```javascript
fetch('/post?attach=post&aid=spNkjLA', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        data: 'yaaaaaaaaaa~'
    }),
}).then(Response => Response.json()).then(data => {
  console.log(data)
})

{
    _id: 'adjkasj',
    data: 'ahahahha~'
}
```



#### 点赞评论

受益于评论的实现结构, 也可以对二级评论作点赞操作, 也可以对任意对象点赞操作

```javascript
fetch('/like', {
    method: 'POST',
    body: JSON.stringify({
      attach: "post",
      aid: "spNkjLA"
    }),
}).then(Response => Response.json()).then(data => {
  console.log(data)
})

{
    _id: 'SOAPSAdaw',
    attach: "post",
    aid: "spNkjLA"
}
```



#### 取消点赞

```javascript
fetch('/like/SOAPSAdaw', {
    method: 'DELETE',
}).then(Response => Response.json()).then(data => {
  console.log(data)
})
```





#### 调频广播

通过频道订阅模式实现广播, 其中心思想是保障一个终端只维持一个 websocket 连接,
所有消息都通过一个连接通道发送到终端, 如聊天室频道, 系统消息, 全局广播, 消息盒子通知等

```javascript
let socket = new WebSocket("ws://localhost:2333");

socket.onopen = function(e) {
  alert("[open] Connection established");
  alert("Sending to server");
  
  // 向 xxxx 频道发送消息, data内的格式由客户端约定
  socket.send({fm:'xxxx', data:"My name is John"});
};

socket.onmessage = function(event) {
  alert(`[message] Data received from server: ${event.data}`);
};

socket.onclose = function(event) {
  if (event.wasClean) {
    alert(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
  } else {
    // e.g. server process killed or network down
    // event.code is usually 1006 in this case
    alert('[close] Connection died');
  }
};

socket.onerror = function(error) {
  alert(`[error] ${error.message}`);
};
```



* 注意, 必须要在已经登录的状态下才能成功建立 websocket 连接, 因为消息分发服务是基于订阅模式的
* 全局只需要使用一个连接, 订阅的频道消息都会通过这个连接传递
* 当用户(多个终端)建立多个连接时, 每个终端都能收到推送消息



```javascript
{
    fm: 'xxxxxxx',  // 频道
    uid: 'xxxxxx',  // 来源用户ID, 如果是系统消息, 此项忽略
    data: {}
}
```

* 用户发送的消息, 格式由终端约定, 注意不符合约定的格式应直接丢弃
* 可应用于聊天室, 系统通知, 实时公告, 协作, 消息盒子
* 非用户消息时, uid可忽略
* data为消息主体, 格式不受服务端控制, 可以为字符串,数字,对象,数组



#### 游客广播

允许未登录会话加入订阅, 将未登录会话加入到游客账户
因此不能再通过账户登录状态进行拦截





#### 对象列表

`GET` /:name

```javascript
{
  page: Number,     // 当前页码(默认为1)
  pagesize: Number, // 分页大小(默认20)
	sort: string,     // 排序方式(只能是对象的通用属性名)
	desc: Number,     // 0或1, 正序和倒序
	uid: string,      // 指定发布者uid查询
	like: bool,       // 查询自己点赞了的对象
	post: bool,       // 查询自己评论过的对象
	count: bool,      // 计数器(在返回的headers中附带列表统计信息)
}
```

- 除以上通用属性外, 对象的私有属性也可以用于查询
- 如果查询参数包含了不存在的参数, 将返回 400 错误
- 查询列表时, 相同的查询条件有15s缓存
- 如果查询公共的列表, 只返回状态为 pubilc的
- 如果查询自己的列表, 则同时返回私有状态的



#### 对象实体

