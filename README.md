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
cd shizukana

# 使用 yarn 或 npm 安装依赖包
yarn

# 使用 node 运行 index 文件
node index

# 也可以使用 pm2 作守护进程
pm2 start node --name shizukana -- index
```



## 特征



`/:name/:_id`

RESTful 风格 API, URL形式为两段 name是对象类型, _id是对象id

如发表一篇文章, 





## 使用示例



#### 创建用户

当程序在本地运行时, localhost:2333

```javascript
fetch()
```







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



查询示例:

```javascript
fetch('/book').then(Response => Response.json()).then(data => {
  console.log(data)
})

// 返回结果
[
    {_id:'xxx', data:'xxxx'},
    {_id:'xxx', data:'xxxx'}
]
```



创建示例:

```javascript
fetc('/book', {
    method: 'POST',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        name: '创建一本新书',
        data: '书的内容'
    }),
}).then(Response => Response.json()).then(data => {
  console.log(data)
})

// 返回结果
{
    _id: 'xxx',
    uid: 'xxx',
    name: '创建一本新书',
    data: '书的内容'
}
```



#### 对象实体

