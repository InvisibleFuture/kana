import fs from 'fs'
import path from 'path'
import axios from 'axios'
import crypto from 'crypto'

const 镜像站列表 = [
  'gravatar.loli.net',    // loli.net
  'sdn.geekzu.org',       // 极客族公共加速服务
  'cravatar.cn',          // Cravatar - 中国的公共头像服务
  'gravatar.inwao.com',   // 「公益」Gravatar 韩国免费高速镜像源｜支持负载均衡 - inwao blog
  'gravatar.loli.top',    // 自建Gravatar国内+全球镜像加速服务 | 城南旧事 (loli.top)
  'gravatar.zeruns.tech', // Gravatar头像介绍 镜像地址大全 - Zeruns's Blog
  'secure.gravatar.com',  // Gravatar 官网
]

var 头像来源 = 0

function getGravatar(email, size=128) {
  let str = email ? crypto.createHash('md5').update(email.toLowerCase()).digest('hex') : 'default'
  let 本地路径 = './data/avatar/' + str + '.jpg'
  let 网络路径 = `https://${镜像站列表[头像来源]}/avatar/${str}.jpg?s=${size}&d=mm&r=g`
  if (!fs.existsSync(本地路径)) {
    axios({ url:网络路径, responseType: 'arraybuffer' }).then(({data}) => {
      fs.writeFileSync(本地路径, data, 'binary')
    }).catch(error => {
      头像来源++
      console.log(error)
      if (头像来源 <= 镜像站列表.length) getGravatar(email, size)
      console.log("下载头像完毕")
    })
  }
}

function 检查并创建目录(dirname) {
  if (fs.existsSync(dirname)) {
    return true
  } else if (检查并创建目录(path.dirname(dirname))) {
    fs.mkdirSync(dirname)
    return true
  }
  return false
}

export default {
  // 激活插件方法
  activate() {
    检查并创建目录('./data/avatar/')
  },

  // 禁用插件方法
  deactivate() {
    // 停用插件并删除目录
  },

  // 向头像获取方法插入替换
  getGravatar, // 获取头像(如果不存在自动从网络下载)
}

// test
// 检查并创建目录('./data/avatar/')
// getGravatar('huan0016@gmail.com', 128)
