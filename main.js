import express from 'express'
import expressWs from 'express-ws'
import session from 'express-session'
import sessionDb from 'express-session-nedb'
import kana from './kana.js'

const app = expressWs(express()).app
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(session({ secret: 'kana', name: 'sid', resave: false, saveUninitialized: false, cookie: { maxAge: 180 * 24 * 3600000 }, store: session_store }))
app.use('/data/file/', express.static('data/file'))
app.ws('/', websocketer)



function listFind(req, res) {
  // 通过权限判断不可使用的字段
}


app.route('/:list').get(kana.list.find)

//import kana from 'kana'
//
//// 初始化一个
////const app = new kana()
//
//// list 是对象集合模型, 它规划了对象集合的生命周期, 因此也在此处配置
////kana.list.set
//
//// 使用 list 初始化指定类型的对象, 以对其进行特殊意义的操作
//const list = new kana.list("name")
//
//
//// item 是对象模型, 它规划了对象模型的生命周期
//const item = new kana.item("name")
//
//
//// 点赞一个对象
//// 取消点赞
//
//// fm 是频道通道, 
////const fm
//
//
//
//
//// 开始使用
//// 1. like 事件对模型节点挂载
////    1. 需要
//
//like.config({
//  set: "点赞时",
//  del: "取消时",
//})
//
//
//// 列表执行过程中调用
//list.config({
//  create: (item) => {
//    // 通知关注作者的用户
//    message.create({
//      // 构成消息结构
//    })
//  },
//  remove: "移除时执行",
//})
//
//// 或向列表执行过程中注入?
//// 函数式要求无状态
//// HAS
//
//const create = kana.list.create(item => {
//  // 创建对象时, 触发的所有事件
//})
//
//const remove = kana.list.delete(item => {
//  // 移除对象时, 触发的所有事件
//})
//
//kana.run({
//  // 如果触发结果
//})
//
//
//// 创建对象时发生什么
//// 1. 记录日志
//// 2. 通知关注者
////
//// 消息或日志挂载到哪里
//// 1. 创建对象时(通知的信息不同)
//// 2. 删除对象时(记录的信息不同)
////
